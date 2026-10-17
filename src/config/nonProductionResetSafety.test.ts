import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  NON_PRODUCTION_RESET_ERROR,
  validateNonProductionResetConfiguration,
  validateNonProductionResetIdentity,
  assertBackupPathAvailable,
  assertBackupArchiveValid,
  buildResetReconciliationSql,
  assertResetReconciliation,
  REQUIRED_OPERATIONAL_ROLES,
  type ResetReconciliation,
} from './nonProductionResetSafety.js';

function validEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ALLOW_NON_PRODUCTION_RESET: 'YES',
    ALLOW_UNIFIED_DATABASE_MIGRATION: 'YES',
    DB_MIGRATION_NAME: 'jupiter_db',
    CONFIRM_NON_PRODUCTION_RESET_DATABASE: 'jupiter_db',
    NON_PRODUCTION_RESET_BACKUP_PATH: '/tmp/jupiter_db_pre_reset.dump',
    DB_MIGRATION_USER: 'postgres',
    DB_ADMIN_PASSWORD: 'secret',
    DB_MIGRATION_HOST: '127.0.0.1',
    DB_MIGRATION_PORT: '5432',
    ...overrides,
  };
}

describe('non-production reset configuration gate', () => {
  it('accepts a fully authorised configuration', () => {
    const config = validateNonProductionResetConfiguration(validEnv());
    expect(config.database).toBe('jupiter_db');
    expect(config.backupPath).toBe('/tmp/jupiter_db_pre_reset.dump');
    expect(config.username).toBe('postgres');
    expect(config.port).toBe(5432);
  });

  it('fails closed without the explicit non-production reset authorisation', () => {
    expect(() =>
      validateNonProductionResetConfiguration(validEnv({ ALLOW_NON_PRODUCTION_RESET: '' })),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
    expect(() =>
      validateNonProductionResetConfiguration(validEnv({ ALLOW_NON_PRODUCTION_RESET: 'NO' })),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
  });

  it('fails closed without unified migration approval', () => {
    expect(() =>
      validateNonProductionResetConfiguration(validEnv({ ALLOW_UNIFIED_DATABASE_MIGRATION: '' })),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
  });

  it('fails closed when the confirmation does not match the database', () => {
    expect(() =>
      validateNonProductionResetConfiguration(
        validEnv({ CONFIRM_NON_PRODUCTION_RESET_DATABASE: 'other_db' }),
      ),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
  });

  it('refuses the guarded test and system databases', () => {
    for (const database of ['jupiter_test', 'postgres', 'template0', 'template1']) {
      expect(() =>
        validateNonProductionResetConfiguration(
          validEnv({
            DB_MIGRATION_NAME: database,
            CONFIRM_NON_PRODUCTION_RESET_DATABASE: database,
          }),
        ),
      ).toThrow(NON_PRODUCTION_RESET_ERROR);
    }
  });

  it('fails closed without a mandatory backup path', () => {
    expect(() =>
      validateNonProductionResetConfiguration(validEnv({ NON_PRODUCTION_RESET_BACKUP_PATH: '' })),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
  });

  it('fails closed unless the administrator user is exactly postgres', () => {
    expect(() =>
      validateNonProductionResetConfiguration(validEnv({ DB_MIGRATION_USER: 'jupiter_app' })),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
  });

  it('fails closed on an invalid port', () => {
    expect(() =>
      validateNonProductionResetConfiguration(validEnv({ DB_MIGRATION_PORT: 'abc' })),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
    expect(() =>
      validateNonProductionResetConfiguration(validEnv({ DB_MIGRATION_PORT: '0' })),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
  });
});

describe('non-production reset identity gate', () => {
  const config = validateNonProductionResetConfiguration(validEnv());

  function identity(overrides: Record<string, unknown> = {}) {
    return {
      database_name: 'jupiter_db',
      current_user: 'postgres',
      session_user: 'postgres',
      server_address: '127.0.0.1',
      server_port: 5432,
      transaction_read_only: 'off',
      ...overrides,
    };
  }

  it('accepts a matching live identity', () => {
    expect(() =>
      validateNonProductionResetIdentity(config, identity() as never, ['127.0.0.1']),
    ).not.toThrow();
  });

  it('fails closed on a database mismatch', () => {
    expect(() =>
      validateNonProductionResetIdentity(config, identity({ database_name: 'other' }) as never, ['127.0.0.1']),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
  });

  it('fails closed on a user mismatch', () => {
    expect(() =>
      validateNonProductionResetIdentity(config, identity({ current_user: 'jupiter_app' }) as never, ['127.0.0.1']),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
  });

  it('fails closed on a server address mismatch', () => {
    expect(() =>
      validateNonProductionResetIdentity(config, identity({ server_address: '10.0.0.1' }) as never, ['127.0.0.1']),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
  });

  it('fails closed when the server is read-only', () => {
    expect(() =>
      validateNonProductionResetIdentity(config, identity({ transaction_read_only: 'on' }) as never, ['127.0.0.1']),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
  });
});

describe('backup path availability', () => {
  it('allows an unused backup path', () => {
    expect(() => assertBackupPathAvailable('/tmp/new.dump', () => false)).not.toThrow();
  });

  it('refuses to overwrite an existing backup', () => {
    expect(() => assertBackupPathAvailable('/tmp/existing.dump', () => true)).toThrow(
      /refusing to overwrite/,
    );
  });
});

describe('reset reconciliation', () => {
  const expectation = {
    expectedHead: '626_add_staff_password_recovery.ts',
    systemOwnerUserId: 'a5319d4e-eac5-4936-8824-b6ed94cc5d8f',
    systemOwnerEmail: 'systemowner@jupiter.local',
    expectedGrantCount: 6,
  };

  function reconciled(overrides: Partial<ResetReconciliation> = {}): ResetReconciliation {
    return {
      migration_head: '626_add_staff_password_recovery.ts',
      role_count: 7,
      mapping_count: 10,
      hardened_no_public_create: true,
      hardened_app_usage: true,
      owner_user: 1,
      owner_principal: 1,
      owner_grants: 6,
      ...overrides,
    };
  }

  it('accepts a complete, hardened post-reset state', () => {
    expect(() => assertResetReconciliation(reconciled(), expectation)).not.toThrow();
  });

  it('rejects a mismatched migration head', () => {
    expect(() =>
      assertResetReconciliation(reconciled({ migration_head: '600_create_platform_file_operations.ts' }), expectation),
    ).toThrow(/migration head/);
  });

  it('rejects missing operational roles', () => {
    expect(() => assertResetReconciliation(reconciled({ role_count: 6 }), expectation)).toThrow(
      /operational roles/,
    );
  });

  it('rejects missing RBAC mappings', () => {
    expect(() => assertResetReconciliation(reconciled({ mapping_count: 0 }), expectation)).toThrow(
      /role-permission mappings/,
    );
  });

  it('rejects incomplete privilege hardening', () => {
    expect(() =>
      assertResetReconciliation(reconciled({ hardened_no_public_create: false }), expectation),
    ).toThrow(/hardening/);
  });

  it('rejects an un-established System Owner identity', () => {
    expect(() => assertResetReconciliation(reconciled({ owner_principal: 0 }), expectation)).toThrow(
      /System Owner identity/,
    );
  });

  it('rejects incomplete System Owner capability grants', () => {
    expect(() => assertResetReconciliation(reconciled({ owner_grants: 5 }), expectation)).toThrow(
      /capability grants/,
    );
  });

  it('defines the seven required operational roles', () => {
    expect(REQUIRED_OPERATIONAL_ROLES).toEqual([
      'ADMIN', 'ENGINEER', 'MECHANIC', 'SUPERVISOR', 'QA', 'PLANNER', 'VIEWER',
    ]);
  });

  it('builds a reconciliation query referencing the canonical owner and hardening checks', () => {
    const sql = buildResetReconciliationSql(expectation.systemOwnerUserId);
    expect(sql).toContain('"SequelizeMeta"');
    expect(sql).toContain('rf_role_permissions');
    expect(sql).toContain('has_schema_privilege');
    expect(sql).toContain('platform_principals');
    expect(sql).toContain('platform_capability_grants');
  });
});

describe('credential variable contract', () => {
  it('requires DB_ADMIN_PASSWORD, not the historical DB_MIGRATION_PASSWORD', () => {
    expect(() =>
      validateNonProductionResetConfiguration(
        validEnv({ DB_ADMIN_PASSWORD: '', DB_MIGRATION_PASSWORD: 'secret' }),
      ),
    ).toThrow(NON_PRODUCTION_RESET_ERROR);
  });

  it('documents DB_ADMIN_PASSWORD (not DB_MIGRATION_PASSWORD) as the operator credential', () => {
    const runbook = readFileSync('docs/runbooks/NON_PRODUCTION_RESET.md', 'utf8');
    expect(runbook).toContain('DB_ADMIN_PASSWORD=');
    expect(runbook).not.toContain('DB_MIGRATION_PASSWORD=');
  });
});

describe('backup archive validation', () => {
  it('accepts a PostgreSQL 18.6 archive listing (leading whitespace before TOC Entries)', () => {
    const pg18 = ';     TOC Entries: 993\n5; 2615 SCHEMA - public postgres\n';
    expect(() =>
      assertBackupArchiveValid({ exitCode: 0, stdout: pg18, stderr: '' }),
    ).not.toThrow();
  });

  it('retains compatibility with a PostgreSQL 17 archive listing', () => {
    const pg17 = ';     TOC Entries: 543\n5; 2615 SCHEMA - public postgres\n';
    expect(() =>
      assertBackupArchiveValid({ exitCode: 0, stdout: pg17, stderr: '' }),
    ).not.toThrow();
  });

  it('accepts a single-space TOC Entries header variant', () => {
    const single = '; TOC Entries: 993\n5; 2615 SCHEMA - public postgres\n';
    expect(() =>
      assertBackupArchiveValid({ exitCode: 0, stdout: single, stderr: '' }),
    ).not.toThrow();
  });

  it('rejects a non-zero pg_restore exit (corrupt/truncated/invalid archive)', () => {
    expect(() =>
      assertBackupArchiveValid({ exitCode: 1, stdout: '', stderr: 'input file is too short' }),
    ).toThrow(/not a valid PostgreSQL custom-format archive/);
  });

  it('rejects a spawn failure (null exit code)', () => {
    expect(() =>
      assertBackupArchiveValid({ exitCode: null, stdout: '', stderr: 'spawn pg_restore ENOENT' }),
    ).toThrow(/not a valid PostgreSQL custom-format archive/);
  });

  it('rejects an empty listing even on exit code 0', () => {
    expect(() =>
      assertBackupArchiveValid({ exitCode: 0, stdout: '', stderr: '' }),
    ).toThrow(/empty or unreadable/);
  });

  it('rejects a listing missing the table of contents header', () => {
    expect(() =>
      assertBackupArchiveValid({ exitCode: 0, stdout: 'not a toc', stderr: '' }),
    ).toThrow(/missing table of contents/);
  });

  it('rejects a malformed TOC Entries header without an entry count', () => {
    expect(() =>
      assertBackupArchiveValid({ exitCode: 0, stdout: ';     TOC Entries:\n', stderr: '' }),
    ).toThrow(/missing table of contents/);
  });
});

describe('reset orchestration ordering', () => {
  const source = readFileSync('src/scripts/resetNonProductionDatabase.ts', 'utf8');

  it('validates the backup archive with pg_restore --list', () => {
    expect(source).toContain('pg_restore');
    expect(source).toContain("'--list'");
  });

  it('validates the backup before starting the destructive rebuild', () => {
    const backupIdx = source.indexOf('await backup(config)');
    const validateIdx = source.indexOf('await verifyBackupArchive(config.backupPath)');
    const rebuildIdx = source.indexOf("runTsx('src/scripts/developmentRebuild.ts'");
    expect(backupIdx).toBeGreaterThanOrEqual(0);
    expect(validateIdx).toBeGreaterThanOrEqual(0);
    expect(rebuildIdx).toBeGreaterThanOrEqual(0);
    expect(backupIdx).toBeLessThan(validateIdx);
    expect(validateIdx).toBeLessThan(rebuildIdx);
  });

  it('backup archive validation failure propagates as an error (never swallowed)', () => {
    expect(() =>
      assertBackupArchiveValid({ exitCode: 1, stdout: '', stderr: 'bad' }),
    ).toThrow();
  });
});
