import Redis from 'ioredis';
import type { EventEnvelopeV1 } from '@waops/contracts';

/**
 * HM05 ADR-010 — worker-side realtime emit (no Nest DI in the worker).
 * Publishes incident events to the tenant SSE channels (same wire format as
 * the API RealtimeBroker: { id, channel, type, occurred_at, payload }).
 * Fire-and-forget semantics: failure here never affects the incident pipeline
 * (dashboards resync via REST on reconnect).
 */
export class WorkerRealtimeEmitter {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false });
    this.redis.on('error', () => undefined);
    void this.redis.connect().catch(() => undefined);
  }

  /**
   * Monotonic per-tenant SSE id (same `sse:seq:{tenant}` counter the API's
   * RealtimePublisher uses) so Last-Event-ID replay keeps a total order across
   * ALL producers (API, worker, gateway).
   */
  private async nextId(tenantId: string): Promise<string> {
    return String(await this.redis.incr(`sse:seq:${tenantId}`));
  }

  /**
   * Publish AND retain (same wire contract as the API RealtimeBroker): the
   * per-channel ring buffer is what makes Last-Event-ID replay lossless-ish.
   */
  private async publishRetained(channel: string, event: Record<string, unknown>): Promise<void> {
    const payload = JSON.stringify(event);
    await Promise.all([
      this.redis.publish(channel, payload),
      this.redis
        .multi()
        .lpush(`sse:retained:${channel}`, payload)
        .ltrim(`sse:retained:${channel}`, 0, 199)
        .expire(`sse:retained:${channel}`, 3600)
        .exec(),
    ]);
  }

  async emitIncidentEvent(envelope: EventEnvelopeV1, incidentId: string, status?: string): Promise<void> {
    const channel = `tenant:${envelope.tenant_id}:incidents`;
    const event = {
      id: await this.nextId(envelope.tenant_id),
      channel: 'incidents',
      type: 'incident.created',
      occurred_at: envelope.observed_at,
      payload: {
        incident_id: incidentId,
        event_type: envelope.event_type,
        severity: envelope.severity,
        resource_id: envelope.resource_id ?? null,
        title: `${envelope.event_type} on ${envelope.resource_id ?? 'resource'}`,
        ...(status ? { status } : {}),
      },
    };
    await this.publishRetained(channel, event);
  }

  async emitAgentEvent(tenantId: string, type: string, payload: Record<string, unknown>): Promise<void> {
    const channel = `tenant:${tenantId}:agents`;
    const event = {
      id: await this.nextId(tenantId),
      channel: 'agents',
      type,
      occurred_at: new Date().toISOString(),
      payload,
    };
    await this.publishRetained(channel, event);
  }

  async close(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
