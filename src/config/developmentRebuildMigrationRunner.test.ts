import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('development rebuild guarded migration invocation', () => {
  const source = readFileSync('src/scripts/developmentRebuild.ts', 'utf8');

  it('wraps the sequelize migration with the guarded compatibility bootstrap', () => {
    expect(source).toContain("prepareMigrationCompatibility(admin, 'development')");
    expect(source).toContain("finalizeMigrationCompatibility(admin, 'development')");
    expect(source).toContain(
      "runSequelizeCli(['db:migrate', '--env', 'migration-development'])",
    );
  });

  it('always removes the temporary role on migration failure (runMigrationWithCleanup)', () => {
    expect(source).toContain('runMigrationWithCleanup');
    expect(source).toContain("() => finalizeMigrationCompatibility(admin, 'development')");
  });

  it('verifies only the runtime roles that actually exist (no hard jupiter_test requirement)', () => {
    expect(source).toContain('resolveRuntimeRolesForPrivilegeBaseline');
    expect(source).toContain('applyAndVerifyDatabasePrivilegeBaseline(admin, runtimeRoles)');
    // The previous unconditional default (which hard-required jupiter_test) is gone.
    expect(source).not.toContain('applyAndVerifyDatabasePrivilegeBaseline(admin);');
  });
});
