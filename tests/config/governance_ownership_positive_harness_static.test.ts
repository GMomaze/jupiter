import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(),
  'tests/integration/component_life_limit_governance_ownership_positive.test.ts'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

describe('guarded positive governance ownership harness lifecycle', () => {
  it('fails closed on exact identities and explicit connection configuration', () => {
    for (const fragment of ["process.env.NODE_ENV !== 'test'", "process.env.DB_NAME !== 'jupiter_test'",
      "process.env.DB_USER !== 'jupiter_test'", "process.env.ALLOW_TEST_DATABASE_RESET !== 'YES'",
      "process.env.ALLOW_GOVERNANCE_OWNERSHIP_TEST !== 'YES'", "process.env.DB_ADMIN_USER !== 'postgres'",
      "process.env.RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST !== 'YES'",
      "required('DB_ADMIN_PASSWORD')", "required('DB_HOST')", "required('DB_PORT')",
      "database: 'jupiter_test'", "username: 'postgres'", "user: 'jupiter_test'"]) expect(source).toContain(fragment);
  });
  it('requires a process-scoped invocation flag that ordinary npm test disables', () => {
    expect(source).toContain("process.env.ALLOW_GOVERNANCE_OWNERSHIP_TEST === 'YES'");
    expect(source).toContain("process.env.RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST === 'YES'");
    expect(source).toContain("override: false");
    expect(packageJson.scripts.test).toContain('RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST=NO');
    expect(packageJson.scripts['test:governance-ownership-positive']).toContain(
      'RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST=YES'
    );
    expect(packageJson.scripts['test:governance-ownership-positive']).toContain(
      'component_life_limit_governance_ownership_positive.test.ts'
    );
  });
  it('orders ordinary migrations and seeds before administrator repair', () => {
    const preparation = source.slice(source.indexOf('async function runOrdinaryPreparation'), source.indexOf('async function verifyOrdinaryOwnership'));
    expect(preparation.indexOf('mark582ForSeparateAdministration')).toBeLessThan(preparation.indexOf("db:test:migrate"));
    expect(preparation.indexOf("db:test:migrate")).toBeLessThan(preparation.indexOf("db:test:seed"));
    const workflow = source.slice(source.indexOf("positiveTest('prepares"));
    expect(workflow.indexOf('runOrdinaryPreparation')).toBeLessThan(workflow.indexOf('applyOwnershipBoundary'));
  });
  it('grants only the two entry functions to jupiter_test', () => {
    expect(source).toContain('for (const signature of ENTRY_FUNCTIONS)');
    expect(source).toContain('GRANT EXECUTE ON FUNCTION ${signature} TO jupiter_test');
    expect(source).not.toMatch(/GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL).*jupiter_test/is);
    expect(source).not.toContain('GRANT jupiter_governance_owner TO jupiter_test');
  });
  it('requires narrow governance-owner schema resolution without schema creation', () => {
    const migration = readFileSync(resolve(process.cwd(),
      'migrations/582_repair_component_life_limit_governance_ownership.ts'), 'utf8');
    expect(migration).toContain('GRANT USAGE ON SCHEMA public TO ${GOVERNANCE_OWNER}');
    expect(migration).toContain('REVOKE CREATE ON SCHEMA public FROM ${GOVERNANCE_OWNER}');
    expect(migration).not.toContain('GRANT CREATE ON SCHEMA public');
    expect(migration).toContain("acl.grantee=0 AND acl.privilege_type='EXECUTE'");
    expect(migration).toContain("acl.grantee=0 AND acl.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')");
    expect(source).toContain("has_schema_privilege('jupiter_governance_owner','public','USAGE')");
    expect(source).toContain("has_schema_privilege('jupiter_governance_owner','public','CREATE')");
    expect(source).toContain('expect(schemaAcl).toEqual({ owner_usage: true, owner_create: false })');
  });
  it('always restores migrations, seeds, ownership, ACLs, ledger and empty fixtures', () => {
    const restoration = source.slice(source.indexOf('async function restoreGuardedTestDatabase'), source.indexOf("describe('guarded positive"));
    for (const fragment of ['db:test:reset', 'runOrdinaryPreparation', 'verifyOrdinaryOwnership',
      'applyOwnershipBoundary', 'verifyLedgerSeedsAndNoFixtures']) expect(restoration).toContain(fragment);
    expect(source).toContain('await restoreGuardedTestDatabase(admin, runtime)');
    expect(source).toContain('workflow and restoration both failed');
  });
});
