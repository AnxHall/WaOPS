import { describe, expect, it } from 'vitest';
import { EventEnvelopeV1 } from '@waops/contracts';
import { InMemoryEventPublisher } from '../src/publisher.js';

function envelope(overrides: Partial<Record<string, unknown>> = {}) {
  return EventEnvelopeV1.parse({
    event_id: 'evt_1',
    schema_version: 1,
    tenant_id: 'ten_1',
    source: 'incident-engine',
    source_type: 'engine',
    resource_id: null,
    event_type: 'container.down',
    severity: 'high',
    fingerprint: null,
    observed_at: '2026-09-24T12:00:00.000Z',
    received_at: '2026-09-24T12:00:00.000Z',
    attributes: {},
    correlation_id: null,
    trace_id: null,
    ...overrides,
  });
}

describe('InMemoryEventPublisher', () => {
  it('records published envelopes in order', async () => {
    const pub = new InMemoryEventPublisher();
    await pub.publish(envelope({ event_id: 'evt_a' }));
    await pub.publish(envelope({ event_id: 'evt_b' }));
    expect(pub.published.map((e) => e.event_id)).toEqual(['evt_a', 'evt_b']);
  });
});
