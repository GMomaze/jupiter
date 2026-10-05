import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/modules/auth/staff-tenant-two-tenant.database.test.ts'], fileParallelism: false, maxWorkers: 1 } });
