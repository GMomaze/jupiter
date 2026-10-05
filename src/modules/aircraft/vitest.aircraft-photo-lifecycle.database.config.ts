import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['src/modules/aircraft/aircraft-photo-lifecycle.database.test.ts'],
    maxWorkers: 1,
    fileParallelism: false,
  },
});
