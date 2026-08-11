import { describe, expect, it } from 'vitest';
import {
  assertTestDatabaseSafety,
  validateTestDatabaseSafety,
} from './testDatabaseSafety.js';

const approvedConfig = {
  nodeEnv: 'test',
  databaseName: 'jupiter_test',
  databaseUser: 'jupiter_test',
  resetApproval: 'YES',
};

describe('test database safety validation', () => {
  it('rejects jupiter_db', () => {
    expect(() =>
      validateTestDatabaseSafety({
        ...approvedConfig,
        databaseName: 'jupiter_db',
      })
    ).toThrow('DB_NAME must be exactly jupiter_test');
  });

  it('rejects jupiter_app', () => {
    expect(() =>
      validateTestDatabaseSafety({
        ...approvedConfig,
        databaseUser: 'jupiter_app',
      })
    ).toThrow('DB_USER must be exactly jupiter_test');
  });

  it('rejects missing reset approval', () => {
    expect(() =>
      validateTestDatabaseSafety({
        ...approvedConfig,
        resetApproval: undefined,
      })
    ).toThrow('ALLOW_TEST_DATABASE_RESET must be exactly YES');
  });

  it('rejects an incorrect NODE_ENV', () => {
    expect(() =>
      validateTestDatabaseSafety({
        ...approvedConfig,
        nodeEnv: 'development',
      })
    ).toThrow('NODE_ENV must be exactly test');
  });

  it('accepts only the exact approved values', () => {
    expect(() => validateTestDatabaseSafety(approvedConfig)).not.toThrow();
  });

  it('rejects a live database other than jupiter_test', async () => {
    await expect(
      assertTestDatabaseSafety({
        query: async () => ({
          rows: [{ database_name: 'jupiter_db', user_name: 'jupiter_test' }],
        }),
      })
    ).rejects.toThrow('live database must be exactly jupiter_test');
  });

  it('rejects a live user other than jupiter_test', async () => {
    await expect(
      assertTestDatabaseSafety({
        query: async () => ({
          rows: [{ database_name: 'jupiter_test', user_name: 'jupiter_app' }],
        }),
      })
    ).rejects.toThrow('live user must be exactly jupiter_test');
  });
});
