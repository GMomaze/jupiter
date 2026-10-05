import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/modules/customer-portal/customer-portal-tenant-two-tenant.database.test.ts'],
    setupFiles: [],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
