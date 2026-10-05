import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  compareMigrationLedger,
  enumerateMigrationFiles,
  verifyRepositoryMigrationLedger,
} from '../support/migrationLedgerComparison.js';

describe('migration ledger comparison harness', () => {
  const files = enumerateMigrationFiles();

  it('enumerates exact repository migration basenames and approved lineage', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((name) => name.startsWith('590_'))).toEqual([
      '590_add_root_operational_tenant_ownership.ts',
    ]);
    expect(files.filter((name) => name.startsWith('595_'))).toEqual([
      '595_add_legacy_component_custody_and_movement_history.ts',
    ]);
    expect(files.filter((name) => name.startsWith('596_'))).toEqual([
      '596_restrict_legacy_component_history_runtime_privileges.ts',
    ]);
    expect(
      createHash('sha256')
        .update(readFileSync('migrations/590_add_root_operational_tenant_ownership.ts'))
        .digest('hex')
        .toUpperCase(),
    ).toBe('BD7A301AEDC28C3D6B1ACFB179D3F5048BF721399B84FBAC3D4511E361F43EDB');
  });

  it('reproduces and detects the prior over-escaped inline regex defect', () => {
    const defective = files.filter((name) => /^\\d+.*\\.ts$/.test(name));
    expect(defective).toEqual([]);
    expect(() => compareMigrationLedger(defective, files)).toThrow(
      'unexpected=',
    );
  });

  it('accepts an exact ordered synthetic ledger including compiled extensions', () => {
    const compiledLedger = files.map((name) => name.replace(/\.ts$/, '.js'));
    expect(verifyRepositoryMigrationLedger(compiledLedger)).toMatchObject({
      files,
      ledger: files,
      pending: [],
      unexpected: [],
    });
  });

  it('classifies a missing ledger entry as pending', () => {
    expect(() => compareMigrationLedger(files, files.slice(0, -1))).toThrow(
      `pending=${files.at(-1)}`,
    );
  });

  it('rejects an unexpected ledger entry', () => {
    expect(() => compareMigrationLedger(files, [...files, '999_unexpected.ts'])).toThrow(
      'unexpected=999_unexpected.ts',
    );
  });

  it('rejects duplicate normalized ledger identities', () => {
    expect(() => compareMigrationLedger(files, [...files, files[0]])).toThrow(
      'duplicate ledger migration identity',
    );
  });

  it('rejects duplicate file identities', () => {
    expect(() => compareMigrationLedger([...files, files[0]], files)).toThrow(
      'duplicate files migration identity',
    );
  });

  it('rejects a ledger ordering mismatch', () => {
    const reversed = [...files].reverse();
    expect(() => compareMigrationLedger(files, reversed)).toThrow(
      'migration ordering mismatch',
    );
  });
});
