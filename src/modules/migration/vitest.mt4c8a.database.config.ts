import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/modules/migration/mt4c8a-two-tenant.database.test.ts',
      'src/modules/migration/mt4c8a-migration.database.test.ts',
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
