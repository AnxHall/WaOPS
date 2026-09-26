import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { loadConfig } from '@waops/config';

/**
 * Rate-limit observability (HM05 follow-up) — 429/min per route class, Redis
 * as the source of truth. Counters are written by the rate-limit middleware
 * (`rl:stats:429:<class>:<minuteBucket>`, TTL 120s) and aggregated here, so a
 * horizontally scaled API contributes to the same window.
 */

export interface RateLimitStat {
  routeClass: string;
  windowStart: string;
  limited: number;
}

@Injectable()
export class RateLimitStatsService {
  /** 429 counters for the current and previous minute bucket, all classes. */
  async stats(): Promise<{ window_seconds: number; classes: RateLimitStat[] }> {
    const redis = new Redis(loadConfig().env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
    });
    redis.on('error', () => undefined);
    try {
      await redis.connect();
      const nowBucket = Math.floor(Date.now() / 60_000);
      const classes = ['auth', 'api', 'realtime'];
      const values = await Promise.all(
        classes.map(async (routeClass) => {
          const key = `rl:stats:429:${routeClass}:${nowBucket}`;
          const prevKey = `rl:stats:429:${routeClass}:${nowBucket - 1}`;
          // Elapsed fraction of the current minute weights the partial bucket
          // (prev decays as the minute advances; cur carries the live window).
          const elapsedMs = Date.now() - nowBucket * 60_000;
          const cur = Number((await redis.get(key)) ?? 0);
          const prev = Number((await redis.get(prevKey)) ?? 0);
          const f = elapsedMs / 60_000;
          return { routeClass, limited: Math.round(prev * (1 - f) + cur) };
        }),
      );
      return {
        window_seconds: 60,
        classes: values.map((v) => ({
          routeClass: v.routeClass,
          windowStart: new Date((nowBucket - 1) * 60_000).toISOString(),
          limited: v.limited,
        })),
      };
    } finally {
      redis.quit().catch(() => undefined);
    }
  }
}
