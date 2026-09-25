import { getPrisma } from '@waops/db';
import { runTenantJob } from '@waops/tenancy';
import { getCorrelationLogger } from '@waops/observability';
import type { EventEnvelopeV1 } from '@waops/contracts';

/**
 * Incident engine foundation: open-with-dedup (fingerprint), append-only
 * timeline. Runs inside explicit tenant job scope (jobs-workers.md).
 */
export class IncidentService {
  /** Opens (or reuses open) incident for a fingerprint within the tenant. */
  async openFromEvent(envelope: EventEnvelopeV1): Promise<{ incidentId: string; deduped: boolean }> {
    const prisma = getPrisma();
    const logger = getCorrelationLogger();

    if (!envelope.fingerprint) {
      // Events without fingerprint do not open incidents (catalog design).
      logger.debug({ event_id: envelope.event_id }, 'event without fingerprint; no incident');
      return { incidentId: '', deduped: false };
    }

    const open = await prisma.incident.findFirst({
      where: {
        tenantId: envelope.tenant_id,
        fingerprint: envelope.fingerprint,
        status: { notIn: ['resolved', 'closed'] },
      },
    });
    if (open) {
      // dedup: link event to existing incident; timeline entry notes recurrence
      await prisma.incidentEvent.create({
        data: {
          incidentId: open.id,
          eventId: envelope.event_id,
          tenantId: envelope.tenant_id,
        },
      }).catch(async () => {
        // incident_events unique (incident, event) — event already linked
        logger.debug({ event_id: envelope.event_id }, 'event already linked to incident');
      });
      await prisma.incidentTimelineEntry.create({
        data: {
          tenantId: envelope.tenant_id,
          incidentId: open.id,
          entryType: 'event_recurred',
          actorType: 'system',
          payloadJson: { event_id: envelope.event_id },
        },
      });
      return { incidentId: open.id, deduped: true };
    }

    const typeDef = envelope.event_type;
    const created = await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          tenantId: envelope.tenant_id,
          title: `${typeDef} on ${envelope.resource_id ?? 'resource'}`,
          severity: envelope.severity,
          status: 'detected',
          primaryResourceId: envelope.resource_id,
          fingerprint: envelope.fingerprint,
        },
      });
      await tx.incidentEvent.create({
        data: {
          incidentId: incident.id,
          eventId: envelope.event_id,
          tenantId: envelope.tenant_id,
        },
      });
      await tx.incidentTimelineEntry.create({
        data: {
          tenantId: envelope.tenant_id,
          incidentId: incident.id,
          entryType: 'created',
          actorType: 'system',
          payloadJson: { event_id: envelope.event_id, source: envelope.source },
        },
      });
      return incident;
    });
    logger.info({ incident_id: created.id, tenant_id: envelope.tenant_id }, 'incident opened');
    return { incidentId: created.id, deduped: false };
  }
}

/** Convenience wrapper that runs inside tenant job scope. */
export async function openIncidentForTenant(
  tenantId: string,
  envelope: EventEnvelopeV1,
): Promise<{ incidentId: string; deduped: boolean }> {
  return runTenantJob(tenantId, async () => new IncidentService().openFromEvent(envelope));
}
