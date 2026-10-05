import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/modules/library/serialized-component-reconciliation-two-tenant.database.test.ts'], testTimeout: 30_000, hookTimeout: 30_000 },
});
