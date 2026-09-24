import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { EventEnvelopeV1, PERMISSION_KEYS_V1 } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

function loadSchema(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(repoRoot, rel), 'utf8'));
}

describe('event envelope parity (ADR-007)', () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const validateJsonSchema = ajv.compile(loadSchema('contracts/events/event-envelope.v1.schema.json'));

  const base = {
    event_id: 'evt_01J9TEST',
    schema_version: 1,
    tenant_id: 'ten_01J9TEST',
    source: 'waagent',
    source_type: 'agent',
    resource_id: null,
    event_type: 'container.down',
    severity: 'high',
    observed_at: '2026-09-24T12:00:00.000Z',
    received_at: '2026-09-24T12:00:01.000Z',
    attributes: {},
    correlation_id: null,
    trace_id: null,
    fingerprint: null,
  };

  it('json schema and zod accept a valid envelope', () => {
    expect(validateJsonSchema(base)).toBe(true);
    expect(() => EventEnvelopeV1.parse(base)).not.toThrow();
  });

  it('both reject severity outside enum', () => {
    const bad = { ...base, severity: 'apocalyptic' };
    expect(validateJsonSchema(bad)).toBe(false);
    expect(EventEnvelopeV1.safeParse(bad).success).toBe(false);
  });

  it('both reject schema_version != 1', () => {
    const bad = { ...base, schema_version: 2 };
    expect(validateJsonSchema(bad)).toBe(false);
    expect(EventEnvelopeV1.safeParse(bad).success).toBe(false);
  });

  it('both reject missing tenant_id', () => {
    const withoutTenant: Record<string, unknown> = { ...base };
    delete withoutTenant.tenant_id;
    expect(validateJsonSchema(withoutTenant)).toBe(false);
    expect(EventEnvelopeV1.safeParse(withoutTenant).success).toBe(false);
  });

  it('both reject additional properties', () => {
    const bad = { ...base, extra: true };
    expect(validateJsonSchema(bad)).toBe(false);
    expect(EventEnvelopeV1.safeParse(bad).success).toBe(false);
  });
});

describe('agent contracts parity', () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const hb = ajv.compile(loadSchema('contracts/agent/heartbeat.v1.schema.json'));
  const mb = ajv.compile(loadSchema('contracts/agent/metrics-batch.v1.schema.json'));

  it('heartbeat valid in json schema and zod', () => {
    const body = {
      protocol_version: 1,
      agent_id: 'agt_1',
      agent_version: '0.1.0',
      sent_at: '2026-09-24T12:00:00.000Z',
      uptime_seconds: 120,
      capabilities: ['host.linux', 'docker'],
    };
    expect(hb(body)).toBe(true);
  });

  it('metrics batch valid in json schema and zod', () => {
    const body = {
      protocol_version: 1,
      agent_id: 'agt_1',
      sequence: 7,
      samples: [
        {
          metric: 'host.cpu.usage_percent',
          resource_id: 'res_1',
  observed_at: '2026-09-24T12:00:00.000Z',
          value: 42.5,
          dimensions: { mount: '/' },
        },
      ],
    };
    expect(mb(body)).toBe(true);
  });

  it('metrics batch rejects > 5000 samples (json schema) and zod agrees', () => {
    const sample = {
      metric: 'm',
      resource_id: 'r',
      observed_at: '2026-09-24T12:00:00.000Z',
      value: 1,
    };
    const body = {
      protocol_version: 1,
      agent_id: 'a',
      sequence: 0,
      samples: Array.from({ length: 5001 }, () => sample),
    };
    expect(mb(body)).toBe(false);
  });
});

describe('permissions parity vs yaml contract', () => {
  const yaml = readFileSync(resolve(repoRoot, 'contracts/permissions/permissions.v1.yaml'), 'utf8');

  it('every yaml permission key exists in PERMISSION_KEYS_V1', () => {
    const yamlKeys = [...yaml.matchAll(/^\s+- ([a-z_.]+)$/gm)].map((m) => m[1]);
    expect(yamlKeys.length).toBeGreaterThanOrEqual(30);
    for (const key of yamlKeys) {
      expect(PERMISSION_KEYS_V1, `missing permission: ${key}`).toContain(key as never);
    }
  });
});
