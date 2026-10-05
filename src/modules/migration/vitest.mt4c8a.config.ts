import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/modules/migration/mt4c8a-tenant-boundary.test.ts'] },
});
