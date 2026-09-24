import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { createLogger, withCorrelation, getCorrelationLogger } from '@waops/observability';
import { loadConfig } from '@waops/config';
import { getPrisma, disconnectPrisma } from '@waops/db';
import { BullMQEventPublisher, parseRedis, WAOPS_EVENT_QUEUE } from '@waops/events';
import { OutboxDispatcher } from './outbox.dispatcher.js';
import { IncidentService } from './incident.service.js';
import { NotificationService } from './notifications.js';
import { DEFAULT_CPU_RULE, RuleStateTracker, type ThresholdRule } from './rules.engine.js';
import { registerEventCatalogV1, buildEventEnvelope, composeFingerprint } from '@waops/contracts';
import { randomUUID } from 'node:crypto';

loadDotenv({ path: resolve(process.cwd(), '../../.env') });
const config = loadConfig();
const logger = createLogger({ level: config.env.LOG_LEVEL, name: 'waops-worker' });
registerEventCatalogV1();

const tracker = new RuleStateTracker();
const notifications = new NotificationService();

/** Rules evaluated on metric ingest (foundation: 1 real rule from ALERT config/env). */
const RULES: ThresholdRule[] = [DEFAULT_CPU_RULE];

async function handleEventEnvelope(envelope: import('@waops/contracts').EventEnvelopeV1): Promise<void> {
  const prisma = getPrisma();

  // Store domain event (idempotent by event_id)
  await prisma.domainEvent
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
    .catch(() => {
      logger.debug({ event_id: envelope.event_id }, 'event already stored (dedup)');
    });

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
        for (const sample of samples) {
          await prisma.metricSample.create({
            data: {
              tenantId: tenant_id,
              resourceId: sample.resource_id,
              metric: sample.metric,
              value: sample.value,
              dimensionsJson: (sample.dimensions ?? {}) as object,
              observedAt: new Date(sample.observed_at),
            },
          });

          for (const rule of RULES) {
            if (rule.metric !== sample.metric) continue;
            const evaluation = tracker.track('default', sample.resource_id, sample.value, rule);
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
