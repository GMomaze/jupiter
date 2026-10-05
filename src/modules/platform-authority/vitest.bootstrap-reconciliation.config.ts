import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'node',include:[
  'src/modules/platform-authority/platform-bootstrap.test.ts',
  'src/modules/platform-authority/terminal-bootstrap-cleanup.test.ts',
  'src/modules/platform-authority/platform-authority.test.ts',
],fileParallelism:false,maxWorkers:1}});
