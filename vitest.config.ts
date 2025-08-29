import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60000, // 60 seconds for live API calls
    hookTimeout: 60000, // 60 seconds for setup/teardown
    reporters: ['verbose'],
    env: {
      NODE_ENV: 'test',
    },
    setupFiles: ['./tests/setup.ts'],
    // Run tests sequentially to avoid API rate limits
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        maxThreads: 1,
        minThreads: 1,
      },
    },
  },
  esbuild: {
    target: 'node18',
  },
});
