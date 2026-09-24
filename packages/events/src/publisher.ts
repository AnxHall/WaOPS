import type { EventEnvelopeV1 } from '@waops/contracts';

/**
 * Publisher abstraction — modules publish envelopes; the transport may evolve
 * (BullMQ today, dedicated broker later) without changing call sites (ADR-008).
 */
export interface EventPublisher {
  publish(envelope: EventEnvelopeV1): Promise<void>;
  close(): Promise<void>;
}

export const WAOPS_EVENT_QUEUE = 'waops.domain-events';

/** BullMQ/Redis implementation used in dev/production. */
export class BullMQEventPublisher implements EventPublisher {
  private readonly queue: import('bullmq').Queue;

  constructor(redisUrl: string, QueueImpl: typeof import('bullmq').Queue) {
    this.queue = new QueueImpl(WAOPS_EVENT_QUEUE, { connection: parseRedis(redisUrl) });
  }

  async publish(envelope: EventEnvelopeV1): Promise<void> {
    await this.queue.add(envelope.event_type, envelope, {
      jobId: envelope.event_id,
      removeOnComplete: 1000,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

/** In-memory implementation for unit tests. */
export class InMemoryEventPublisher implements EventPublisher {
  readonly published: EventEnvelopeV1[] = [];

  async publish(envelope: EventEnvelopeV1): Promise<void> {
    this.published.push(envelope);
  }

  async close(): Promise<void> {
    // no-op
  }
}

export function parseRedis(url: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    ...(parsed.username ? { username: parsed.username } : {}),
    ...(parsed.password ? { password: parsed.password } : {}),
    ...(parsed.pathname && parsed.pathname !== '/' ? { db: Number(parsed.pathname.slice(1)) } : {}),
  };
}
