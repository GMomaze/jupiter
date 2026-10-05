import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/modules/tenancy/tenant-export-policy.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
