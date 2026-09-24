import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import pino from 'pino';

/** Correlation context carried by ALS through the whole request/await chain. */
export interface CorrelationContext {
  requestId: string;
  tenantId?: string;
  actorType?: 'user' | 'agent' | 'system';
  actorId?: string;
  correlationId?: string;
}

export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/** Accepts incoming X-Request-Id or generates one (request/correlation foundation). */
export function getOrCreateRequestId(incoming?: string | string[]): string {
  const first = Array.isArray(incoming) ? incoming[0] : incoming;
  if (first && /^[\w-]{8,64}$/.test(first)) return first;
  return `req_${randomUUID()}`;
}

const REDACT_PATHS = [
  'password',
  'password_hash',
  'token',
  'refresh_token',
  'authorization',
  'cookie',
  'secret',
  'credential',
  'api_key',
  'enrollment_token',
  'agent_credential',
  'smtp_password',
  'jwt_secret',
  '*.password',
  '*.token',
  '*.secret',
  '*.credential',
];

let rootLogger: pino.Logger | null = null;

export function createLogger(opts?: { level?: string; name?: string }): pino.Logger {
  rootLogger = pino({
    name: opts?.name ?? 'waops',
    level: opts?.level ?? 'info',
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    base: undefined,
  });
  return rootLogger;
}

export function getRootLogger(): pino.Logger {
  if (!rootLogger) return createLogger();
  return rootLogger;
}

/** Returns a child logger bound to the current correlation context. */
export function getCorrelationLogger(): pino.Logger {
  const ctx = correlationStorage.getStore();
  const base = getRootLogger();
  if (!ctx) return base;
  return base.child({
    request_id: ctx.requestId,
    ...(ctx.tenantId ? { tenant_id: ctx.tenantId } : {}),
    ...(ctx.actorType ? { actor_type: ctx.actorType } : {}),
    ...(ctx.actorId ? { actor_id: ctx.actorId } : {}),
    ...(ctx.correlationId ? { correlation_id: ctx.correlationId } : {}),
  });
}

/** Runs fn with a correlation context (used by middleware and workers). */
export async function withCorrelation<T>(
  ctx: CorrelationContext,
  fn: () => Promise<T>,
): Promise<T> {
  return correlationStorage.run(ctx, fn);
}

/** Current correlation context (or undefined outside of one). */
export function currentCorrelation(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}
