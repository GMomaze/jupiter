import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('migration runner production privilege baseline integration', () => {
  const source = readFileSync('src/scripts/migrationRunner.ts', 'utf8');

  it('invokes the privilege baseline for non-test targets', () => {
    expect(source).toContain('applyAndVerifyDatabasePrivilegeBaseline');
    expect(source).toContain('applyPrivilegeBaselineForTarget');
  });

  it('grants only jupiter_app on production and both roles otherwise', () => {
    expect(source).toContain(
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
});
