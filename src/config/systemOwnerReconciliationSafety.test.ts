import { describe, expect, it } from 'vitest';
import {
  SYSTEM_OWNER_RECONCILIATION_ERROR,
  TEST_RECONCILIATION_DATABASE,
  COMMISSIONING_RECONCILIATION_DATABASE,
  validateSystemOwnerReconciliationConfiguration,
  assertSystemOwnerReconciliationTargetPermitted,
  assertSystemOwnerReconciliationIdentityMatches,
  resolveSystemOwnerReconciliationHost,
} from './systemOwnerReconciliationSafety.js';

const authorised = Object.freeze({
  ALLOW_SYSTEM_OWNER_CAPABILITY_RECONCILIATION: 'YES',
  SYSTEM_OWNER_RECONCILIATION_DATABASE: COMMISSIONING_RECONCILIATION_DATABASE,
  SYSTEM_OWNER_RECONCILIATION_HOST: '127.0.0.1',
  SYSTEM_OWNER_RECONCILIATION_PORT: '5432',
});

function env(overrides: Record<string, string | undefined> = {}) {
  return { ...authorised, ...overrides };
}

describe('System Owner reconciliation target gate', () => {
  it('accepts the commissioning database with a commissioning designation', () => {
    const target = validateSystemOwnerReconciliationConfiguration(env(), 'commissioning');
    expect(target).toEqual({
      database: COMMISSIONING_RECONCILIATION_DATABASE,
      host: '127.0.0.1',
      port: 5432,
    });
  });

  it('accepts the test database only under a test environment', () => {
    const target = validateSystemOwnerReconciliationConfiguration(
      env({ SYSTEM_OWNER_RECONCILIATION_DATABASE: TEST_RECONCILIATION_DATABASE, NODE_ENV: 'test' }),
      null,
    );
    expect(target.database).toBe(TEST_RECONCILIATION_DATABASE);
  });

  it('refuses the test database outside a test environment', () => {
    expect(() =>
      validateSystemOwnerReconciliationConfiguration(
        env({ SYSTEM_OWNER_RECONCILIATION_DATABASE: TEST_RECONCILIATION_DATABASE, NODE_ENV: 'production' }),
        null,
      ),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
  });

  it('refuses the commissioning database when designated production', () => {
    expect(() => validateSystemOwnerReconciliationConfiguration(env(), 'production')).toThrow(
      SYSTEM_OWNER_RECONCILIATION_ERROR,
    );
  });

  it('refuses the commissioning database with a missing designation', () => {
    expect(() => validateSystemOwnerReconciliationConfiguration(env(), null)).toThrow(
      SYSTEM_OWNER_RECONCILIATION_ERROR,
    );
  });

  it('refuses any unexpected database name', () => {
    expect(() =>
      validateSystemOwnerReconciliationConfiguration(
        env({ SYSTEM_OWNER_RECONCILIATION_DATABASE: 'jupiter_prod' }),
        'commissioning',
      ),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
  });

  it('refuses execution without the explicit authorisation flag', () => {
    expect(() =>
      validateSystemOwnerReconciliationConfiguration(
        env({ ALLOW_SYSTEM_OWNER_CAPABILITY_RECONCILIATION: undefined }),
        'commissioning',
      ),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
  });

  it('refuses a missing or malformed host, port or database', () => {
    expect(() =>
      validateSystemOwnerReconciliationConfiguration(
        env({ SYSTEM_OWNER_RECONCILIATION_HOST: undefined }),
        'commissioning',
      ),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
    expect(() =>
      validateSystemOwnerReconciliationConfiguration(
        env({ SYSTEM_OWNER_RECONCILIATION_PORT: 'not-a-port' }),
        'commissioning',
      ),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
    expect(() =>
      validateSystemOwnerReconciliationConfiguration(
        env({ SYSTEM_OWNER_RECONCILIATION_PORT: '99999' }),
        'commissioning',
      ),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
    expect(() =>
      validateSystemOwnerReconciliationConfiguration(
        env({ SYSTEM_OWNER_RECONCILIATION_DATABASE: '123bad' }),
        'commissioning',
      ),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
  });
});

describe('System Owner reconciliation identity verification', () => {
  const target = Object.freeze({
    database: COMMISSIONING_RECONCILIATION_DATABASE,
    host: '127.0.0.1',
    port: 5432,
  });

  it('accepts an exactly matching live identity', () => {
    expect(() =>
      assertSystemOwnerReconciliationIdentityMatches(
        target,
        { database_name: 'jupiter_db', server_address: '127.0.0.1', server_port: 5432 },
        ['127.0.0.1'],
      ),
    ).not.toThrow();
  });

  it('refuses a database-name mismatch', () => {
    expect(() =>
      assertSystemOwnerReconciliationIdentityMatches(
        target,
        { database_name: 'jupiter_test', server_address: '127.0.0.1', server_port: 5432 },
        ['127.0.0.1'],
      ),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
  });

  it('refuses a port mismatch', () => {
    expect(() =>
      assertSystemOwnerReconciliationIdentityMatches(
        target,
        { database_name: 'jupiter_db', server_address: '127.0.0.1', server_port: 9999 },
        ['127.0.0.1'],
      ),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
  });

  it('refuses an unresolved or unexpected server address', () => {
    expect(() =>
      assertSystemOwnerReconciliationIdentityMatches(
        target,
        { database_name: 'jupiter_db', server_address: '10.0.0.9', server_port: 5432 },
        ['127.0.0.1'],
      ),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
    expect(() =>
      assertSystemOwnerReconciliationIdentityMatches(
        target,
        { database_name: 'jupiter_db', server_address: '127.0.0.1', server_port: 5432 },
        [],
      ),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
  });

  it('resolves a literal IPv4 host without a lookup', async () => {
    await expect(resolveSystemOwnerReconciliationHost('127.0.0.1')).resolves.toEqual(['127.0.0.1']);
  });
});

describe('assertSystemOwnerReconciliationTargetPermitted', () => {
  it('permits jupiter_test only with NODE_ENV=test', () => {
    expect(() => assertSystemOwnerReconciliationTargetPermitted('jupiter_test', 'test', null)).not.toThrow();
    expect(() =>
      assertSystemOwnerReconciliationTargetPermitted('jupiter_test', 'production', null),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
  });

  it('permits jupiter_db only with a commissioning designation', () => {
    expect(() =>
      assertSystemOwnerReconciliationTargetPermitted('jupiter_db', 'production', 'commissioning'),
    ).not.toThrow();
    expect(() =>
      assertSystemOwnerReconciliationTargetPermitted('jupiter_db', 'production', 'production'),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
  });

  it('rejects any other database', () => {
    expect(() =>
      assertSystemOwnerReconciliationTargetPermitted('postgres', 'test', 'commissioning'),
    ).toThrow(SYSTEM_OWNER_RECONCILIATION_ERROR);
  });
});

