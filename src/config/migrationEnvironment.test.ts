import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadMigrationTargetEnvironment } from './migrationEnvironment.js';

const temporaryDirectories: string[] = [];

function fixture(files: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), 'jupiter-migration-env-'));
  temporaryDirectories.push(directory);
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(directory, name), contents, 'utf8');
  }
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('migration target environment loading', () => {
  it('loads only .env.test for the test target with established override semantics', () => {
    const cwd = fixture({
      '.env.test': [
        'DB_MIGRATION_HOST=127.0.0.1',
        'DB_MIGRATION_NAME=jupiter_test',
        'DB_MIGRATION_USER=postgres',
        'DB_MIGRATION_PASSWORD=test-file-placeholder',
        'ALLOW_UNIFIED_DATABASE_MIGRATION=YES',
      ].join('\n'),
      '.env': 'DB_MIGRATION_NAME=must-not-load',
    });
    const environment: NodeJS.ProcessEnv = {
      DB_MIGRATION_NAME: 'stale-process-value',
      DB_USER: 'jupiter_test',
      DB_PASSWORD: 'runtime-only-placeholder',
    };

    const result = loadMigrationTargetEnvironment('test', environment, cwd);

    expect(result).toEqual({ path: join(cwd, '.env.test'), override: true });
    expect(environment).toMatchObject({
      DB_MIGRATION_HOST: '127.0.0.1',
      DB_MIGRATION_NAME: 'jupiter_test',
      DB_MIGRATION_USER: 'postgres',
      DB_MIGRATION_PASSWORD: 'test-file-placeholder',
      ALLOW_UNIFIED_DATABASE_MIGRATION: 'YES',
      DB_USER: 'jupiter_test',
      DB_PASSWORD: 'runtime-only-placeholder',
    });
  });

  it.each(['development', 'production'] as const)(
    'loads established .env for %s without overriding deliberate process values',
    target => {
      const cwd = fixture({
        '.env': 'DB_MIGRATION_NAME=file-database\nDB_MIGRATION_USER=postgres',
        '.env.test': 'DB_MIGRATION_NAME=jupiter_test',
      });
      const environment: NodeJS.ProcessEnv = {
        DB_MIGRATION_NAME: 'operator-database',
      };

      const result = loadMigrationTargetEnvironment(target, environment, cwd);

      expect(result).toEqual({ path: join(cwd, '.env'), override: false });
      expect(environment.DB_MIGRATION_NAME).toBe('operator-database');
      expect(environment.DB_MIGRATION_USER).toBe('postgres');
    }
  );
});
