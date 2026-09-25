import type { EventEnvelopeV1 } from '@waops/contracts';

/**
 * Outbox port — implemented over Prisma in apps (transactions-and-outbox.md):
 * domain state change + outbox insert in the SAME transaction, then a worker
 * publishes and marks as sent.
 */
export interface OutboxStore {
  append(envelope: EventEnvelopeV1, tx?: unknown): Promise<void>;
  markSent(ids: string[]): Promise<void>;
  claimBatch(limit: number): Promise<Array<{ id: string; envelope: EventEnvelopeV1; attempts: number }>>;
}

export class OutboxService {
  constructor(private readonly store: OutboxStore) {}

  /** Must be called with the same transaction as the domain write. */
  async append(envelope: EventEnvelopeV1, tx?: unknown): Promise<void> {
    await this.store.append(envelope, tx);
  }

  async markSent(ids: string[]): Promise<void> {
    if (ids.length > 0) await this.store.markSent(ids);
  }

  async claimBatch(limit: number): Promise<Array<{ id: string; envelope: EventEnvelopeV1; attempts: number }>> {
    return this.store.claimBatch(limit);
  }
}
