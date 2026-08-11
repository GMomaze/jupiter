import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  workers: 1,
  globalSetup: 'tests/e2e/globalSetup.ts',
  webServer: {
    command: 'npm run test:e2e:server',
    url: 'http://localhost:3000/ping',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
});
