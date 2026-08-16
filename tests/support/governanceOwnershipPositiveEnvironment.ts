import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

export const GUARDED_TEST_ENVIRONMENT_KEYS = [
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DB_HOST',
  'DB_PORT',
  'DB_ADMIN_USER',
  'DB_ADMIN_PASSWORD',
  'ALLOW_TEST_DATABASE_RESET',
  'ALLOW_GOVERNANCE_OWNERSHIP_TEST',
] as const;

type Environment = NodeJS.ProcessEnv;

export function applyGuardedTestEnvironment(
  environment: Environment,
  files: readonly string[] = ['.env.test', '.env.test.local'],
): void {
  const invocationFlag = environment.RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST;

  for (const file of files) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const parsed = dotenv.parse(readFileSync(path));
    for (const key of GUARDED_TEST_ENVIRONMENT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(parsed, key)) environment[key] = parsed[key];
    }
  }

  if (invocationFlag === undefined) delete environment.RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST;
  else environment.RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST = invocationFlag;
}

export function validateGuardedOwnershipEnvironment(environment: Environment): {
  host: string;
  port: number;
  runtimePassword: string;
  adminPassword: string;
} {
  const required = (key: string): string => {
    const value = environment[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`GUARDED_OWNERSHIP_TEST: ${key} is required`);
    }
    return value.trim();
  };

  if (environment.NODE_ENV !== 'test') throw new Error('GUARDED_OWNERSHIP_TEST: NODE_ENV must be exactly test');
  if (environment.DB_NAME !== 'jupiter_test') throw new Error('GUARDED_OWNERSHIP_TEST: DB_NAME must be exactly jupiter_test');
  if (environment.DB_USER !== 'jupiter_test') throw new Error('GUARDED_OWNERSHIP_TEST: DB_USER must be exactly jupiter_test');
  if (environment.DB_ADMIN_USER !== 'postgres') throw new Error('GUARDED_OWNERSHIP_TEST: DB_ADMIN_USER must be exactly postgres');
  if (environment.ALLOW_TEST_DATABASE_RESET !== 'YES') throw new Error('GUARDED_OWNERSHIP_TEST: ALLOW_TEST_DATABASE_RESET must be exactly YES');
  if (environment.ALLOW_GOVERNANCE_OWNERSHIP_TEST !== 'YES') throw new Error('GUARDED_OWNERSHIP_TEST: ALLOW_GOVERNANCE_OWNERSHIP_TEST must be exactly YES');
  if (environment.RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST !== 'YES') throw new Error('GUARDED_OWNERSHIP_TEST: RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST must be exactly YES');

  const portValue = required('DB_PORT');
  if (!/^\d+$/.test(portValue)) throw new Error('GUARDED_OWNERSHIP_TEST: DB_PORT must be an explicit valid port');
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('GUARDED_OWNERSHIP_TEST: DB_PORT must be an explicit valid port');
  }

  return {
    host: required('DB_HOST'),
    port,
    runtimePassword: required('DB_PASSWORD'),
    adminPassword: required('DB_ADMIN_PASSWORD'),
  };
}
