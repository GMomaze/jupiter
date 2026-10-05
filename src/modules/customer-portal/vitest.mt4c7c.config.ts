import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/modules/customer-portal/customer-portal-tenant-boundary.test.ts'],
    setupFiles: [],
  },
});
