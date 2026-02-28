import { beforeEach } from 'vitest';
import { resetDatabase } from './tests/helpers/resetDatabase.js';

beforeEach(async () => {
  await resetDatabase();
});