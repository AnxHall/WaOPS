import { getPrisma } from '@waops/db';
import { getCorrelationLogger } from '@waops/observability';
import { runTenantJob } from '@waops/tenancy';
import type { EventEnvelopeV1 } from '@waops/contracts';
import type { EventPublisher } from '@waops/events';

/**
 * Outbox dispatcher (transactions-and-outbox.md): claim pending batch,
 * publish via publisher abstraction, mark sent. Retries with attempts cap;
 * DLQ equivalent = status 'failed' after max attempts (operator-visible).
 */
export class OutboxDispatcher {
  constructor(
    private readonly publisher: EventPublisher,
    private readonly batchSize = 50,
    private readonly maxAttempts = 10,
  ) {}

  async tick(): Promise<number> {
    const prisma = getPrisma();
    const logger = getCorrelationLogger();
    const now = new Date();

    const batch = await prisma.$queryRawUnsafe<
      Array<{ id: string; tenant_id: string; event_id: string; payload_json: unknown; attempts: number }>
    >(
      `UPDATE outbox_events SET attempts = attempts + 1
       WHERE id IN (
         SELECT id FROM outbox_events
         WHERE status = 'pending' AND available_at <= $1
         ORDER BY created_at
         LIMIT $2
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, tenant_id, event_id, payload_json, attempts`,
      now,
      this.batchSize,
    );

    if (batch.length === 0) return 0;

    const sentIds: string[] = [];
    const failedIds: string[] = [];
    for (const row of batch) {
      const envelope = row.payload_json as EventEnvelopeV1;
      try {
        await runTenantJob(row.tenant_id, async () => this.publisher.publish(envelope));
        sentIds.push(row.id);
      } catch (err) {
        logger.error({ err, event_id: row.event_id }, 'outbox publish failed');
        if (row.attempts >= this.maxAttempts) failedIds.push(row.id);
      }
    }

    if (sentIds.length > 0) {
      await prisma.outboxEvent.updateMany({
        where: { id: { in: sentIds } },
        data: { status: 'sent', sentAt: new Date() },
      });
    }
    if (failedIds.length > 0) {
      await prisma.outboxEvent.updateMany({
        where: { id: { in: failedIds } },
        data: { status: 'failed' }, // DLQ-equivalent, never auto-reprocessed forever
      });
    }
    return sentIds.length;
  }
}
