import { describe, expect, it } from 'vitest';
import {
  correlationStorage,
  getCorrelationLogger,
  getOrCreateRequestId,
  withCorrelation,
} from '../src/index.js';

describe('request id', () => {
  it('generates req_ id when absent', () => {
    expect(getOrCreateRequestId()).toMatch(/^req_/);
  });

  it('accepts valid incoming id', () => {
    expect(getOrCreateRequestId('abc-123def')).toBe('abc-123def');
  });

  it('rejects malformed incoming id', () => {
    const id = getOrCreateRequestId('bad id with spaces!!');
    expect(id).toMatch(/^req_/);
  });
});

describe('correlation storage', () => {
  it('propagates context across awaits', async () => {
    const seen: string[] = [];
    await withCorrelation({ requestId: 'req_test1', tenantId: 'ten_a' }, async () => {
      await Promise.resolve();
      seen.push(correlationStorage.getStore()?.requestId ?? 'none');
      await new Promise((r) => setTimeout(r, 1));
      seen.push(correlationStorage.getStore()?.requestId ?? 'none');
    });
    expect(seen).toEqual(['req_test1', 'req_test1']);
  });

  it('is empty outside context', () => {
    expect(correlationStorage.getStore()).toBeUndefined();
  });

  it('correlation logger includes tenant binding', async () => {
    await withCorrelation({ requestId: 'req_x', tenantId: 'ten_t' }, () => {
      const logger = getCorrelationLogger();
      expect(logger).toBeDefined();
      expect(correlationStorage.getStore()?.tenantId).toBe('ten_t');
    });
  });
});
