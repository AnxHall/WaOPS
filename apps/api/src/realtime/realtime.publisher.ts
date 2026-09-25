import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { loadConfig } from '@waops/config';
import { RealtimeBroker, type RealtimeEvent } from './realtime.broker.js';
import { channelName } from './realtime.broker.js';

/**
 * Server-side helper for publishing realtime events. Wraps the broker with
 * monotonic per-tenant sequence ids (SSE `id:`) so Last-Event-ID replay works
 * with a total order per tenant (HM05 design: seq counter in Redis, INCR).
 */
@Injectable()
export class RealtimePublisher implements OnModuleDestroy {
  private readonly seq: Redis;

  constructor(private readonly broker: RealtimeBroker) {
    this.seq = new Redis(loadConfig().env.REDIS_URL, { maxRetriesPerRequest: 1 });
    this.seq.on('error', () => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.seq.quit().catch(() => undefined);
  }

  async publish(tenantId: string, event: Omit<RealtimeEvent, 'id'>): Promise<void> {
    // Monotonic per-tenant id (INCR is atomic; id collisions impossible).
    const id = await this.seq.incr(`sse:seq:${tenantId}`);
    await this.broker.publish(tenantId, { ...event, id: String(id) });
  }
}

export { channelName };
