import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { Response } from 'express';
import Redis from 'ioredis';
import { loadConfig } from '@waops/config';
import { getCorrelationLogger } from '@waops/observability';
import { requireTenantContext } from '@waops/tenancy';

/**
 * ADR-010 — Realtime SSE tenant-scoped.
 *
 * Channels: `tenant:{tenant_id}:incidents` and `tenant:{tenant_id}:agents`.
 * tenant_id ALWAYS comes from the authenticated TenantContext (JWT) — never
 * from a query param or header supplied by the client (ADR-010 §Decisão).
 *
 * Transport: Server-Sent Events. Fan-out via Redis pub/sub so the API scales
 * horizontally without sticky sessions (each API instance subscribes with its
 * own connection; the worker/gateway publish through the same Redis).
 *
 * Reconnection: clients send `Last-Event-ID`; the server replays the retained
 * per-tenant ring buffer of recent events (id > cursor) before streaming live.
 * The buffer (capped, trimmed) makes brief disconnects lossless-ish without a
 * broker backlog.
 */

export const SSE_CHANNELS = ['incidents', 'agents'] as const;
export type SseChannel = (typeof SSE_CHANNELS)[number];

export interface RealtimeEvent {
  id: string;
  channel: SseChannel;
  type: string;
  occurred_at: string;
  payload: Record<string, unknown>;
}

/** Retained-event window for Last-Event-ID replay. */
const RETAINED_MAX = 200;
const RETAINED_TTL_SECONDS = 3600;
/** SSE comment heartbeat interval — keeps proxies from idling the stream out. */
const HEARTBEAT_MS = 15_000;

export function channelName(tenantId: string, channel: SseChannel): string {
  return `tenant:${tenantId}:${channel}`;
}

@Injectable()
export class RealtimeBroker implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly subscriber: Redis;

  constructor() {
    const cfg = loadConfig();
    this.redis = new Redis(cfg.env.REDIS_URL, { maxRetriesPerRequest: 1 });
    this.subscriber = new Redis(cfg.env.REDIS_URL, { maxRetriesPerRequest: 1 });
    this.subscriber.on('error', () => undefined); // degradation handled per-stream
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.redis.quit(), this.subscriber.quit()]);
  }

  /**
   * Publish an event to a tenant channel. Idempotency: the event id is supplied
   * by the producer (event envelope id / deterministic agent action id), so a
   * republish is deduplicated client-side by SSE id.
   */
  async publish(tenantId: string, event: RealtimeEvent): Promise<void> {
    const ch = channelName(tenantId, event.channel);
    const payload = JSON.stringify(event);
    await Promise.all([
      this.redis.publish(ch, payload),
      // retain for Last-Event-ID replay (single list per tenant+channel, trimmed)
      this.redis
        .multi()
        .lpush(`sse:retained:${ch}`, payload)
        .ltrim(`sse:retained:${ch}`, 0, RETAINED_MAX - 1)
        .expire(`sse:retained:${ch}`, RETAINED_TTL_SECONDS)
        .exec(),
    ]);
  }

  /** Retained events strictly newer than `afterId` (numeric SSE ids). */
  async retainedAfter(tenantId: string, channel: SseChannel, afterId: bigint): Promise<RealtimeEvent[]> {
    const raw = await this.redis.lrange(`sse:retained:${channelName(tenantId, channel)}`, 0, -1);
    const events: RealtimeEvent[] = [];
    for (const line of raw) {
      try {
        const evt = JSON.parse(line) as RealtimeEvent;
        if (BigInt(evt.id) > afterId) events.push(evt);
      } catch {
        // malformed retained entry — skip (never break the stream)
      }
    }
    // oldest-first for replay
    return events.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  }

  /**
   * Attach an authenticated tenant stream to `res`. Resolves when the client
   * disconnects. tenantId comes from requireTenantContext() — the caller
   * (controller) guarantees auth via PermissionsGuard.
   */
  async stream(
    res: Response,
    channels: readonly SseChannel[],
    lastEventId: string | undefined,
  ): Promise<void> {
    const logger = getCorrelationLogger();
    const tenantId = requireTenantContext().tenantId;

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const tenantChannels = channels.map((c) => channelName(tenantId, c));
    let closed = false;
    const onClose = () => {
      closed = true;
    };
    res.on('close', onClose);

    const send = (evt: RealtimeEvent): void => {
      if (closed) return;
      res.write(`id: ${evt.id}\nevent: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
    };

    const comment = (text: string): void => {
      if (closed) return;
      res.write(`:${text}\n\n`);
    };

    // Replay retained events after the client's cursor (per channel). A
    // malformed cursor is ignored (stream from now) instead of failing the
    // connect — the client resyncs from REST either way.
    let cursor: bigint | undefined;
    if (lastEventId) {
      try {
        cursor = BigInt(lastEventId);
      } catch {
        cursor = undefined;
      }
    }
    if (cursor !== undefined) {
      for (const channel of channels) {
        const replay = await this.retainedAfter(tenantId, channel, cursor).catch(() => [] as RealtimeEvent[]);
        for (const evt of replay) send(evt);
      }
    }

    // Subscribe only after replay to avoid a gap/duplication window; events
    // published between replay and subscribe are re-delivered on next reconnect
    // (cursor-based) — at-least-once per SSE id, deduped client-side.
    if (!closed) {
      await this.subscriber.subscribe(...tenantChannels);
      const onMessage = (ch: string, message: string): void => {
        try {
          send(JSON.parse(message) as RealtimeEvent);
        } catch {
          // ignore malformed frames
        }
      };
      this.subscriber.on('message', onMessage);

      comment('connected');
      const heartbeat = setInterval(() => comment(`keep-alive ${new Date().toISOString()}`), HEARTBEAT_MS);

      await new Promise<void>((resolve) => {
        res.once('close', () => {
          clearInterval(heartbeat);
          this.subscriber.removeListener('message', onMessage);
          this.subscriber.unsubscribe(...tenantChannels).catch(() => undefined);
          resolve();
        });
      });
      logger.debug({ tenant_id: tenantId, channels: tenantChannels }, 'sse stream closed');
    }
  }
}
