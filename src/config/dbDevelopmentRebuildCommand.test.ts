import { describe, expect, it } from 'vitest';
import {
  DEVELOPMENT_REBUILD_TARGET,
  DEVELOPMENT_REBUILD_CONFIRMATION,
  REFUSED_REBUILD_TARGETS,
  DevelopmentRebuildCommandError,
  assertDevelopmentRebuildCommandTarget,
  validateDevelopmentRebuildConfirmation,
  buildDevelopmentRebuildPrompt,
  buildDevelopmentRebuildCommandEnvironment,
  buildSystemOwnerBootstrapEnvironment,
  formatDevelopmentRebuildSummary,
} from './dbDevelopmentRebuildCommand.js';

describe('development rebuild command (convenience wrapper surface)', () => {
  it('targets exactly jupiter_db and accepts the exact confirmation phrase', () => {
    expect(DEVELOPMENT_REBUILD_TARGET).toBe('jupiter_db');
    expect(DEVELOPMENT_REBUILD_CONFIRMATION).toBe('REBUILD jupiter_db');
  });

  it('refuses every non-jupiter_db target', () => {
    for (const refused of REFUSED_REBUILD_TARGETS) {
      expect(() =>
        assertDevelopmentRebuildCommandTarget('development', refused),
      ).toThrow(DevelopmentRebuildCommandError);
    }
    for (const other of ['jupiter_test', 'postgres', 'template0', 'template1', 'production_db', '']) {
      expect(() =>
        assertDevelopmentRebuildCommandTarget('development', other),
      ).toThrow(DevelopmentRebuildCommandError);
    }
  });

  it('is permanently restricted to development', () => {
    expect(() =>
      assertDevelopmentRebuildCommandTarget('development', DEVELOPMENT_REBUILD_TARGET),
    ).not.toThrow();
    for (const env of ['production', 'test', undefined, '']) {
      expect(() =>
        assertDevelopmentRebuildCommandTarget(env, DEVELOPMENT_REBUILD_TARGET),
      ).toThrow(DevelopmentRebuildCommandError);
    }
  });

  it('accepts only the exact confirmation phrase', () => {
    expect(validateDevelopmentRebuildConfirmation('REBUILD jupiter_db')).toBe(true);
    expect(validateDevelopmentRebuildConfirmation('  REBUILD jupiter_db  ')).toBe(true);
    for (const wrong of [
      'rebuild jupiter_db',
      'REBUILD jupiter_db extra',
      'REBUILD jupiter_test',
      'yes',
      '',
      'REBUILD jupiter_db x',
    ]) {
      expect(validateDevelopmentRebuildConfirmation(wrong)).toBe(false);
    }
  });

  it('builds the exact warning prompt', () => {
    expect(buildDevelopmentRebuildPrompt()).toBe(
      'WARNING: This will completely erase jupiter_db.\nType REBUILD jupiter_db to continue: ',
    );
  });

  it('assembles the guarded rebuild environment without leaking the operator password', () => {
    const env = buildDevelopmentRebuildCommandEnvironment({
      DB_HOST: '127.0.0.1',
      DB_PORT: '5432',
      DB_ADMIN_PASSWORD: 'secret-admin',
    });
    expect(env.DB_MIGRATION_NAME).toBe('jupiter_db');
    expect(env.CONFIRM_DEVELOPMENT_REBUILD_DATABASE).toBe('jupiter_db');
    expect(env.DB_MIGRATION_USER).toBe('postgres');
    expect(env.DB_MIGRATION_HOST).toBe('127.0.0.1');
    expect(env.DB_MIGRATION_PORT).toBe('5432');
    expect(env.DB_MIGRATION_PASSWORD).toBe('secret-admin');
    expect(env.ALLOW_DEVELOPMENT_REBUILD).toBe('YES');
    expect(env.ALLOW_UNIFIED_DATABASE_MIGRATION).toBe('YES');
    expect(env.ALLOW_JUPITER_DB_REBUILD).toBe('YES');
    expect(env.NODE_ENV).toBe('development');
  });

  it('refuses to assemble an environment without an admin password', () => {
    expect(() => buildDevelopmentRebuildCommandEnvironment({})).toThrow(
      DevelopmentRebuildCommandError,
    );
  });

  it('formats a future-proof summary using the queried migration head', () => {
    expect(
      formatDevelopmentRebuildSummary({
        migrationHead: '619_add_user_retirement.ts',
        requiredSeeds: true,
        hardening: true,
        systemOwnerReady: true,
      }),
    ).toBe(
      'jupiter_db REBUILD COMPLETE\nMigration head: 619_add_user_retirement.ts\nRequired seeds: PASS\nHardening: PASS\nSystem owner: READY FOR LOGIN (systemowner@jupiter.local)',
    );
    // Never hard-codes 619 as the permanent head.
    expect(
      formatDevelopmentRebuildSummary({ migrationHead: '700_future.ts', requiredSeeds: false, hardening: false, systemOwnerReady: false }),
    ).toContain('Migration head: 700_future.ts');
  });

  it('assembles the System Owner bootstrap environment with canonical identity and no password', () => {
    const env = buildSystemOwnerBootstrapEnvironment();
    expect(env.DB_NAME).toBe('jupiter_db');
    expect(env.PLATFORM_OWNER_USER_ID).toBe('a5319d4e-eac5-4936-8824-b6ed94cc5d8f');
    expect(env.PLATFORM_OWNER_EMAIL).toBe('systemowner@jupiter.local');
    expect(env.PLATFORM_OWNER_DISPLAY_NAME).toBe('Jupiter System Owner');
    expect(env.PLATFORM_OWNER_CONFIRMATION).toBe(
      'BOOTSTRAP:jupiter_db:a5319d4e-eac5-4936-8824-b6ed94cc5d8f:systemowner@jupiter.local',
    );
    expect(env.ALLOW_CREATE_SYSTEM_OWNER_USER).toBe('YES');
    expect(env.ALLOW_INITIAL_SYSTEM_OWNER_PREFLIGHT).toBe('YES');
    expect(env.ALLOW_INITIAL_SYSTEM_OWNER_BOOTSTRAP).toBe('YES');
    expect(env.ALLOW_SET_SYSTEM_OWNER_PASSWORD).toBe('YES');
    // No password/secret is ever present in the assembled environment.
    for (const value of Object.values(env)) {
      expect(value).not.toMatch(/password|secret|token/i);
    }
  });
});
