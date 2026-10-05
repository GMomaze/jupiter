import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',include:['src/modules/platform-authority/*.test.ts'],fileParallelism:false,maxWorkers:1}});
