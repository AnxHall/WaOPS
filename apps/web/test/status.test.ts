import { describe, expect, it } from 'vitest';
import {
  badgeClass,
  incidentStatusTone,
  isStale,
  relativeTime,
  resourceStatusTone,
  severityTone,
} from '../src/lib/status';

describe('status language (designer.md §2.3/§4.8)', () => {
  it('maps incident severity to canonical tones', () => {
    expect(severityTone('critical')).toBe('critical');
    expect(severityTone('high')).toBe('warning'); // high compartilha matiz, label diferencia
    expect(severityTone('warning')).toBe('warning');
    expect(severityTone('info')).toBe('info');
    expect(severityTone('unknown')).toBe('neutral');
  });

  it('maps incident status to tones (resolved = neutral gray per designer.md §6.3)', () => {
    expect(incidentStatusTone('resolved')).toBe('neutral');
    expect(incidentStatusTone('acknowledged')).toBe('info');
    expect(incidentStatusTone('detected')).toBe('critical');
  });

  it('maps resource status to tones', () => {
    expect(resourceStatusTone('online')).toBe('ok');
    expect(resourceStatusTone('degraded')).toBe('warning');
    expect(resourceStatusTone('down')).toBe('critical');
    expect(resourceStatusTone(null)).toBe('neutral');
  });

  it('badge class always pairs tone with textual label (not color-only)', () => {
    expect(badgeClass('ok')).toBe('badge ok');
  });
});

describe('staleness & relative time', () => {
  it('fresh sample (<5min) is not stale', () => {
    expect(isStale(new Date(Date.now() - 30_000).toISOString())).toBe(false);
  });

  it('old sample (>5min) is stale; missing sample is stale', () => {
    expect(isStale(new Date(Date.now() - 10 * 60_000).toISOString())).toBe(true);
    expect(isStale(null)).toBe(true);
    expect(isStale('not-a-date')).toBe(true);
  });

  it('relativeTime is human and never NaN', () => {
    expect(relativeTime(null)).toBe('nunca');
    expect(relativeTime('not-a-date')).toBe('—');
    expect(relativeTime(new Date(Date.now() - 30_000).toISOString())).toMatch(/s atrás$/);
    expect(relativeTime(new Date(Date.now() - 5 * 60_000).toISOString())).toMatch(/min atrás$/);
    expect(relativeTime(new Date(Date.now() - 3 * 3600_000).toISOString())).toMatch(/h atrás$/);
  });
});
