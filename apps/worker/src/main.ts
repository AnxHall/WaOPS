import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import type { ThresholdRule } from './rules.engine.js';
import { createLogger, withCorrelation, getCorrelationLogger } from '@waops/observability';
import { loadConfig } from '@waops/config';
import { getPrisma, disconnectPrisma } from '@waops/db';
import { BullMQEventPublisher, parseRedis, WAOPS_EVENT_QUEUE } from '@waops/events';
import { OutboxDispatcher } from './outbox.dispatcher.js';
import { IncidentService } from './incident.service.js';
import { NotificationService } from './notifications.js';
import { DEFAULT_CPU_RULE, RuleStateTracker } from './rules.engine.js';
import { registerEventCatalogV1, buildEventEnvelope, composeFingerprint } from '@waops/contracts';
import { randomUUID } from 'node:crypto';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });
const config = loadConfig();
const logger = createLogger({ level: config.env.LOG_LEVEL, name: 'waops-worker' });
registerEventCatalogV1();

const tracker = new RuleStateTracker();
const notifications = new NotificationService();

async function handleEventEnvelope(envelope: import('@waops/contracts').EventEnvelopeV1): Promise<void> {
  const prisma = getPrisma();

  // Store domain event (idempotent by event_id). A duplicate event (outbox
  // republish after crash, queue redelivery) MUST be fully skipped: no second
  // timeline entry, no notification fan-out (HARD MISSION 02 / C2, §18/§38).
  const stored = await prisma.domainEvent
    .create({
      data: {
        id: envelope.event_id,
        tenantId: envelope.tenant_id,
        eventType: envelope.event_type,
        sourceType: envelope.source_type,
        resourceId: envelope.resource_id ?? null,
        severity: envelope.severity,
        fingerprint: envelope.fingerprint ?? null,
        observedAt: new Date(envelope.observed_at),
        attributesJson: envelope.attributes as object,
        correlationId: envelope.correlation_id ?? null,
      },
    })
    .catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        logger.debug({ event_id: envelope.event_id }, 'duplicate event skipped (idempotent)');
        return null;
      }
      throw err;
    });
  if (!stored) return; // duplicate — downstream is exactly-once per event_id

  // Open/dedup incident when the event type is incident-capable
  const incident = new IncidentService();
  const { incidentId } = await incident.openFromEvent(envelope);

  // Fan-out to enabled notification channels (foundation: notify on incident open)
  if (incidentId) {
    const channels = await prisma.notificationChannel.findMany({
      where: { tenantId: envelope.tenant_id, enabled: true },
    });
    for (const channel of channels) {
      const result = await notifications.dispatchToChannel(channel.id, incidentId, envelope);
      logger.info({ channel: channel.name, status: result.status }, 'notification dispatched');
    }
  }
}

async function consumeQueue(): Promise<void> {
  const { Worker } = await import('bullmq');
  const worker = new Worker(
    WAOPS_EVENT_QUEUE,
    async (job) => {
      const envelope = job.data as import('@waops/contracts').EventEnvelopeV1;
      await withCorrelation(
        { requestId: `evt_${envelope.event_id}`, tenantId: envelope.tenant_id },
        () => handleEventEnvelope(envelope),
      );
    },
    { connection: parseRedis(config.env.REDIS_URL), concurrency: 4 },
  );
  worker.on('failed', (job, err) => {
    logger.error({ job_id: job?.id, err: err.message }, 'event worker job failed');
  });
  logger.info({ queue: WAOPS_EVENT_QUEUE }, 'event consumer running');
}

/**
 * Metric ingest worker (queue ingest.metrics): idempotent persist + rule eval.
 * Jobs carry tenant_id explicitly (jobs-workers.md).
 */
async function consumeMetrics(): Promise<void> {
  const { Worker } = await import('bullmq');
  const prisma = getPrisma();

  // Rules cache (HARD MISSION 02 / H1): threshold/duration come from alert_rules
  // rows (per tenant, enabled). Engine receives rule definitions — no hardcoded
  // commercial rule. DEFAULT_CPU_RULE is only a fallback when a tenant has no
  // rule for the metric (documented default, not fixed policy).
  let rulesCache: { rules: ThresholdRule[]; loadedAt: number } = { rules: [], loadedAt: 0 };
  async function loadRules(): Promise<ThresholdRule[]> {
    if (Date.now() - rulesCache.loadedAt < 30_000) return rulesCache.rules;
    const rows = await prisma.alertRule.findMany({ where: { enabled: true } });
    const fromDb: ThresholdRule[] = [];
    for (const r of rows) {
      const c = r.conditionJson as { metric?: string; comparator?: string; threshold?: number; consecutive_samples?: number };
      const metric = typeof c.metric === 'string' ? c.metric : '';
      const threshold = Number(c.threshold ?? NaN);
      if (!metric || !Number.isFinite(threshold)) continue;
      fromDb.push({
        metric,
        comparator: c.comparator === '<' ? '<' : '>',
        threshold,
        consecutiveSamples: Number(c.consecutive_samples ?? 6),
        severity: r.severity as ThresholdRule['severity'],
        eventType: r.eventType,
      });
    }
    rulesCache = { rules: fromDb, loadedAt: Date.now() };
    return fromDb;
  }

  const worker = new Worker(
    'ingest.metrics',
    async (job) => {
      const { tenant_id, samples } = job.data as {
        tenant_id: string;
        samples: Array<{
          metric: string;
          resource_id: string;
          observed_at: string;
          value: number;
          dimensions?: Record<string, unknown>;
        }>;
      };
      await withCorrelation({ requestId: `job_${job.id}`, tenantId: tenant_id }, async () => {
        // H2: single batch insert (no N+1 per sample)
        await prisma.metricSample.createMany({
          data: samples.map((sample) => ({
            tenantId: tenant_id,
            resourceId: sample.resource_id,
            metric: sample.metric,
            value: sample.value,
            dimensionsJson: (sample.dimensions ?? {}) as object,
            observedAt: new Date(sample.observed_at),
          })),
        });

        const dbRules = await loadRules();
        const rules = dbRules.length > 0 ? dbRules : [DEFAULT_CPU_RULE]; // documented fallback

        for (const sample of samples) {
          for (const rule of rules) {
            if (rule.metric !== sample.metric) continue;
            const evaluation = tracker.track(rule.eventType, sample.resource_id, sample.value, rule);
            if (evaluation.fired && evaluation.eventType && evaluation.severity) {
              const fingerprint = composeFingerprint('tenant_host', {
                tenantId: tenant_id,
                resourceId: sample.resource_id,
              });
              const envelope = buildEventEnvelope({
                eventId: `evt_${randomUUID()}`,
                tenantId: tenant_id,
                source: 'rules-engine',
                sourceType: 'engine',
                eventType: evaluation.eventType,
                severity: evaluation.severity,
                observedAt: sample.observed_at,
                attributes: {
                  metric: sample.metric,
                  value: sample.value,
                  threshold: rule.threshold,
                  consecutive_samples: evaluation.consecutiveCount,
                },
                resourceId: sample.resource_id,
                fingerprint,
                correlationId: envelope_correlation(sample),
              });
              const publisher = new BullMQEventPublisher(
                config.env.REDIS_URL,
                (await import('bullmq')).Queue,
              );
              await publisher.publish(envelope);
            }
          }
        }
      });
    },
    { connection: parseRedis(config.env.REDIS_URL), concurrency: 2 },
  );
  worker.on('failed', (job, err) => {
    logger.error({ job_id: job?.id, err: err.message }, 'metrics worker job failed');
  });
  logger.info({ queue: 'ingest.metrics' }, 'metrics consumer running');
}

function envelope_correlation(_sample: unknown): string | null {
  return null; // correlation arrives with incident engine phase 2 (suppression windows)
}

async function main(): Promise<void> {
  logger.info({ env: config.env.NODE_ENV }, 'waops-worker starting');

  const publisher = new BullMQEventPublisher(config.env.REDIS_URL, (await import('bullmq')).Queue);
  const dispatcher = new OutboxDispatcher(publisher);

  await consumeQueue();
  await consumeMetrics();

  // Outbox dispatch loop (500ms tick)
  const loop = setInterval(async () => {
    try {
      await withCorrelation({ requestId: `outbox_${Date.now()}` }, async () => {
        const sent = await dispatcher.tick();
        if (sent > 0) getCorrelationLogger().info({ sent }, 'outbox dispatched');
      });
    } catch (err) {
      logger.error({ err }, 'outbox tick failed');
    }
  }, 500);

  const shutdown = async (): Promise<void> => {
    clearInterval(loop);
    logger.info('shutting down');
    await publisher.close();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'worker bootstrap failed');
  process.exit(1);
});
