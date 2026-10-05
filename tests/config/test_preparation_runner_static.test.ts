import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('test preparation runner authority separation', () => {
  const source = readFileSync('src/scripts/testDatabasePreparation.ts', 'utf8');
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };

  it('routes reset to preparation and migration to the M2 guard', () => {
    expect(packageJson.scripts['db:test:reset']).toContain(
      'testDatabasePreparation.ts reset'
    );
    expect(packageJson.scripts['db:test:migrate']).toBe('npm run migration:test');
    expect(source).toContain('runAdministrativePreparation(action)');
  });

  it('uses isolated migration credentials and separate approval', () => {
    expect(source).toContain("buildUnifiedMigrationConfig(process.env, 'test')");
    expect(source).toContain('ALLOW_TEST_DATABASE_PREPARATION');
    expect(source).toContain('assertTestPreparationIdentities');
    expect(source).not.toContain('DB_ADMIN_PASSWORD');
  });

  it('runs reset DDL only through the administrator client', () => {
    expect(source).toContain("await admin.query('DROP SCHEMA public CASCADE')");
    expect(source).toContain(
      "await admin.query('CREATE SCHEMA public AUTHORIZATION postgres')"
    );
    expect(source).not.toContain("runtime.query('DROP SCHEMA");
  });

  it('routes undo through migration-test and preserves runtime seeding', () => {
    expect(source).toContain("runSequelizeCli('db:migrate:undo', 'migration-test')");
    expect(source).toContain("runSequelizeCli('db:seed:all', 'test')");
    expect(source).toContain('assertTestDatabaseSafety(runtime)');
  });

  it('uses transactional hardening verification and always closes the admin client', () => {
    expect(source).toContain('applyAndVerifyDatabasePrivilegeBaseline(admin)');
    expect(source).toContain('await admin.end().catch(() => undefined)');
  });
});
