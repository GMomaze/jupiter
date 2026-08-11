import { resolve } from 'node:path';
import dotenv from 'dotenv';

const databaseEnvironmentKeys = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DB_ADMIN_USER',
  'DB_ADMIN_PASSWORD',
  'DATABASE_URL',
  'ALLOW_TEST_DATABASE_RESET',
] as const;

if (process.env.NODE_ENV === 'test') {
  for (const key of databaseEnvironmentKeys) {
    delete process.env[key];
  }

  dotenv.config({
    path: resolve(process.cwd(), '.env.test'),
    override: true,
    quiet: true,
  });
} else {
  dotenv.config({ quiet: true });
}
