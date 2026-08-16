import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyGuardedTestEnvironment,
  validateGuardedOwnershipEnvironment,
} from '../support/governanceOwnershipPositiveEnvironment.js';

function guardedEnvironment(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    DB_NAME: 'jupiter_test',
    DB_USER: 'jupiter_test',
    DB_PASSWORD: 'runtime-secret',
    DB_HOST: '127.0.0.1',
    DB_PORT: '5432',
    DB_ADMIN_USER: 'postgres',
    DB_ADMIN_PASSWORD: 'admin-secret',
    ALLOW_TEST_DATABASE_RESET: 'YES',
    ALLOW_GOVERNANCE_OWNERSHIP_TEST: 'YES',
    RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST: 'YES',
  };
}

function envFile(contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'jupiter-governance-env-'));
  const path = join(directory, '.env');
  writeFileSync(path, contents, 'utf8');
  return path;
}

describe('positive governance harness environment resolution', () => {
  it('replaces inherited production database and administrator identities from guarded local values', () => {
    const environment = { DB_NAME: 'jupiter_db', DB_USER: 'jupiter_app', DB_ADMIN_USER: 'jupiter_app', RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST: 'YES' };
    const local = envFile('DB_NAME=jupiter_test\nDB_USER=jupiter_test\nDB_ADMIN_USER=postgres\n');
    applyGuardedTestEnvironment(environment, [local]);
    expect(environment).toMatchObject({ DB_NAME: 'jupiter_test', DB_USER: 'jupiter_test', DB_ADMIN_USER: 'postgres' });
  });

  it('never lets dotenv activate the destructive harness', () => {
    const local = envFile('RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST=YES\nDB_NAME=jupiter_test\n');
    const absent: NodeJS.ProcessEnv = {};
    applyGuardedTestEnvironment(absent, [local]);
    expect(absent.RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST).toBeUndefined();
    const disabled: NodeJS.ProcessEnv = { RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST: 'NO' };
    applyGuardedTestEnvironment(disabled, [local]);
    expect(disabled.RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST).toBe('NO');
  });

  it('preserves the dedicated command process-scoped YES', () => {
    const environment: NodeJS.ProcessEnv = { RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST: 'YES' };
    applyGuardedTestEnvironment(environment, [envFile('RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST=NO\n')]);
    expect(environment.RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST).toBe('YES');
  });

  it('fails closed when local administrator credentials are absent', () => {
    const environment = guardedEnvironment();
    delete environment.DB_ADMIN_PASSWORD;
    expect(() => validateGuardedOwnershipEnvironment(environment)).toThrow('DB_ADMIN_PASSWORD is required');
  });

  it.each([
    ['ALLOW_TEST_DATABASE_RESET', 'yes'],
    ['ALLOW_TEST_DATABASE_RESET', 'NO'],
    ['ALLOW_GOVERNANCE_OWNERSHIP_TEST', 'yes'],
    ['ALLOW_GOVERNANCE_OWNERSHIP_TEST', 'TRUE'],
    ['RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST', 'yes'],
  ])('fails closed for %s=%s', (key, value) => {
    const environment = guardedEnvironment();
    environment[key] = value;
    expect(() => validateGuardedOwnershipEnvironment(environment)).toThrow('must be exactly YES');
  });

  it('requires nonblank runtime credentials and an explicit valid host and port', () => {
    for (const [key, value] of [['DB_PASSWORD', ' '], ['DB_HOST', ' '], ['DB_PORT', 'default']] as const) {
      const environment = guardedEnvironment();
      environment[key] = value;
      expect(() => validateGuardedOwnershipEnvironment(environment)).toThrow();
    }
  });
});
