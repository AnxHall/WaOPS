import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import Fastify from 'fastify';
import { loadConfig } from '@waops/config';
import { createLogger, correlationStorage } from '@waops/observability';
import { getPrisma, disconnectPrisma } from '@waops/db';
import {
  HeartbeatV1,
  MetricsBatchV1,
  buildEventEnvelope,
  composeFingerprint,
} from '@waops/contracts';
import { randomUUID } from 'node:crypto';
import {
  authenticateAgent,
  hashAgentCredential,
  type AgentIdentity,
} from './auth.js';

const config = loadConfig();
const logger = createLogger({ level: config.env.LOG_LEVEL, name: 'waops-gateway' });
const prisma = getPrisma();
/** Simple fixed-window rate limit per agent (foundation; token bucket later). */
const rateBuckets = new Map<string, { count: number; windowStart: number }>();
function rateLimited(agentId: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(agentId);
  if (!bucket || now - bucket.windowStart > windowMs) {
    rateBuckets.set(agentId, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

const app = Fastify({ logger: false, bodyLimit: 5 * 1024 * 1024 });

app.addHook('onRequest', async (req, reply) => {
  const requestId = `req_${randomUUID()}`;
  reply.header('x-request-id', requestId);
  // Open ALS context for the whole request via request decorator
  const als = correlationStorage;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (req as any)._alsStore = { requestId };
  void als;
});

app.addHook('preHandler', async (req) => {
  // Run handlers inside correlation scope (gateway logs carry request_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const store = (req as any)._alsStore;
  if (store) {
    await new Promise<void>((resolve) => correlationStorage.run(store, resolve));
  }
});

/** Enrollment: one-time token → durable credential (enrollment.md flow). */
app.post('/api/v1/agents/enrollment', async (req, reply) => {
  const body = req.body as { enrollment_token?: string; name?: string; version?: string; capabilities?: string[] };
  if (!body?.enrollment_token) {
    return reply.status(400).send({ error: { code: 'validation_error', message: 'enrollment_token required' } });
  }
  const token = await prisma.agentEnrollmentToken.findUnique({
    where: { token: body.enrollment_token },
  });
  if (!token || token.status !== 'active' || token.expiresAt < new Date()) {
    return reply.status(401).send({ error: { code: 'authentication_required', message: 'invalid enrollment token' } });
  }

  const secret = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const agent = await prisma.$transaction(async (tx) => {
    const created = await tx.agent.create({
      data: {
        tenantId: token.tenantId,
        name: body.name ?? 'waagent',
        version: body.version ?? null,
        protocolVersion: 1,
        status: 'online',
        capabilities: body.capabilities ?? [],
        credentialHash: '', // set below
      },
    });
    await tx.agent.update({
      where: { id: created.id },
      data: { credentialHash: hashAgentCredential(created.id, secret) },
    });
    await tx.agentEnrollmentToken.update({
      where: { id: token.id },
      data: { status: 'used', usedAt: new Date(), agentId: created.id },
    });
    return created;
  });

  logger.info({ agent_id: agent.id, tenant_id: token.tenantId }, 'agent enrolled');
  return reply.send({
    protocol_version: 1,
    agent_id: agent.id,
    credential: `waops_${agent.id}_${secret}`, // durable credential (stored hashed)
  });
});

/** Heartbeat: validates contract, updates last_seen/status/version. */
app.post('/api/v1/agents/heartbeat', async (req, reply) => {
  const identity: AgentIdentity | null = await authenticateAgent(req.headers.authorization);
  if (!identity) {
    return reply.status(401).send({ error: { code: 'authentication_required', message: 'invalid agent credential' } });
  }
  if (rateLimited(identity.agentId)) {
    return reply.status(429).send({ error: { code: 'rate_limited', message: 'retry later' } });
  }
  const parsed = HeartbeatV1.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: { code: 'validation_error', message: 'heartbeat schema mismatch' } });
  }
  // tenant from identity — ignore anything else in payload
  await prisma.agent.update({
    where: { id: identity.agentId },
    data: {
      lastSeenAt: new Date(),
      status: 'online',
      version: parsed.data.agent_version,
      protocolVersion: parsed.data.protocol_version,
    },
  });
  return reply.send({ protocol_version: 1, ack: parsed.data.agent_id });
});

/** Metrics batch: contract validation → queue ingest.metrics (tenant from identity). */
app.post('/api/v1/agents/metrics', async (req, reply) => {
  const identity = await authenticateAgent(req.headers.authorization);
  if (!identity) {
    return reply.status(401).send({ error: { code: 'authentication_required', message: 'invalid agent credential' } });
  }
  if (rateLimited(identity.agentId)) {
    return reply.status(429).send({ error: { code: 'rate_limited', message: 'retry later' } });
  }
  const parsed = MetricsBatchV1.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: { code: 'validation_error', message: 'metrics batch schema mismatch' },
    });
  }
  if (parsed.data.agent_id !== identity.agentId) {
    return reply.status(403).send({ error: { code: 'permission_denied', message: 'agent_id mismatch' } });
  }

  const { Queue } = await import('bullmq');
  const queue = new Queue('ingest.metrics', { connection: { host: new URL(config.env.REDIS_URL).hostname, port: Number(new URL(config.env.REDIS_URL).port || 6379) } });
  await queue.add('batch', { tenant_id: identity.tenantId, samples: parsed.data.samples }, {
    jobId: `metrics_${identity.agentId}_${parsed.data.sequence}`,
    removeOnComplete: 500,
  });
  await queue.close();

  return reply.send({ protocol_version: 1, acked_sequence: parsed.data.sequence });
});

/** Container lifecycle events → event envelopes (docker collector mapping). */
app.post('/api/v1/agents/events', async (req, reply) => {
  const identity = await authenticateAgent(req.headers.authorization);
  if (!identity) {
    return reply.status(401).send({ error: { code: 'authentication_required', message: 'invalid agent credential' } });
  }
  const body = req.body as {
    events?: Array<{ event_type: string; resource_id: string; host_id?: string; observed_at: string; attributes?: Record<string, unknown> }>;
  };
  const events = body?.events ?? [];
  const { Queue } = await import('bullmq');
  const queue = new Queue('waops.domain-events', { connection: { host: new URL(config.env.REDIS_URL).hostname, port: Number(new URL(config.env.REDIS_URL).port || 6379) } });

  const envelopes = [];
  for (const evt of events) {
    const envelope = buildEventEnvelope({
      eventId: `evt_${randomUUID()}`,
      tenantId: identity.tenantId,
      source: 'waagent',
      sourceType: 'agent',
      eventType: evt.event_type,
      severity: evt.event_type === 'container.oom' ? 'critical' : 'high',
      observedAt: evt.observed_at,
      attributes: evt.attributes ?? {},
      resourceId: evt.resource_id,
      fingerprint: composeFingerprint('tenant_host_container', {
        tenantId: identity.tenantId,
        hostId: evt.host_id ?? null,
        containerId: evt.resource_id,
      }),
    });
    envelopes.push(envelope);
    await queue.add(envelope.event_type, envelope, { jobId: envelope.event_id });
  }
  await queue.close();
  return reply.send({ accepted: envelopes.length });
});

async function main(): Promise<void> {
  loadDotenv({ path: resolve(process.cwd(), '../../.env') });
  const port = Number(process.env.COLLECTOR_PORT ?? 3002);
  await app.listen({ port, host: '0.0.0.0' });
  logger.info({ port }, 'waops-collector-gateway listening');

  const shutdown = async (): Promise<void> => {
    await app.close();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'gateway bootstrap failed');
  process.exit(1);
});
