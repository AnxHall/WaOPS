/** WaAgent protocol contracts v1 — mirrors contracts/agent/*.schema.json (ADR-007). */
import { z } from 'zod';

export const AGENT_PROTOCOL_VERSION = 1 as const;

export const HeartbeatV1 = z.object({
  protocol_version: z.literal(1),
  agent_id: z.string().min(1).max(128),
  agent_version: z.string().min(1).max(64),
  sent_at: z.string().datetime(),
  uptime_seconds: z.number().int().min(0).optional(),
  clock_offset_ms: z.number().int().finite().optional(),
  buffer_bytes: z.number().int().min(0).optional(),
  capabilities: z.array(z.string().max(64)).max(32).optional(),
});
export type HeartbeatV1 = z.infer<typeof HeartbeatV1>;

export const MetricSampleV1 = z.object({
  metric: z.string().min(1).max(128),
  resource_id: z.string().min(1).max(256),
  observed_at: z.string().datetime(),
  // finite: NaN/Infinity are rejected (protocol attack surface, §16)
  value: z.number().finite(),
  // bounded dimensions (§37 high cardinality): max 16 keys, keys ≤64 chars,
  // values ≤256 chars (numbers/strings/bool only via deep partial record)
  dimensions: z
    .record(z.union([z.string().max(256), z.number().finite(), z.boolean()]))
    .refine((d) => Object.keys(d).length <= 16, 'too many dimensions')
    .refine((d) => Object.keys(d).every((k) => k.length <= 64), 'dimension key too long')
    .optional(),
});
export type MetricSampleV1 = z.infer<typeof MetricSampleV1>;

export const MetricsBatchV1 = z.object({
  protocol_version: z.literal(1),
  agent_id: z.string().min(1),
  sequence: z.number().int().min(0),
  samples: z.array(MetricSampleV1).max(5000),
});
export type MetricsBatchV1 = z.infer<typeof MetricsBatchV1>;

/** Server ack — allows agent local buffer deletion (WAAGENT_PROTOCOL_V1.md). */
export const MetricsAckV1 = z.object({
  protocol_version: z.literal(1),
  agent_id: z.string().min(1),
  acked_sequence: z.number().int().min(0),
});
export type MetricsAckV1 = z.infer<typeof MetricsAckV1>;

export const AgentCapability = z.enum([
  'host.linux',
  'host.windows',
  'docker',
  'postgres',
  'mysql',
]);
export type AgentCapability = z.infer<typeof AgentCapability>;
