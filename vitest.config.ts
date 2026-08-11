///C:\GMO\Projects\jupiter\src\models\aircraftComponent.model.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',

    // Database-writing test files share one guarded jupiter_test database.
    fileParallelism: false,
    maxWorkers: 1,
    isolate: true,

    // Keep tests within each file sequential unless explicitly marked concurrent.
    sequence: {
      concurrent: false
    },

    maxConcurrency: 1,

    include: [
      'tests/**/*.test.ts',
      'src/**/*.test.ts'
    ],

    exclude: [
      'node_modules/**',
      'tests/e2e/**',
      '**/*.spec.ts'
    ],

    setupFiles: ['tests/setup.ts'],

    testTimeout: 10000
  }
});
