import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryTypes } from 'sequelize';
import { describe, expect, it } from 'vitest';
import sequelize from '../../src/config/database.js';
import ownershipRepair from '../../migrations/582_repair_component_life_limit_governance_ownership.js';

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/582_repair_component_life_limit_governance_ownership.ts'),
  'utf8'
);

describe('component life-limit governance ownership repair contract', () => {
  it('defines the exact fail-closed dedicated-owner and ACL boundary', () => {
    expect(migration).toContain("const GOVERNANCE_OWNER = 'jupiter_governance_owner'");
    expect(migration).toContain('COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNER_MISSING');
    expect(migration).toContain('COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNER_UNSAFE');
    expect(migration).not.toMatch(/CREATE\s+ROLE/i);
    expect(migration).toContain('NOT rolcanlogin');
    expect(migration).toContain('NOT rolsuper');
    expect(migration).toContain('NOT rolcreatedb');
    expect(migration).toContain('NOT rolcreaterole');
    expect(migration).toContain('NOT rolreplication');
    expect(migration).toContain('NOT rolbypassrls');
    expect(migration).toContain("pg_catalog.pg_has_role(:runtime, :owner, 'SET')");
    expect(migration).toContain('COMPONENT_LIFE_LIMIT_GOVERNANCE_MIGRATION_AUTHORITY_REQUIRED');
    expect(migration).toContain('GRANT USAGE ON SCHEMA public TO ${GOVERNANCE_OWNER}');
    expect(migration).toContain('REVOKE CREATE ON SCHEMA public FROM ${GOVERNANCE_OWNER}');
    expect(migration).toContain("has_schema_privilege(:owner,'public','USAGE')");
    expect(migration).toContain("has_schema_privilege(:owner,'public','CREATE')");
    expect(migration).toContain('REVOKE ALL ON TABLE public.component_life_limit_governance_transition_gate FROM ${RUNTIME_ROLE}');
    expect(migration).toContain('REVOKE ALL ON TABLE public.component_life_limit_governance_transition_gate FROM PUBLIC');
    expect(migration).toContain("acl.grantee=0 AND acl.privilege_type='EXECUTE'");
    expect(migration).toContain("acl.grantee=0 AND acl.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')");
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION ${signature} TO ${RUNTIME_ROLE}');
    expect(migration).toContain('ALTER FUNCTION ${signature} SECURITY DEFINER');
    expect(migration).toContain('ALTER FUNCTION ${signature} SET search_path = pg_catalog, public');
    expect(migration).toContain('COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNERSHIP_ROLLBACK_REFUSED');
    const sequelizeConfig = readFileSync(resolve(process.cwd(), 'sequelize.config.cjs'), 'utf8');
    expect(sequelizeConfig).toContain("'production-governance-repair'");
    expect(sequelizeConfig).toContain('buildGovernanceRepairConfig(process.env, databaseConfig)');
  });

  it('retains the fail-closed missing-owner branch without mutating a cluster role', () => {
    expect(migration).toContain("if (!role?.exists) throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNER_MISSING')");
    expect(migration).not.toMatch(/(?:CREATE|ALTER|DROP)\s+ROLE/i);
  });

  it('confirms the guarded test database uses the existing exact safe governance owner', async () => {
    const [identity] = await sequelize.query<{ database_name: string; user_name: string }>(
      `SELECT current_database() AS database_name,current_user AS user_name`,
      { type: QueryTypes.SELECT }
    );
    expect(identity).toMatchObject({ database_name: 'jupiter_test', user_name: 'jupiter_test' });
    const [owner] = await sequelize.query<Record<string, boolean>>(
      `SELECT NOT rolcanlogin AS nologin,NOT rolsuper AS nosuperuser,
              NOT rolcreatedb AS nocreatedb,NOT rolcreaterole AS nocreaterole,
              NOT rolinherit AS noinherit,NOT rolreplication AS noreplication,
              NOT rolbypassrls AS nobypassrls,
              NOT pg_catalog.pg_has_role('jupiter_app',oid,'SET') AS app_cannot_set,
              NOT pg_catalog.pg_has_role('jupiter_test',oid,'SET') AS test_cannot_set
         FROM pg_catalog.pg_roles WHERE rolname='jupiter_governance_owner'`,
      { type: QueryTypes.SELECT }
    );
    expect(owner).toEqual({ nologin: true, nosuperuser: true, nocreatedb: true,
      nocreaterole: true, noinherit: true, noreplication: true, nobypassrls: true,
      app_cannot_set: true, test_cannot_set: true });
  });

  it('fails the real migration transaction closed when jupiter_test lacks administrator authority', async () => {
    const [before] = await sequelize.query<{ proposals: number; history: number }>(
      `SELECT (SELECT COUNT(*)::int FROM component_life_limit_proposals) AS proposals,
              (SELECT COUNT(*)::int FROM component_life_limit_governance_history) AS history`,
      { type: QueryTypes.SELECT }
    );
    await expect(ownershipRepair.up(sequelize.getQueryInterface())).rejects.toThrow(
      'COMPONENT_LIFE_LIMIT_GOVERNANCE_MIGRATION_AUTHORITY_REQUIRED'
    );
    const [after] = await sequelize.query<{ proposals: number; history: number }>(
      `SELECT (SELECT COUNT(*)::int FROM component_life_limit_proposals) AS proposals,
              (SELECT COUNT(*)::int FROM component_life_limit_governance_history) AS history`,
      { type: QueryTypes.SELECT }
    );
    expect(after).toEqual(before);
  });
});
