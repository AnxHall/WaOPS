import { describe, expect, it } from 'vitest';
import {
  getTenantContext,
  requireTenantContext,
  requireTenantId,
  runTenantJob,
  runWithTenantContext,
  runWithTenantContextAsync,
  tenantScope,
} from '../src/index.js';

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'usr_1',
    tenantId: 'ten_a',
    organizationScope: null,
    permissions: new Set(['incidents.read']),
    entitlements: new Set(['wamonitor.host_monitoring']),
    requestId: 'req_1',
    actorType: 'user' as const,
    ...overrides,
  };
}

describe('TenantContext', () => {
  it('propagates across awaits', async () => {
    await runWithTenantContextAsync(makeCtx(), async () => {
      await new Promise((r) => setTimeout(r, 1));
      expect(getTenantContext()?.tenantId).toBe('ten_a');
    });
  });

  it('isolates nested sibling scopes', () => {
    runWithTenantContext(makeCtx({ tenantId: 'ten_a' }), () => {
      expect(requireTenantId()).toBe('ten_a');
    });
    runWithTenantContext(makeCtx({ tenantId: 'ten_b' }), () => {
      expect(requireTenantId()).toBe('ten_b');
    });
  });
});

describe('requireTenantContext', () => {
  it('throws outside of context', () => {
    expect(() => requireTenantContext()).toThrow(/TenantContext missing/);
    expect(() => requireTenantId()).toThrow(/TenantContext missing/);
  });

  it('returns context inside scope', () => {
    runWithTenantContext(makeCtx(), () => {
      expect(requireTenantId()).toBe('ten_a');
      expect(requireTenantContext().permissions.has('incidents.read')).toBe(true);
    });
  });
});

describe('tenantScope', () => {
  it('rejects null/undefined tenant', () => {
    expect(() => tenantScope(null)).toThrow(/explicit non-null tenantId/);
    expect(() => tenantScope(undefined)).toThrow(/explicit non-null tenantId/);
    expect(tenantScope('ten_a')).toBe('ten_a');
  });
});

describe('runTenantJob', () => {
  it('creates system context with explicit tenant', async () => {
    const seen = await runTenantJob('ten_b', async (jobCtx) => {
      expect(jobCtx.tenantId).toBe('ten_b');
      expect(jobCtx.actorType).toBe('system');
      await new Promise((r) => setTimeout(r, 1));
      return getTenantContext()?.tenantId;
    });
    expect(seen).toBe('ten_b');
  });
});
