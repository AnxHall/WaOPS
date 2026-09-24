import { requireTenantContext } from '@waops/tenancy';

/** Structured authorization error (error-model.md: permission_denied). */
export class PermissionDeniedError extends Error {
  readonly code = 'PERMISSION_DENIED';
  readonly requiredPermission: string;
  constructor(requiredPermission: string) {
    super(`missing permission: ${requiredPermission}`);
    this.requiredPermission = requiredPermission;
  }
}

/**
 * Backend authorization — deny by default. Permissions always come from the
 * authenticated TenantContext (never from client input).
 */
export class PermissionService {
  /** Single-permission check against an explicit permission set. */
  has(permissions: ReadonlySet<string>, required: string): boolean {
    return permissions.has(required);
  }

  /** All-of check. */
  hasAll(permissions: ReadonlySet<string>, required: readonly string[]): boolean {
    return required.every((p) => permissions.has(p));
  }

  /** Any-of check (useful for UI alternates). */
  hasAny(permissions: ReadonlySet<string>, required: readonly string[]): boolean {
    return required.some((p) => permissions.has(p));
  }

  /** Authorize from ambient TenantContext; throws PermissionDeniedError. */
  authorize(required: string): void {
    const ctx = requireTenantContext();
    if (!ctx.permissions.has(required)) {
      throw new PermissionDeniedError(required);
    }
  }

  /** Authorize any-of from ambient TenantContext. */
  authorizeAny(required: readonly string[]): void {
    const ctx = requireTenantContext();
    if (!required.some((p) => ctx.permissions.has(p))) {
      throw new PermissionDeniedError(required.join('|'));
    }
  }
}

export const permissionService = new PermissionService();

/** Namespace helper: 'incidents.read' → 'incidents.*'. */
export function permissionNamespace(key: string): string {
  return `${key.split('.')[0]}.`;
}
