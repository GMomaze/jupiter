import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/modules/auth/staff-last-admin-protection.database.test.ts'], fileParallelism: false, maxWorkers: 1, testTimeout: 30_000 } });
