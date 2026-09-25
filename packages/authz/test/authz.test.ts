import { describe, expect, it } from 'vitest';
import { runWithTenantContext } from '@waops/tenancy';
import { PermissionDeniedError, PermissionService, permissionNamespace } from '../src/index.js';

const svc = new PermissionService();

function runAs(permissions: string[], fn: () => void): void {
  runWithTenantContext(
    {
      userId: 'usr_1',
      tenantId: 'ten_a',
      organizationScope: null,
      permissions: new Set(permissions),
      entitlements: new Set<string>(),
      requestId: 'req_1',
      actorType: 'user',
    },
    fn,
  );
}

describe('PermissionService', () => {
  it('grants when permission present', () => {
    runAs(['incidents.read'], () => expect(() => svc.authorize('incidents.read')).not.toThrow());
  });

  it('denies by default when permission absent', () => {
    runAs(['incidents.read'], () =>
      expect(() => svc.authorize('incidents.resolve')).toThrow(PermissionDeniedError),
    );
  });

  it('denies empty permission set (deny-by-default)', () => {
    runAs([], () => expect(() => svc.authorize('hosts.read')).toThrow(PermissionDeniedError));
  });

  it('hasAll requires every permission', () => {
    runAs(['a', 'b'], () => {
      expect(svc.hasAll(new Set(['a', 'b']), ['a', 'b'])).toBe(true);
      expect(svc.hasAll(new Set(['a']), ['a', 'b'])).toBe(false);
    });
  });

  it('hasAny passes with at least one', () => {
    expect(svc.hasAny(new Set(['x']), ['x', 'y'])).toBe(true);
    expect(svc.hasAny(new Set(['z']), ['x', 'y'])).toBe(false);
  });

  it('authorizeAny denies when none present', () => {
    runAs(['a'], () => expect(() => svc.authorizeAny(['x', 'y'])).toThrow(PermissionDeniedError));
  });

  it('namespace helper', () => {
    expect(permissionNamespace('incidents.read')).toBe('incidents.');
  });
});
