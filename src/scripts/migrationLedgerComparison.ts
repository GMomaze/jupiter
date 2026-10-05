import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const MIGRATION_DIRECTORY = resolve(process.cwd(), 'migrations');

export interface MigrationLedgerComparison {
  readonly files: readonly string[];
  readonly ledger: readonly string[];
  readonly pending: readonly string[];
  readonly unexpected: readonly string[];
}

function requireUnique(names: readonly string[], source: 'files' | 'ledger'): void {
  if (new Set(names).size !== names.length) {
    throw new Error(`MIGRATION_LEDGER_COMPARISON: duplicate ${source} migration identity`);
  }
}

export function normalizeMigrationLedgerName(name: string): string {
  return name.endsWith('.js') ? `${name.slice(0, -3)}.ts` : name;
}

export function enumerateMigrationFiles(
  directory: string = MIGRATION_DIRECTORY,
): readonly string[] {
  const names = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^\d+[_-].+\.ts$/.test(name))
    .sort((left, right) => left.localeCompare(right));
  requireUnique(names, 'files');
  return Object.freeze(names);
}

export function compareMigrationLedger(
  fileNames: readonly string[],
  ledgerNames: readonly string[],
): MigrationLedgerComparison {
  const files = [...fileNames];
  const ledger = ledgerNames.map(normalizeMigrationLedgerName);
  requireUnique(files, 'files');
  requireUnique(ledger, 'ledger');

  const pending = files.filter((name) => !ledger.includes(name));
  const unexpected = ledger.filter((name) => !files.includes(name));
  if (pending.length > 0 || unexpected.length > 0) {
    throw new Error(
      `MIGRATION_LEDGER_COMPARISON: pending=${pending.join(',') || 'none'}; unexpected=${unexpected.join(',') || 'none'}`,
    );
  }
  if (files.some((name, index) => ledger[index] !== name)) {
    throw new Error('MIGRATION_LEDGER_COMPARISON: migration ordering mismatch');
  }

  return Object.freeze({
    files: Object.freeze(files),
    ledger: Object.freeze(ledger),
    pending: Object.freeze([]),
    unexpected: Object.freeze([]),
  });
}

export function verifyRepositoryMigrationLedger(
  ledgerNames: readonly string[],
): MigrationLedgerComparison {
  return compareMigrationLedger(enumerateMigrationFiles(), ledgerNames);
}

/**
 * Returns the current canonical repository migration head (the last ordered
 * migration file). This replaces any hard-coded migration-head pin so the
 * guarded bootstrap and readiness checks track the repository's actual head
 * rather than a stale constant.
 */
export function resolveCanonicalMigrationHead(): string {
  const files = enumerateMigrationFiles();
  const head = files[files.length - 1];
  if (!head) {
    throw new Error('MIGRATION_LEDGER_COMPARISON: migration repository is empty');
  }
  return head;
}
