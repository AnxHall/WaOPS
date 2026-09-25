import { loadConfig, resetConfigCache } from '@waops/config';
import { getPrisma, disconnectPrisma, resetDb } from '@waops/db';
import { runSeed } from '../../../../packages/db/prisma/seed';
import Redis from 'ioredis';

/**
 * E2E global setup — assumes local infra is up (docker compose --profile core up -d)
 * and services running (api 3001, gateway 3002, worker). Truncates foundation
 * tables and re-applies the idempotent seed so system roles exist.
 * HM05: also clears rate-limit buckets so per-IP auth budgets start full —
 * leftover 429 state from previous runs would break signups of the first file.
 */
export async function setup(): Promise<void> {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  resetConfigCache();
  loadConfig();

  const redis = new Redis(loadConfig().env.REDIS_URL, { maxRetriesPerRequest: 1 });
  const keys = await redis.keys('rl:*');
  if (keys.length > 0) await redis.del(...keys);
  await redis.quit().catch(() => undefined);

  const prisma = getPrisma();
  for (let i = 0; i < 30; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  await resetDb(prisma);
  await disconnectPrisma();
  await runSeed();
}

export async function teardown(): Promise<void> {
  await disconnectPrisma();
}
