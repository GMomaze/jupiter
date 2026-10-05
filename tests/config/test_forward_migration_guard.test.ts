import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('test forward-migration command authority', () => {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };
  const preparation = readFileSync(
    'src/scripts/testDatabasePreparation.ts',
    'utf8'
  );
  const runner = readFileSync('src/scripts/migrationRunner.ts', 'utf8');

  it('aliases db:test:migrate to the guarded unified test path', () => {
    expect(packageJson.scripts['db:test:migrate']).toBe(
      'npm run migration:test'
    );
    expect(packageJson.scripts['migration:test']).toBe(
      'tsx src/scripts/migrationRunner.ts test'
    );
  });

  it('does not expose an unguarded package forward-migration command', () => {
    const forwardMigrationScripts = Object.entries(packageJson.scripts).filter(
      ([name]) => name === 'db:migrate' || name === 'db:test:migrate'
        || name.startsWith('migration:')
    );
    expect(forwardMigrationScripts).toEqual([
      ['db:migrate', 'npm run migration:development'],
      ['db:test:migrate', 'npm run migration:test'],
      ['migration:development', 'tsx src/scripts/migrationRunner.ts development'],
      ['migration:test', 'tsx src/scripts/migrationRunner.ts test'],
      ['migration:production', 'tsx src/scripts/migrationRunner.ts production'],
    ]);
    for (const [, command] of forwardMigrationScripts) {
      expect(command).not.toMatch(/sequelize-cli\s+db:migrate/);
      expect(command).not.toContain('testDatabasePreparation.ts migrate');
    }
  });

  it('fails closed if the legacy preparation migrate action is called directly', () => {
    expect(preparation).toContain("if (action === 'migrate')");
    expect(preparation).toContain(
      'forward migration is disabled; use npm run migration:test'
    );
    expect(preparation).not.toContain("migrate: 'db:migrate'");
    expect(preparation).not.toContain("[cliPath, 'db:migrate', '--env', 'test']");
  });

  it('keeps migration credentials and authorization separate from test runtime', () => {
    expect(runner).toContain('loadMigrationTargetEnvironment(target)');
    expect(runner).toContain('buildUnifiedMigrationConfig(process.env, target)');
    expect(runner).toContain("process.env.ALLOW_UNIFIED_DATABASE_MIGRATION !== 'YES'");
    expect(runner).toContain('assertMigrationLiveIdentity(client, config)');
    expect(runner).not.toContain('process.env.DB_USER');
    expect(runner).not.toContain('process.env.DB_PASSWORD');
  });

  it('validates target before loading and configuration before approval', () => {
    const main = runner.slice(runner.indexOf('async function main()'));
    expect(main.indexOf('const target = parseTarget(process.argv[2])')).toBeLessThan(
      main.indexOf('loadMigrationTargetEnvironment(target)')
    );
    expect(main.indexOf('loadMigrationTargetEnvironment(target)')).toBeLessThan(
      main.indexOf('buildUnifiedMigrationConfig(process.env, target)')
    );
    expect(main.indexOf('buildUnifiedMigrationConfig(process.env, target)')).toBeLessThan(
      main.indexOf('requireApproval()')
    );
  });
});
