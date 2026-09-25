import { describe, expect, it } from 'vitest';
import { composeFingerprint } from '../src/fingerprint.js';

describe('composeFingerprint', () => {
  it('is deterministic for same inputs', () => {
    const a = composeFingerprint('tenant_host_container', {
      tenantId: 't1',
      hostId: 'h1',
      containerId: 'c1',
    });
    const b = composeFingerprint('tenant_host_container', {
      tenantId: 't1',
      hostId: 'h1',
      containerId: 'c1',
    });
    expect(a).toBe(b);
    expect(a.startsWith('sha256:')).toBe(true);
  });

  it('differs across tenants with same host/container', () => {
    const a = composeFingerprint('tenant_host_container', { tenantId: 't1', hostId: 'h1', containerId: 'c1' });
    const b = composeFingerprint('tenant_host_container', { tenantId: 't2', hostId: 'h1', containerId: 'c1' });
    expect(a).not.toBe(b);
  });

  it('differs across rules', () => {
    const a = composeFingerprint('tenant_host', { tenantId: 't1', hostId: 'h1' });
    const b = composeFingerprint('tenant_host_container', { tenantId: 't1', hostId: 'h1' });
    expect(a).not.toBe(b);
  });
});
