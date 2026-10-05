import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/modules/service-bulletins/service-bulletin-sync.database.test.ts'], fileParallelism: false, maxWorkers: 1, testTimeout: 30000 } });
