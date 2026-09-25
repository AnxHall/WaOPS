import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 45000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
