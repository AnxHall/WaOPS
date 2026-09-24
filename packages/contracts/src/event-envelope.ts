import { z } from 'zod';

/**
 * WaOPS Event Envelope v1 — runtime mirror of contracts/events/event-envelope.v1.schema.json
 * (ADR-007: JSON Schema is the source of truth; this zod schema must stay in parity).
 */
export const EVENT_ENVELOPE_SCHEMA_VERSION = 1 as const;

export const EventSeverity = z.enum(['info', 'warning', 'high', 'critical']);
export type EventSeverity = z.infer<typeof EventSeverity>;

export const EventEnvelopeV1 = z
  .object({
    event_id: z.string().min(1),
    schema_version: z.literal(1),
    tenant_id: z.string().min(1),
    source: z.string(),
    source_type: z.string(),
    resource_id: z.string().nullable().optional(),
    event_type: z.string().min(1),
    severity: EventSeverity,
    fingerprint: z.string().nullable().optional(),
    observed_at: z.string().datetime(),
    received_at: z.string().datetime(),
    attributes: z.record(z.unknown()),
    correlation_id: z.string().nullable().optional(),
    trace_id: z.string().nullable().optional(),
  })
  .strict(); // additionalProperties: false in JSON Schema (ADR-007 parity)
export type EventEnvelopeV1 = z.infer<typeof EventEnvelopeV1>;

/** Helper to build a valid envelope with received_at stamped server-side. */
export function buildEventEnvelope(input: {
  eventId: string;
  tenantId: string;
  source: string;
  sourceType: string;
  eventType: string;
  severity: EventSeverity;
  observedAt: Date | string;
  attributes?: Record<string, unknown>;
  resourceId?: string | null;
  fingerprint?: string | null;
  correlationId?: string | null;
  traceId?: string | null;
  receivedAt?: Date | string;
}): EventEnvelopeV1 {
  return EventEnvelopeV1.parse({
    event_id: input.eventId,
    schema_version: EVENT_ENVELOPE_SCHEMA_VERSION,
    tenant_id: input.tenantId,
    source: input.source,
    source_type: input.sourceType,
    resource_id: input.resourceId ?? null,
    event_type: input.eventType,
    severity: input.severity,
    fingerprint: input.fingerprint ?? null,
    observed_at: typeof input.observedAt === 'string' ? input.observedAt : input.observedAt.toISOString(),
    received_at:
      (input.receivedAt ? new Date(input.receivedAt) : new Date()).toISOString(),
    attributes: input.attributes ?? {},
    correlation_id: input.correlationId ?? null,
    trace_id: input.traceId ?? null,
  });
}
