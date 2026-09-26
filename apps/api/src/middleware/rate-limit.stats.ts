import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { loadConfig } from '@waops/config';

/**
 * Rate-limit observability (HM05 follow-up) — 429/min per route class, Redis
 * as the source of truth. Counters are written by the rate-limit middleware
 * (`rl:stats:429:<class>:<minuteBucket>`, TTL 1000s ≈ 16.7min, suficiente para
 * a janela de 15 min do histórico) and aggregated here, so a horizontally
 * scaled API contributes to the same window.
 */

export interface RateLimitStat {
  routeClass: string;
  windowStart: string;
  limited: number;
}

/** Um bucket de 60s do histórico (ordem cronológica, mais antigo primeiro). */
export interface RateLimitHistoryPoint {
  windowStart: string;
  limited: number;
}

export interface RateLimitHistory {
  window_seconds: number;
  points: number;
  classes: { routeClass: string; limited: RateLimitHistoryPoint[] }[];
}

/** Janela do histórico exposto em GET /api/v1/rate-limits/history (minutos). */
export const RATE_LIMIT_HISTORY_MINUTES = 15;

const CLASSES = ['auth', 'api', 'realtime'] as const;

/** Conexão Redis efêmera por chamada (stats é read-path de baixa frequência). */
async function withRedis<T>(fn: (redis: Redis) => Promise<T>): Promise<T> {
  const redis = new Redis(loadConfig().env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
  });
  redis.on('error', () => undefined);
  try {
    await redis.connect();
    return await fn(redis);
  } finally {
    redis.quit().catch(() => undefined);
  }
}

@Injectable()
export class RateLimitStatsService {
  /** 429 counters for the current and previous minute bucket, all classes. */
  async stats(): Promise<{ window_seconds: number; classes: RateLimitStat[] }> {
    return withRedis(async (redis) => {
      const nowBucket = Math.floor(Date.now() / 60_000);
      // Elapsed fraction of the current minute weights the partial bucket
      // (prev decays as the minute advances; cur carries the live window).
      const f = (Date.now() - nowBucket * 60_000) / 60_000;
      const classes = await Promise.all(
        CLASSES.map(async (routeClass) => {
          const cur = Number((await redis.get(`rl:stats:429:${routeClass}:${nowBucket}`)) ?? 0);
          const prev = Number((await redis.get(`rl:stats:429:${routeClass}:${nowBucket - 1}`)) ?? 0);
          return {
            routeClass,
            windowStart: new Date((nowBucket - 1) * 60_000).toISOString(),
            limited: Math.round(prev * (1 - f) + cur),
          };
        }),
      );
      return { window_seconds: 60, classes };
    });
  }

  /** Série 429/min dos últimos 15 minutos por classe (ordem cronológica). */
  async history(): Promise<RateLimitHistory> {
    return withRedis(async (redis) => {
      const nowBucket = Math.floor(Date.now() / 60_000);
      const buckets = Array.from(
        { length: RATE_LIMIT_HISTORY_MINUTES },
        (_, i) => nowBucket - (RATE_LIMIT_HISTORY_MINUTES - 1 - i),
      );
      const classes = await Promise.all(
        CLASSES.map(async (routeClass) => {
          const raw = await redis.mget(...buckets.map((b) => `rl:stats:429:${routeClass}:${b}`));
          return {
            routeClass,
            limited: buckets.map((b, i) => ({
              windowStart: new Date(b * 60_000).toISOString(),
              limited: Number(raw[i] ?? 0),
            })),
          };
        }),
      );
      return { window_seconds: 60, points: RATE_LIMIT_HISTORY_MINUTES, classes };
    });
  }
}
