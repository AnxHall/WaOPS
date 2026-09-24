import { loadConfig, resetConfigCache } from '@waops/config';
import { getPrisma, disconnectPrisma, resetDb } from '@waops/db';
import { runSeed } from '../../../../packages/db/prisma/seed';

/**
 * E2E global setup — assumes local infra is up (docker compose --profile core up -d)
 * and services running (api 3001, gateway 3002, worker). Truncates foundation
 * tables and re-applies the idempotent seed so system roles exist.
 */
export async function setup(): Promise<void> {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  resetConfigCache();
  loadConfig();

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
