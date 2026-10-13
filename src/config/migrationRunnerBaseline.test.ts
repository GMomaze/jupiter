import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('migration runner production privilege baseline integration', () => {
  const source = readFileSync('src/scripts/migrationRunner.ts', 'utf8');

  it('invokes the privilege baseline for non-test targets', () => {
    expect(source).toContain('applyAndVerifyDatabasePrivilegeBaseline');
    expect(source).toContain('applyPrivilegeBaselineForTarget');
  });

  it('resolves the baseline runtime roles dynamically (never a hard jupiter_test requirement)', () => {
    expect(source).toContain('resolveRuntimeRolesForPrivilegeBaseline');
    expect(source).not.toContain(
      "target === 'production' ? ['jupiter_app'] : ['jupiter_app', 'jupiter_test']"
    );
  });

  it('skips the test target', () => {
    expect(source).toContain("if (target === 'test') return;");
  });

  it('runs the baseline after the temporary-role cleanup', () => {
    const finalizeIndex = source.indexOf(
      'finalizeMigrationCompatibility(client, target)'
    );
    const baselineIndex = source.indexOf(
      'applyPrivilegeBaselineForTarget(client, target)'
    );
    expect(finalizeIndex).toBeGreaterThan(-1);
    expect(baselineIndex).toBeGreaterThan(finalizeIndex);
  });

  it('always removes the temporary role even when the migration fails', () => {
    expect(source).toContain('runMigrationWithCleanup');
    expect(source).toContain('() => runSequelize(target)');
    expect(source).toContain('() => finalizeMigrationCompatibility(client, target)');
  });
});
