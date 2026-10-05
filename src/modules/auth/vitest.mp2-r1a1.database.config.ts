import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['src/modules/auth/mp2-r1a1-foundation.database.test.ts','src/modules/auth/mp2-r1a1-adversarial.database.test.ts'],fileParallelism:false,maxWorkers:1,testTimeout:30_000}});
