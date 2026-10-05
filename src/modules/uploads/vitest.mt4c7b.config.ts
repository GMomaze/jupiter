import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/modules/uploads/upload-delivery.repository.test.ts',
      'src/modules/uploads/upload-delivery.service.test.ts',
      'src/modules/uploads/upload-delivery-boundary.test.ts',
    ],
    setupFiles: [],
  },
});
