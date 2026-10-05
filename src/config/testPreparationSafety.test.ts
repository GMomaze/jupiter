import { describe, expect, it } from 'vitest';
import {
  assertTestPreparationIdentities,
  parseTestPreparationOperation,
  validateTestPreparationAuthorization,
  validateTestPreparationIdentities,
  type TestPreparationConnectionConfig,
  type TestPreparationIdentity,
} from './testPreparationSafety.js';

const runtimeConfig: TestPreparationConnectionConfig = {
  database: 'jupiter_test', username: 'jupiter_test', host: '127.0.0.1', port: 5432,
};
const adminConfig: TestPreparationConnectionConfig = {
  database: 'jupiter_test', username: 'postgres', host: '127.0.0.1', port: 5432,
};
const runtimeIdentity: TestPreparationIdentity = {
  database_name: 'jupiter_test', current_user: 'jupiter_test', session_user: 'jupiter_test',
  server_address: '127.0.0.1', server_port: 5432,
};
const adminIdentity: TestPreparationIdentity = {
  database_name: 'jupiter_test', current_user: 'postgres', session_user: 'postgres',
  server_address: '127.0.0.1', server_port: 5432,
};
const runtimeSafety = {
  nodeEnv: 'test', databaseName: 'jupiter_test', databaseUser: 'jupiter_test', resetApproval: 'YES',
};

describe('administrative test preparation safety', () => {
  it.each(['reset', 'migrate:undo', 'harden'] as const)('accepts operation %s', operation => {
    expect(parseTestPreparationOperation(operation)).toBe(operation);
  });

  it.each([undefined, '', 'seed', 'migrate', 'unknown'])(
    'rejects missing or unsupported operation %s', operation => {
      expect(() => parseTestPreparationOperation(operation)).toThrow(
        'operation must be exactly one of reset, migrate:undo, harden'
      );
    }
  );

  it('requires the runtime contract and separate preparation approval', () => {
    expect(() =>
      validateTestPreparationAuthorization(runtimeSafety, 'YES', adminConfig)
    ).not.toThrow();
    expect(() =>
      validateTestPreparationAuthorization(runtimeSafety, undefined, adminConfig)
    ).toThrow('ALLOW_TEST_DATABASE_PREPARATION must be exactly YES');
    expect(() =>
      validateTestPreparationAuthorization(
        { ...runtimeSafety, databaseUser: 'postgres' }, 'YES', adminConfig
      )
    ).toThrow('DB_USER must be exactly jupiter_test');
  });

  it.each(['jupiter_db', 'postgres', 'development_db'])(
    'rejects administrator database %s', database => {
      expect(() =>
        validateTestPreparationAuthorization(
          runtimeSafety, 'YES', { ...adminConfig, database }
        )
      ).toThrow('administrator database must be exactly jupiter_test');
    }
  );

  it('requires postgres administrative configuration', () => {
    expect(() =>
      validateTestPreparationAuthorization(
        runtimeSafety, 'YES', { ...adminConfig, username: 'jupiter_test' }
      )
    ).toThrow('administrator user must be exactly postgres');
  });

  it('accepts exact matching live identities', () => {
    expect(() => validateTestPreparationIdentities(
      runtimeConfig, adminConfig, runtimeIdentity, adminIdentity,
      ['127.0.0.1'], ['127.0.0.1']
    )).not.toThrow();
  });

  it('rejects runtime and administrator identity mismatches', () => {
    expect(() => validateTestPreparationIdentities(
      runtimeConfig, adminConfig,
      { ...runtimeIdentity, database_name: 'jupiter_db' }, adminIdentity,
      ['127.0.0.1'], ['127.0.0.1']
    )).toThrow('live runtime identity');
    expect(() => validateTestPreparationIdentities(
      runtimeConfig, adminConfig, runtimeIdentity,
      { ...adminIdentity, session_user: 'jupiter_test' },
      ['127.0.0.1'], ['127.0.0.1']
    )).toThrow('live administrator identity');
  });

  it('rejects endpoint address and port mismatches', () => {
    expect(() => validateTestPreparationIdentities(
      runtimeConfig, adminConfig, runtimeIdentity,
      { ...adminIdentity, server_address: '192.0.2.20' },
      ['127.0.0.1'], ['192.0.2.20']
    )).toThrow('endpoints must match exactly');
    expect(() => validateTestPreparationIdentities(
      runtimeConfig, adminConfig, runtimeIdentity,
      { ...adminIdentity, server_port: 5433 },
      ['127.0.0.1'], ['127.0.0.1']
    )).toThrow('endpoints must match exactly');
  });

  it('queries both identities with the complete live contract', async () => {
    const statements: string[] = [];
    const queryable = (identity: TestPreparationIdentity) => ({
      query: async <Row extends Record<string, unknown>>(sql: string) => {
        statements.push(sql);
        return { rows: [identity as unknown as Row] };
      },
    });
    await assertTestPreparationIdentities(
      queryable(runtimeIdentity), queryable(adminIdentity),
      runtimeConfig, adminConfig, ['127.0.0.1'], ['127.0.0.1']
    );
    expect(statements).toHaveLength(2);
    for (const sql of statements) {
      expect(sql).toContain('current_database()');
      expect(sql).toContain('current_user');
      expect(sql).toContain('session_user');
      expect(sql).toContain('inet_server_addr()');
      expect(sql).toContain('inet_server_port()');
    }
  });
});
