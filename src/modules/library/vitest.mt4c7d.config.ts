import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/modules/library/serialized-component-reconciliation-tenant.test.ts'] },
});
