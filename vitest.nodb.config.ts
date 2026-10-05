import { defineConfig } from 'vitest/config';
import { NO_DATABASE_TEST_ALLOWLIST } from './tests/config/noDatabaseTestAllowlist.js';

export default defineConfig({
  test: {
    environment: 'node',
    include: [...NO_DATABASE_TEST_ALLOWLIST],
    setupFiles: ['tests/nodb/setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    maxConcurrency: 1,
    sequence: {
      concurrent: false,
    },
    testTimeout: 10_000,
  },
});
