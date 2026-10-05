import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/modules/projection/projection.service.test.ts',
      'src/modules/projection/projection-boundary.test.ts',
    ],
    setupFiles: [],
  },
});
