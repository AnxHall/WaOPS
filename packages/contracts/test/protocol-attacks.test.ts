import { describe, expect, it } from 'vitest';
import { HeartbeatV1, MetricsBatchV1 } from '../src/agent-protocol.js';

const baseSample = {
  metric: 'host.cpu.usage_percent',
  resource_id: 'host_abc',
  observed_at: '2026-09-24T12:00:00.000Z',
  value: 42.5,
};

const validBatch = {
  protocol_version: 1,
  agent_id: 'agt_1',
  sequence: 0,
  samples: [baseSample],
};

describe('protocol attacks — metrics batch (§16/§37)', () => {
  it('rejects NaN value', () => {
    const body = { ...validBatch, samples: [{ ...baseSample, value: Number.NaN }] };
    expect(MetricsBatchV1.safeParse(body).success).toBe(false);
  });

  it('rejects Infinity value', () => {
    const body = { ...validBatch, samples: [{ ...baseSample, value: Number.POSITIVE_INFINITY }] };
    expect(MetricsBatchV1.safeParse(body).success).toBe(false);
  });

  it('rejects 1e999 (Infinity via literal)', () => {
    const body = { ...validBatch, samples: [{ ...baseSample, value: 1e999 }] };
    expect(MetricsBatchV1.safeParse(body).success).toBe(false);
  });

  it('rejects invalid timestamp', () => {
    const body = { ...validBatch, samples: [{ ...baseSample, observed_at: 'not-a-date' }] };
    expect(MetricsBatchV1.safeParse(body).success).toBe(false);
  });

  it('rejects negative sequence', () => {
    expect(MetricsBatchV1.safeParse({ ...validBatch, sequence: -1 }).success).toBe(false);
  });

  it('rejects protocol_version 0 and future versions', () => {
    expect(MetricsBatchV1.safeParse({ ...validBatch, protocol_version: 0 }).success).toBe(false);
    expect(MetricsBatchV1.safeParse({ ...validBatch, protocol_version: 2 }).success).toBe(false);
  });

  it('rejects unknown resource id (empty) and oversized metric key', () => {
    expect(MetricsBatchV1.safeParse({ ...validBatch, samples: [{ ...baseSample, resource_id: '' }] }).success).toBe(false);
    expect(MetricsBatchV1.safeParse({ ...validBatch, samples: [{ ...baseSample, metric: 'm'.repeat(129) }] }).success).toBe(false);
  });

  it('rejects >16 dimension keys', () => {
    const dims: Record<string, number> = {};
    for (let i = 0; i < 17; i++) dims[`k${i}`] = i;
    const body = { ...validBatch, samples: [{ ...baseSample, dimensions: dims }] };
    expect(MetricsBatchV1.safeParse(body).success).toBe(false);
  });

  it('rejects oversized dimension key', () => {
    const body = { ...validBatch, samples: [{ ...baseSample, dimensions: { [ 'k'.repeat(65) ]: 1 } }] };
    expect(MetricsBatchV1.safeParse(body).success).toBe(false);
  });

  it('rejects oversized dimension value', () => {
    const body = { ...validBatch, samples: [{ ...baseSample, dimensions: { k: 'v'.repeat(257) } }] };
    expect(MetricsBatchV1.safeParse(body).success).toBe(false);
  });

  it('accepts bounded valid dimensions', () => {
    const body = { ...validBatch, samples: [{ ...baseSample, dimensions: { mount: '/', ok: true, n: 1.5 } }] };
    expect(MetricsBatchV1.safeParse(body).success).toBe(true);
  });

  it('rejects heartbeat with unbounded capabilities list', () => {
    const hb = {
      protocol_version: 1,
      agent_id: 'a',
      agent_version: '1',
      sent_at: '2026-09-24T12:00:00.000Z',
      capabilities: Array.from({ length: 33 }, (_, i) => `c${i}`),
    };
    expect(HeartbeatV1.safeParse(hb).success).toBe(false);
  });
});
