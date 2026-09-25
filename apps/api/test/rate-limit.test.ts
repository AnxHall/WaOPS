/**
 * HARD MISSION 05 — Distributed rate limiter unit tests (live Redis).
 * Covers: allow under capacity, 429 + headers + Retry-After, continuous
 * refill, per-tenant isolation (bucket key = tenant id), IP fallback for
 * pre-auth requests, fail-open and fail-closed on Redis outage.
 */
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { resetConfigCache } from '@waops/config';
import { runWithTenantContext, type TenantContext } from '@waops/tenancy';
import { RateLimitMiddleware, RATE_LIMIT_PRESETS, TOKEN_BUCKET_LUA, type RateLimitOptions } from '../src/middleware/rate-limit.middleware.js';
import { ApiError } from '../src/errors.js';

// The middleware reads REDIS_URL via loadConfig() at construction; env must
// exist before module import (vi.hoisted runs before the import statements).
vi.hoisted(() => {
  process.env.REDIS_URL ??= 'redis://localhost:6379';
  process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/waops';
  process.env.JWT_SECRET ??= '0'.repeat(32);
  process.env.ENCRYPTION_MASTER_KEY ??= 'a'.repeat(64);
});

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

/** Stub of the express request/response surface used by the middleware. */
function makeReqRes(ip = '203.0.113.9'): {
  req: { ip: string; headers: Record<string, string> };
  res: { headers: Map<string, unknown>; setHeader: (k: string, v: unknown) => void };
} {
  const headers = new Map<string, unknown>();
  return {
    req: { ip, headers: {} },
    res: {
      headers,
      // express coerces header values to strings on the wire
      setHeader: (k: string, v: unknown) => void headers.set(k, String(v)),
    },
  };
}

function makeCtx(tenantId: string): TenantContext {
  return {
    userId: 'usr_rl_test',
    tenantId,
    organizationScope: null,
    permissions: new Set(['hosts.read']),
    entitlements: new Set(),
    requestId: 'req_rl_test',
    actorType: 'user',
  };
}

function makeMiddleware(options: Partial<RateLimitOptions> = {}): RateLimitMiddleware {
  return new RateLimitMiddleware({
    routeClass: 'test',
    capacity: 3,
    windowMs: 60_000,
    ...options,
  });
}

/** The middleware connects lazily in the background; tests must await it. */
async function waitReady(mw: RateLimitMiddleware): Promise<void> {
  const client = (mw as unknown as { redis: Redis | null }).redis;
  if (!client) throw new Error('middleware has no redis client (config missing?)');
  for (let i = 0; i < 100; i++) {
    if (client.status === 'ready') return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`redis client not ready (status=${client.status})`);
}

/** The middleware's express types; unit tests pass minimal stubs. */
const asReq = (r: unknown): Request => r as Request;
const asRes = (r: unknown): Response => r as Response;
const asNext = (n: () => void): NextFunction => n as NextFunction;

/** drain: consume `n` tokens, return the headers of the last attempt. */
async function drain(mw: RateLimitMiddleware, ctx: TenantContext | null, n: number, ip = '203.0.113.9'): Promise<{ status: number | null; headers: Map<string, unknown> }> {
  let last: { status: number | null; headers: Map<string, unknown> } = { status: null, headers: new Map() };
  for (let i = 0; i < n; i++) {
    const { req, res } = makeReqRes(ip);
    try {
      if (ctx) await runWithTenantContext(ctx, () => mw.use(asReq(req), asRes(res), asNext(() => undefined)));
      else await mw.use(asReq(req), asRes(res), asNext(() => undefined));
      last = { status: null, headers: res.headers };
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      last = { status: err.status, headers: res.headers };
    }
  }
  return last;
}

// Redis instance used to simulate outage (block via firewall, we just break
// the client by corrupting its connection config).
let redisForCleanup: Redis;

beforeAll(() => {
  redisForCleanup = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
});

afterAll(async () => {
  await redisForCleanup.quit().catch(() => undefined);
});

beforeEach(async () => {
  await redisForCleanup.eval("for _, k in ipairs(redis.call('keys', 'rl:test:*')) do redis.call('del', k) end", 0);
});

describe('RATE_LIMIT_PRESETS', () => {
  it('matches the mission policy', () => {
    expect(RATE_LIMIT_PRESETS.auth.capacity).toBe(10);
    expect(RATE_LIMIT_PRESETS.api.capacity).toBe(120);
    expect(RATE_LIMIT_PRESETS.realtime.capacity).toBe(30);
  });
});

describe('TOKEN_BUCKET_LUA', () => {
  it('refills continuously from initial state', async () => {
    const key = 'rl:test:lua-unit';
    // capacity 10, refill 1/1000ms, spend 4
    const r1 = (await redisForCleanup.eval(TOKEN_BUCKET_LUA, 1, key, 10, 0.001, Date.now(), 4)) as [number, number, number];
    expect(r1[0]).toBe(1);
    expect(r1[1]).toBe(6);
    // elapsed=50ms → +0.05 tokens → floor still 6 → spend 1 → 5
    await new Promise((r) => setTimeout(r, 55));
    const r2 = (await redisForCleanup.eval(TOKEN_BUCKET_LUA, 1, key, 10, 0.001, Date.now(), 1)) as [number, number, number];
    expect(r2[0]).toBe(1);
    expect(r2[1]).toBe(5);
    await redisForCleanup.del(key);
  });
});

describe('RateLimitMiddleware', () => {
  it('allows requests under capacity and reports remaining', async () => {
    const mw = makeMiddleware({ capacity: 3, windowMs: 60_000 });
    await waitReady(mw);
    const ctx = makeCtx('ten_rl_a');
    const result = await drain(mw, ctx, 3);
    expect(result.status).toBeNull(); // all allowed
    expect(result.headers.get('RateLimit-Limit')).toBe('3');
    expect(result.headers.get('RateLimit-Remaining')).toBe('0');
    expect(result.headers.get('RateLimit-Reset')).toBe('0');
  });

  it('returns 429 rate_limited with Retry-After when the bucket empties', async () => {
    const mw = makeMiddleware({ capacity: 2, windowMs: 60_000 });
    await waitReady(mw);
    const ctx = makeCtx('ten_rl_b');
    await drain(mw, ctx, 2);
    const blocked = await drain(mw, ctx, 1);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('RateLimit-Remaining')).toBe('0');
    expect(Number(blocked.headers.get('RateLimit-Reset'))).toBeGreaterThan(0);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('refills tokens continuously (small wait restores budget)', async () => {
    const mw = makeMiddleware({ capacity: 2, windowMs: 4_000 }); // 0.5 tokens/s
    await waitReady(mw);
    const ctx = makeCtx('ten_rl_c');
    await drain(mw, ctx, 2);
    const blocked = await drain(mw, ctx, 1);
    expect(blocked.status).toBe(429);
    // wait for ≥1 token: ~2000ms + margin
    await new Promise((r) => setTimeout(r, 2400));
    const ok = await drain(mw, ctx, 1);
    expect(ok.status).toBeNull();
  }, 10_000);

  it('isolates buckets per tenant', async () => {
    const mw = makeMiddleware({ capacity: 2, windowMs: 60_000 });
    await waitReady(mw);
    const a = makeCtx('ten_rl_iso_a');
    const b = makeCtx('ten_rl_iso_b');
    await drain(mw, a, 2); // exhaust tenant A
    const aBlocked = await drain(mw, a, 1);
    const bStillOk = await drain(mw, b, 1);
    expect(aBlocked.status).toBe(429);
    expect(bStillOk.status).toBeNull(); // B unaffected
    expect(bStillOk.headers.get('RateLimit-Remaining')).toBe('1');
  });

  it('falls back to req.ip for pre-auth requests (no tenant context)', async () => {
    const mw = makeMiddleware({ capacity: 1, windowMs: 60_000, routeClass: 'test' });
    await waitReady(mw);
    await drain(mw, null, 1, '198.51.100.7');
    const blocked = await drain(mw, null, 1, '198.51.100.7');
    const otherOk = await drain(mw, null, 1, '198.51.100.8');
    expect(blocked.status).toBe(429);
    expect(otherOk.status).toBeNull(); // different IP → different bucket
  });

  it('fails OPEN when Redis is unreachable (default mode)', async () => {
    const prevMode = process.env.RATE_LIMIT_FAILURE_MODE;
    delete process.env.RATE_LIMIT_FAILURE_MODE;
    resetConfigCache();
    try {
      const mw = makeMiddleware({ capacity: 1, windowMs: 60_000 });
      // Simulate outage: force the lazy connection to a dead endpoint.
      (mw as unknown as { redis: Redis }).redis.disconnect();
      const dead = new Redis('redis://127.0.0.1:1/15', {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 300,
        retryStrategy: () => null,
      });
      dead.on('error', () => undefined);
      void dead.connect().catch(() => undefined);
      // Swap in the dead client so eval() rejects.
      const original = (mw as unknown as { redis: Redis }).redis;
      (mw as unknown as { redis: Redis }).redis = dead;
      // give the dead client a beat to be in "connecting" state
      await new Promise((r) => setTimeout(r, 50));
      const { req, res } = makeReqRes();
      const next = vi.fn();
      await runWithTenantContext(makeCtx('ten_rl_failopen'), () => mw.use(asReq(req), asRes(res), asNext(next)));
      expect(next).toHaveBeenCalledTimes(1); // passed through, not blocked
      await dead.quit().catch(() => undefined);
      void original;
    } finally {
      if (prevMode !== undefined) process.env.RATE_LIMIT_FAILURE_MODE = prevMode;
      else delete process.env.RATE_LIMIT_FAILURE_MODE;
      resetConfigCache();
    }
  });

  it('fails CLOSED with 503 when RATE_LIMIT_FAILURE_MODE=closed and Redis is unreachable', async () => {
    process.env.RATE_LIMIT_FAILURE_MODE = 'closed';
    resetConfigCache();
    try {
      const mw = makeMiddleware({ capacity: 1, windowMs: 60_000 });
      const dead = new Redis('redis://127.0.0.1:1/15', {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 300,
        retryStrategy: () => null,
      });
      dead.on('error', () => undefined);
      void dead.connect().catch(() => undefined);
      (mw as unknown as { redis: Redis }).redis = dead;
      await new Promise((r) => setTimeout(r, 50));
      const { req, res } = makeReqRes();
      await expect(
        runWithTenantContext(makeCtx('ten_rl_failclosed'), () => mw.use(asReq(req), asRes(res), asNext(() => undefined))),
      ).rejects.toMatchObject({
        code: 'dependency_unavailable',
        status: 503,
      });
      await dead.quit().catch(() => undefined);
    } finally {
      delete process.env.RATE_LIMIT_FAILURE_MODE;
      resetConfigCache();
    }
  });

  it('uses distinct route classes as separate buckets for the same tenant', async () => {
    const api = makeMiddleware({ routeClass: 'api', capacity: 1, windowMs: 60_000 });
    const auth = makeMiddleware({ routeClass: 'auth', capacity: 1, windowMs: 60_000 });
    await waitReady(api);
    await waitReady(auth);
    // unique tenant: rl:api/auth:* buckets are outside the rl:test:* cleanup
    const ctx = makeCtx(`ten_rl_routes_${randomUUID().slice(0, 8)}`);
    await drain(api, ctx, 1);
    const apiBlocked = await drain(api, ctx, 1);
    const authOk = await drain(auth, ctx, 1);
    expect(apiBlocked.status).toBe(429);
    expect(authOk.status).toBeNull();
  });
});
