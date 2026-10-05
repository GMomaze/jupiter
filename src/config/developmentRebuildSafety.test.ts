import { describe, expect, it } from 'vitest';
import {
  validateDevelopmentRebuildConfiguration,
  validateDevelopmentRebuildIdentity,
  DEVELOPMENT_REBUILD_ERROR,
} from './developmentRebuildSafety.js';

const valid = () => ({
  NODE_ENV: 'development',
  ALLOW_DEVELOPMENT_REBUILD: 'YES',
  ALLOW_UNIFIED_DATABASE_MIGRATION: 'YES',
  CONFIRM_DEVELOPMENT_REBUILD_DATABASE: 'jupiter_rebuild_proof_20260930',
  DB_MIGRATION_NAME: 'jupiter_rebuild_proof_20260930',
  DB_MIGRATION_USER: 'postgres',
  DB_MIGRATION_HOST: '127.0.0.1',
  DB_MIGRATION_PORT: '5432',
  DB_MIGRATION_PASSWORD: 'secret',
});

describe('guarded development rebuild safety', () => {
  it('accepts an explicitly confirmed development target', () => {
    const config = validateDevelopmentRebuildConfiguration(valid());
    expect(config.database).toBe('jupiter_rebuild_proof_20260930');
    expect(config.username).toBe('postgres');
  });

  it.each([
    ['no opt-in', { ALLOW_DEVELOPMENT_REBUILD: 'NO' }],
    ['no migration approval', { ALLOW_UNIFIED_DATABASE_MIGRATION: 'NO' }],
    ['non-development env', { NODE_ENV: 'production' }],
    ['test env', { NODE_ENV: 'test' }],
    ['mismatched confirmation', { CONFIRM_DEVELOPMENT_REBUILD_DATABASE: 'other_db' }],
    ['refuses jupiter_test', { DB_MIGRATION_NAME: 'jupiter_test', CONFIRM_DEVELOPMENT_REBUILD_DATABASE: 'jupiter_test' }],
    ['refuses postgres system db', { DB_MIGRATION_NAME: 'postgres', CONFIRM_DEVELOPMENT_REBUILD_DATABASE: 'postgres' }],
    ['non-postgres user', { DB_MIGRATION_USER: 'jupiter_app' }],
    ['invalid port', { DB_MIGRATION_PORT: 'not-a-port' }],
  ])('fails closed on %s', (_name, override) => {
    expect(() => validateDevelopmentRebuildConfiguration({ ...valid(), ...override }))
      .toThrow(DEVELOPMENT_REBUILD_ERROR);
  });

  it('refuses jupiter_db without the extra explicit flag', () => {
    expect(() => validateDevelopmentRebuildConfiguration({
      ...valid(),
      DB_MIGRATION_NAME: 'jupiter_db',
      CONFIRM_DEVELOPMENT_REBUILD_DATABASE: 'jupiter_db',
    })).toThrow(DEVELOPMENT_REBUILD_ERROR);
  });

  it('allows jupiter_db only with the extra explicit flag', () => {
    const config = validateDevelopmentRebuildConfiguration({
      ...valid(),
      DB_MIGRATION_NAME: 'jupiter_db',
      CONFIRM_DEVELOPMENT_REBUILD_DATABASE: 'jupiter_db',
      ALLOW_JUPITER_DB_REBUILD: 'YES',
    });
    expect(config.database).toBe('jupiter_db');
  });

  it('validates live identity and refuses read-only or mismatched endpoints', () => {
    const config = validateDevelopmentRebuildConfiguration(valid());
    const identity = {
      database_name: 'jupiter_rebuild_proof_20260930',
      current_user: 'postgres',
      session_user: 'postgres',
      server_address: '127.0.0.1',
      server_port: 5432,
      transaction_read_only: 'off',
    };
    expect(() => validateDevelopmentRebuildIdentity(config, identity as never, ['127.0.0.1'])).not.toThrow();
    expect(() => validateDevelopmentRebuildIdentity(config, { ...identity, database_name: 'jupiter_db' } as never, ['127.0.0.1'])).toThrow(DEVELOPMENT_REBUILD_ERROR);
    expect(() => validateDevelopmentRebuildIdentity(config, { ...identity, transaction_read_only: 'on' } as never, ['127.0.0.1'])).toThrow(DEVELOPMENT_REBUILD_ERROR);
    expect(() => validateDevelopmentRebuildIdentity(config, identity as never, [])).toThrow(DEVELOPMENT_REBUILD_ERROR);
  });
});
