import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * TenantContext (tenant-enforcement.md): every authenticated application
 * request resolves this context. tenant_id is ALWAYS derived from the
 * authenticated principal — never accepted from client-controlled fields.
 */
export interface TenantContext {
  userId: string;
  tenantId: string;
  organizationScope: string | null;
  permissions: ReadonlySet<string>;
  entitlements: ReadonlySet<string>;
  requestId: string;
  actorType: 'user' | 'agent' | 'system';
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStorage.run(ctx, fn);
}

export async function runWithTenantContextAsync<T>(ctx: TenantContext, fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run(ctx, fn);
}
export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

/** Strict accessor — repository/service code requires the context. */
export function requireTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) {
    throw new Error('TenantContext missing: operation must run inside an authenticated request scope');
  }
  return ctx;
}

/** Current tenant id or throws (repository rule: explicit, non-null tenant). */
export function requireTenantId(): string {
  return requireTenantContext().tenantId;
}

/** Guard for background jobs: tenant id must be part of the validated job envelope. */
export function runTenantJob<T>(tenantId: string, fn: (ctx: TenantContext) => Promise<T>): Promise<T> {
  const jobCtx: TenantContext = {
    userId: 'system',
    tenantId,
    organizationScope: null,
    permissions: new Set<string>(),
    entitlements: new Set<string>(),
    requestId: `job_${tenantId}`,
    actorType: 'system',
  };
  return tenantStorage.run(jobCtx, () => fn(jobCtx));
}

/**
 * Tenant-scoped repository helper: every query builder must pass through a
 * scope that requires an explicit non-null tenant id (never ambient trust).
 */
export function tenantScope(tenantId: string | undefined | null): string {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenant-scoped query requires explicit non-null tenantId');
  }
  return tenantId;
}
