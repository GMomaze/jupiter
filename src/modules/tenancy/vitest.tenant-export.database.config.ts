import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/modules/tenancy/tenant-export-migration.database.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
  },
});
