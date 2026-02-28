///C:\GMO\Projects\jupiter\src\models\aircraftComponent.model.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',

    // 🔴 CRITICAL: single threaded execution
    threads: false,
    isolate: true,

    // 🔴 CRITICAL: force serial file execution
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