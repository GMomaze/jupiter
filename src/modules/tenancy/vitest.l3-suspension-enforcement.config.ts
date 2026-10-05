import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/modules/tenancy/tenant-suspension-enforcement.test.ts'], fileParallelism: false, maxWorkers: 1 } });
