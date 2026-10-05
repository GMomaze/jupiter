import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/modules/tenancy/level1-operational-authority-activation.test.ts'],
  },
});
