import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { loadConfig } from '@waops/config';
import { getCorrelationLogger } from '@waops/observability';
import { getTenantContext } from '@waops/tenancy';
import { ApiError } from '../errors.js';

/**
 * HARD MISSION 05 — Distributed rate limiting (token bucket per tenant+route).
 *
 * - Atomic via Lua script (capacity + refill + spend in ONE Redis round-trip);
 * - Bucket key: `rl:<route>:<principal>` where principal is the tenant id
 *   (user JWT context) — all requests of a tenant share the per-route budget;
 * - Refill: continuous (capacity tokens per window), not fixed-window bursts;
 * - Response headers: RateLimit-Limit / RateLimit-Remaining / RateLimit-Reset;
 * - 429 with `rate_limited` error code + Retry-After when the bucket is empty;
 * - FAIL-OPEN: if Redis is unavailable the request passes (availability of the
 *   monitoring API outweighs strict limiting in degraded mode; matches the
 *   Redis degradation doctrine from HARD MISSION 02 §19/§20).
 *
 * Note: `last` is a reserved word in Postgres/Timescale (HM04 lesson) — not
 * relevant here, but the same care applies: bucket state lives in Redis, not SQL.
 */

/** routeClass = stable per-route-class bucket (auth / api public surface). */
export interface RateLimitOptions {
  routeClass: string;
  /** Bucket capacity (sustained burst size). */
  capacity: number;
  /** Refill window in ms: capacity is restored over this period. */
  windowMs: number;
  /** Message surfaced on 429. */
  message?: string;
}

/** Per-route-class defaults (HARD MISSION 05 §policy). */
export const RATE_LIMIT_PRESETS: Record<'auth' | 'api' | 'realtime', Omit<RateLimitOptions, 'routeClass'>> = {
  auth: { capacity: 10, windowMs: 60_000, message: 'too many auth attempts' },
  api: { capacity: 120, windowMs: 60_000, message: 'too many requests' },
  realtime: { capacity: 30, windowMs: 60_000, message: 'too many stream (re)connections' },
};

/** Lua: token bucket. Keys: [bucket]; args: [capacity, refill_per_ms, now_ms, cost]. */
export const TOKEN_BUCKET_LUA = `
local capacity = tonumber(ARGV[1])
local refill_per_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local state = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(state[1])
local ts = tonumber(state[2])
if tokens == nil or ts == nil then
  tokens = capacity
  ts = now
end
local elapsed = now - ts
if elapsed < 0 then elapsed = 0 end
tokens = math.min(capacity, tokens + elapsed * refill_per_ms)
local allowed = 0
local remaining = math.floor(tokens)
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
  remaining = math.floor(tokens)
end
redis.call('HMSET', KEYS[1], 'tokens', tokens, 'ts', now)
local ttl_ms = 0
if allowed == 0 then
  local need = cost - tokens
  ttl_ms = math.ceil(need / refill_per_ms)
end
local ttl_s = math.ceil((capacity / refill_per_ms + 60000) / 1000)
redis.call('PEXPIRE', KEYS[1], ttl_s * 1000)
return { allowed, remaining, ttl_ms }
`;

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly redis: Redis | null;
  private readonly failureMode: 'open' | 'closed';

  constructor(private readonly options: RateLimitOptions) {
    let url: string | undefined;
    try {
      url = loadConfig().env.REDIS_URL;
    } catch {
      url = undefined;
    }
    this.failureMode = process.env.RATE_LIMIT_FAILURE_MODE === 'closed' ? 'closed' : 'open';
    if (!url) {
      this.redis = null;
      return;
    }
    // Single connection per middleware instance; lazy so tests and degraded
    // environments do not spin retries at import time. retryStrategy NEVER
    // gives up (capped backoff): if Redis comes up later (dev cold start, infra
    // restart) the limiter must self-heal — meanwhile requests fail-open.
    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      retryStrategy: (times) => Math.min(2000, 100 * times),
    });
    this.redis.on('error', () => {
      /* error events are loud otherwise; degradation is handled per-request */
    });
    void this.redis.connect().catch(() => undefined);
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const logger = getCorrelationLogger();
    const tenantId = getTenantContext()?.tenantId ?? null;

    // Unauthenticated principals: bucket by IP for auth routes (pre-login
    // hammering has no tenant context yet — TenantContext runs before, but
    // signup/refresh may skip a Bearer header entirely).
    const principal = tenantId ?? req.ip ?? 'anonymous';
    const bucketKey = `rl:${this.options.routeClass}:${principal}`;

    let allowed = true;
    let remaining = this.options.capacity;
    let resetMs = 0;

    if (this.redis) {
      try {
        const [ok, rem, waitMs] = (await this.redis.eval(
          TOKEN_BUCKET_LUA,
          1,
          bucketKey,
          this.options.capacity,
          this.options.capacity / this.options.windowMs,
          Date.now(),
          1,
        )) as [number, number, number];
        allowed = ok === 1;
        remaining = rem;
        resetMs = waitMs;
      } catch {
        // Redis unavailable → fail-open (or fail-closed for hardened deploys).
        logger.warn({ route_class: this.options.routeClass }, 'rate limit store unavailable (fail-%s)', this.failureMode);
        if (this.failureMode === 'closed') {
          throw new ApiError('dependency_unavailable', 'rate limit store unavailable', 503);
        }
        allowed = true;
      }
    }

    res.setHeader('RateLimit-Limit', this.options.capacity);
    res.setHeader('RateLimit-Remaining', allowed ? remaining : 0);
    res.setHeader('RateLimit-Reset', Math.max(0, Math.ceil(resetMs / 1000)));
    if (!allowed) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil(resetMs / 1000)));
      throw new ApiError('rate_limited', this.options.message ?? 'too many requests', 429, {
        route_class: this.options.routeClass,
        retry_after_seconds: Math.max(1, Math.ceil(resetMs / 1000)),
      });
    }
    next();
  }
}

/** Factory so Nest can instantiate per route class with distinct options. */
export function makeRateLimitMiddleware(options: RateLimitOptions): { new (): RateLimitMiddleware } {
  return class extends RateLimitMiddleware {
    constructor() {
      super(options);
    }
  };
}
