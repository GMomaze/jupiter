import { lookup } from 'node:dns/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertMigrationLiveIdentity,
  resolveMigrationHost,
  validateMigrationLiveIdentity,
  type MigrationConnectionConfig,
  type MigrationLiveIdentity,
} from './migrationSafety.js';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

const lookupMock = vi.mocked(lookup);

const config: MigrationConnectionConfig = {
  target: 'development',
  database: 'jupiter_db',
  username: 'postgres',
  host: '127.0.0.1',
  port: 5432,
};
const identity: MigrationLiveIdentity = {
  database_name: 'jupiter_db',
  current_user: 'postgres',
  session_user: 'postgres',
  server_address: '127.0.0.1',
  server_port: 5432,
};

describe('unified migration live identity safety', () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  it('returns a literal IPv4 address without DNS resolution', async () => {
    await expect(resolveMigrationHost('127.0.0.1')).resolves.toEqual(['127.0.0.1']);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('preserves hostname DNS resolution and unique multiple-address results', async () => {
    lookupMock.mockResolvedValueOnce([
      { address: '192.0.2.10', family: 4 },
      { address: '192.0.2.11', family: 4 },
      { address: '192.0.2.10', family: 4 },
    ]);
    await expect(resolveMigrationHost('database.internal')).resolves.toEqual([
      '192.0.2.10',
      '192.0.2.11',
    ]);
    expect(lookupMock).toHaveBeenCalledOnce();
    expect(lookupMock).toHaveBeenCalledWith('database.internal', {
      all: true,
      verbatim: true,
    });
  });

  it('fails closed for malformed hosts and DNS failures', async () => {
    lookupMock.mockRejectedValueOnce(new Error('controlled DNS failure'));
    await expect(resolveMigrationHost('not a valid host')).rejects.toThrow(
      'controlled DNS failure',
    );
    expect(lookupMock).toHaveBeenCalledOnce();
  });

  it('keeps IPv6 literals fail closed without DNS resolution', async () => {
    await expect(resolveMigrationHost('::1')).rejects.toThrow(
      'MIGRATION_SAFETY: IPv6 literal hosts are not supported',
    );
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects an unapproved literal IPv4 through live address comparison', async () => {
    await expect(
      assertMigrationLiveIdentity(
        { query: async () => ({ rows: [identity] }) },
        { ...config, host: '127.0.0.2' },
      ),
    ).rejects.toThrow('live server address');
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it('rejects an unexpected address returned for a hostname', async () => {
    lookupMock.mockResolvedValueOnce([{ address: '192.0.2.20', family: 4 }]);
    await expect(
      assertMigrationLiveIdentity(
        { query: async () => ({ rows: [identity] }) },
        { ...config, host: 'database.internal' },
      ),
    ).rejects.toThrow('live server address');
    expect(lookupMock).toHaveBeenCalledOnce();
  });

  it('accepts an exact live identity', () => {
    expect(() =>
      validateMigrationLiveIdentity(config, identity, ['127.0.0.1'])
    ).not.toThrow();
  });

  it.each([
    [{ database_name: 'another_database' }, 'live database'],
    [{ current_user: 'jupiter_app' }, 'current_user'],
    [{ session_user: 'jupiter_test' }, 'session_user'],
    [{ server_port: 5433 }, 'server port'],
  ] as const)('rejects %s mismatch', (change, message) => {
    expect(() =>
      validateMigrationLiveIdentity(
        config,
        { ...identity, ...change },
        ['127.0.0.1']
      )
    ).toThrow(message);
  });

  it('rejects a host/address mismatch', () => {
    expect(() =>
      validateMigrationLiveIdentity(config, identity, ['192.0.2.10'])
    ).toThrow('live server address');
  });

  it('rejects test target crossover in live evidence', () => {
    expect(() =>
      validateMigrationLiveIdentity(
        { ...config, target: 'test', database: 'jupiter_db' },
        identity,
        ['127.0.0.1']
      )
    ).toThrow('test target must be exactly jupiter_test');
  });

  it('queries and verifies all required live identity fields', async () => {
    let sql = '';
    const result = await assertMigrationLiveIdentity(
      {
        query: async <Row extends Record<string, unknown>>(statement: string) => {
          sql = statement;
          return { rows: [identity as unknown as Row] };
        },
      },
      config,
      ['127.0.0.1']
    );
    expect(result).toEqual(identity);
    expect(sql).toContain('current_database()');
    expect(sql).toContain('current_user');
    expect(sql).toContain('session_user');
    expect(sql).toContain('inet_server_addr()');
    expect(sql).toContain('inet_server_port()');
  });
});
