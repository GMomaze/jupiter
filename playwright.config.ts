import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:2000',
    headless: true,
  },
});
