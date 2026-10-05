import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { buildUnifiedMigrationConfig } = require(
  '../../sequelize-migration-config.cjs'
) as {
  buildUnifiedMigrationConfig: (
    environment: Record<string, string | undefined>,
    target: 'development' | 'test' | 'production'
  ) => Record<string, unknown>;
};

const approved = {
  DB_MIGRATION_USER: 'postgres',
  DB_MIGRATION_PASSWORD: 'placeholder-only',
  DB_MIGRATION_HOST: '127.0.0.1',
  DB_MIGRATION_PORT: '5432',
  DB_MIGRATION_NAME: 'jupiter_db',
  DB_USER: 'jupiter_app',
  DB_PASSWORD: 'runtime-placeholder',
};

describe('unified migration configuration', () => {
  it.each([
    'DB_MIGRATION_USER',
    'DB_MIGRATION_PASSWORD',
    'DB_MIGRATION_HOST',
    'DB_MIGRATION_PORT',
    'DB_MIGRATION_NAME',
  ])('fails closed when %s is missing', key => {
    expect(() =>
      buildUnifiedMigrationConfig({ ...approved, [key]: undefined }, 'development')
    ).toThrow(`MIGRATION_CONFIG: ${key} is required`);
  });

  it('does not fall back to runtime credentials', () => {
    const { DB_MIGRATION_USER: _user, DB_MIGRATION_PASSWORD: _password, ...runtimeOnly } = approved;
    expect(() => buildUnifiedMigrationConfig(runtimeOnly, 'development')).toThrow(
      'DB_MIGRATION_USER is required'
    );
  });

  it.each(['jupiter_app', 'jupiter_test', 'jupiter_admin']) (
    'rejects non-postgres migration identity %s',
    username => {
      expect(() =>
        buildUnifiedMigrationConfig(
          { ...approved, DB_MIGRATION_USER: username },
          'development'
        )
      ).toThrow('DB_MIGRATION_USER must be exactly postgres');
    }
  );

  it('requires the exact test database', () => {
    expect(() => buildUnifiedMigrationConfig(approved, 'test')).toThrow(
      'test target database must be exactly jupiter_test'
    );
  });

  it.each(['development', 'production'] as const)(
    'rejects test database crossover for %s',
    target => {
      expect(() =>
        buildUnifiedMigrationConfig(
          { ...approved, DB_MIGRATION_NAME: 'jupiter_test' },
          target
        )
      ).toThrow(`${target} target must not use the jupiter_test database`);
    }
  );

  it('returns only migration-specific connection values', () => {
    expect(buildUnifiedMigrationConfig(approved, 'development')).toMatchObject({
      username: 'postgres',
      password: 'placeholder-only',
      database: 'jupiter_db',
      host: '127.0.0.1',
      port: 5432,
    });
  });

  it('routes the ordinary forward-migration package command through the guard', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts['db:migrate']).toBe(
      'npm run migration:development'
    );
    expect(packageJson.scripts['migration:development']).toContain(
      'migrationRunner.ts development'
    );
    expect(packageJson.scripts['migration:test']).toContain(
      'migrationRunner.ts test'
    );
    expect(packageJson.scripts['migration:production']).toContain(
      'migrationRunner.ts production'
    );
    expect(packageJson.scripts['db:test:migrate']).toBe(
      'npm run migration:test'
    );
  });
});
