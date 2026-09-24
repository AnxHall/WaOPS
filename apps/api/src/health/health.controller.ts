import { Controller, Get } from '@nestjs/common';
import Redis from 'ioredis';
import { getPrisma } from '@waops/db';
import { loadConfig } from '@waops/config';

@Controller()
export class HealthController {
  @Get('healthz')
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('readyz')
  async readiness(): Promise<Record<string, string>> {
    const cfg = loadConfig();
    const result: Record<string, string> = {};
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      result.postgres = 'ok';
    } catch {
      result.postgres = 'unavailable';
    }
    try {
      const redis = new Redis(cfg.env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 1 });
      result.redis = (await redis.ping()) === 'PONG' ? 'ok' : 'unavailable';
      redis.disconnect();
    } catch {
      result.redis = 'unavailable';
    }
    return result;
  }
}
