import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/modules/tenancy/l3-suspension-coordination.database.test.ts'], fileParallelism: false, maxWorkers: 1, testTimeout: 30_000 } });
