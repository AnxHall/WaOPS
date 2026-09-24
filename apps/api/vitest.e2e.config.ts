import { defineConfig } from 'vitest/config';

/** E2E/integration config — requires local infra (docker compose --profile core up). */
export default defineConfig({
  test: {
    include: ['test/e2e/*.e2e.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 120000,
    fileParallelism: false,
    globalSetup: ['./test/e2e/global-setup.ts'],
  },
});
