import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/modules/audit/audit-tenant.service.test.ts',
      'src/modules/audit/audit-tenant-boundary.test.ts',
    ],
    setupFiles: [],
  },
});
