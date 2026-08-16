import { spawn } from 'node:child_process';
import { Pool } from 'pg';
import { QueryTypes, Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';
import ownershipRepair from '../../migrations/582_repair_component_life_limit_governance_ownership.js';
import gateAclRepair from '../../migrations/583_repair_component_life_limit_governance_gate_acl.js';
import activationGateWriteRepair from '../../migrations/584_repair_component_life_limit_governance_activation_gate_write.js';
import { assertTestDatabaseSafety } from '../../src/config/testDatabaseSafety.js';
import {
  applyGuardedTestEnvironment,
  validateGuardedOwnershipEnvironment,
} from '../support/governanceOwnershipPositiveEnvironment.js';

applyGuardedTestEnvironment(process.env);

const MIGRATION_582 = '582_repair_component_life_limit_governance_ownership.ts';
const MIGRATION_583 = '583_repair_component_life_limit_governance_gate_acl.ts';
const MIGRATION_584 = '584_repair_component_life_limit_governance_activation_gate_write.ts';
const ADMIN_MIGRATIONS = [MIGRATION_582, MIGRATION_583, MIGRATION_584] as const;
const ENTRY_FUNCTIONS = [
  'public.fn_cllg_decide_proposal(uuid,uuid,character varying,text,boolean)',
  'public.fn_cllg_activate_publication(uuid,uuid,text)',
] as const;
const TRIGGER_FUNCTIONS = [
  'public.fn_cllg_validate_proposal_revision()',
  'public.fn_cllg_protect_proposal()',
  'public.fn_cllg_protect_publication()',
  'public.fn_cllg_prevent_history_mutation()',
  'public.fn_cllg_protect_operational_limit()',
] as const;
const GOVERNANCE_FUNCTIONS = [...ENTRY_FUNCTIONS, ...TRIGGER_FUNCTIONS] as const;
type LiveIdentity = { database_name: string; user_name: string; server_address: string; server_port: number };

const positiveTest = process.env.ALLOW_GOVERNANCE_OWNERSHIP_TEST === 'YES'
  && process.env.RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST === 'YES' ? it : it.skip;

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'test' }, shell: process.platform === 'win32', stdio: 'inherit' });
    child.once('error', rejectPromise);
    child.once('exit', code => code === 0 ? resolvePromise() : rejectPromise(new Error(`GUARDED_OWNERSHIP_TEST: command failed (${String(code)})`)));
  });
}

async function identity(queryable: Pool | Sequelize): Promise<LiveIdentity> {
  const sql = `SELECT current_database() AS database_name,current_user AS user_name,
    host(inet_server_addr()) AS server_address,inet_server_port() AS server_port`;
  if (queryable instanceof Sequelize) {
    const [row] = await queryable.query<LiveIdentity>(sql, { type: QueryTypes.SELECT });
    return row;
  }
  return (await queryable.query<LiveIdentity>(sql)).rows[0];
}

async function verifyLiveIdentities(runtime: Pool, admin: Sequelize, configuredPort: number): Promise<void> {
  await assertTestDatabaseSafety(runtime);
  const runtimeIdentity = await identity(runtime);
  const adminIdentity = await identity(admin);
  expect(runtimeIdentity).toMatchObject({ database_name: 'jupiter_test', user_name: 'jupiter_test', server_port: configuredPort });
  expect(adminIdentity).toMatchObject({ database_name: 'jupiter_test', user_name: 'postgres', server_port: configuredPort });
  expect(adminIdentity.server_address).toBe(runtimeIdentity.server_address);
}

async function markAdministratorMigrationsForSeparateExecution(runtime: Pool): Promise<void> {
  await runtime.query(`CREATE TABLE IF NOT EXISTS public."SequelizeMeta" (name varchar(255) NOT NULL UNIQUE PRIMARY KEY)`);
  for (const migration of ADMIN_MIGRATIONS) {
    await runtime.query(`INSERT INTO public."SequelizeMeta" (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [migration]);
  }
}

async function runOrdinaryPreparation(runtime: Pool): Promise<void> {
  await markAdministratorMigrationsForSeparateExecution(runtime);
  await run('npm.cmd', ['run', 'db:test:migrate']);
  await run('npm.cmd', ['run', 'db:test:seed']);
}

async function verifyOrdinaryOwnership(admin: Sequelize): Promise<void> {
  const [state] = await admin.query<{ schema_owner: string; incorrectly_owned_objects: number }>(
    `SELECT (SELECT r.rolname FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles r ON r.oid=n.nspowner WHERE n.nspname='public') AS schema_owner,
      (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
       JOIN pg_catalog.pg_roles r ON r.oid=c.relowner WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m')
       AND c.relname <> 'component_life_limit_governance_transition_gate' AND r.rolname <> 'jupiter_test') AS incorrectly_owned_objects`,
    { type: QueryTypes.SELECT }
  );
  expect(state).toEqual({ schema_owner: 'jupiter_test', incorrectly_owned_objects: 0 });
}

async function verifyOwnerRole(admin: Sequelize): Promise<void> {
  const [owner] = await admin.query<Record<string, boolean>>(
    `SELECT NOT rolcanlogin AS nologin,NOT rolsuper AS nosuperuser,NOT rolcreatedb AS nocreatedb,
      NOT rolcreaterole AS nocreaterole,NOT rolinherit AS noinherit,NOT rolreplication AS noreplication,
      NOT rolbypassrls AS nobypassrls,NOT pg_catalog.pg_has_role('jupiter_app',oid,'SET') AS app_cannot_set,
      NOT pg_catalog.pg_has_role('jupiter_test',oid,'SET') AS test_cannot_set
      FROM pg_catalog.pg_roles WHERE rolname='jupiter_governance_owner'`, { type: QueryTypes.SELECT });
  expect(owner).toEqual({ nologin: true, nosuperuser: true, nocreatedb: true, nocreaterole: true,
    noinherit: true, noreplication: true, nobypassrls: true, app_cannot_set: true, test_cannot_set: true });
}

async function grantTestEntryExecution(admin: Sequelize): Promise<void> {
  for (const signature of ENTRY_FUNCTIONS) await admin.query(`GRANT EXECUTE ON FUNCTION ${signature} TO jupiter_test`);
}

async function reproduceProductionEmptyGateAcl(runtime: Pool): Promise<void> {
  await runtime.query(`REVOKE ALL ON TABLE public.component_life_limit_governance_transition_gate FROM jupiter_test`);
}

async function verifyMigration582LeavesProductionAclBroken(admin: Sequelize): Promise<void> {
  const [gate] = await admin.query<Record<string, unknown>>(
    `SELECT r.rolname AS owner,c.relacl,
      has_table_privilege('jupiter_governance_owner',c.oid,'SELECT') AS owner_select,
      has_table_privilege('jupiter_governance_owner',c.oid,'INSERT') AS owner_insert,
      has_table_privilege('jupiter_governance_owner',c.oid,'DELETE') AS owner_delete
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_roles r ON r.oid=c.relowner WHERE n.nspname='public'
      AND c.relname='component_life_limit_governance_transition_gate'`,
    { type: QueryTypes.SELECT }
  );
  expect(gate).toMatchObject({ owner: 'jupiter_governance_owner', relacl: '{}',
    owner_select: false, owner_insert: false, owner_delete: false });
}

async function verifyGovernanceBoundary(admin: Sequelize): Promise<void> {
  const [schemaAcl] = await admin.query<{ owner_usage: boolean; owner_create: boolean }>(
    `SELECT has_schema_privilege('jupiter_governance_owner','public','USAGE') AS owner_usage,
      has_schema_privilege('jupiter_governance_owner','public','CREATE') AS owner_create`,
    { type: QueryTypes.SELECT }
  );
  expect(schemaAcl).toEqual({ owner_usage: true, owner_create: false });
  const [gate] = await admin.query<Record<string, unknown>>(
    `SELECT r.rolname AS owner,
      has_table_privilege('jupiter_governance_owner',c.oid,'SELECT') AS owner_select,
      has_table_privilege('jupiter_governance_owner',c.oid,'INSERT') AS owner_insert,
      has_table_privilege('jupiter_governance_owner',c.oid,'DELETE') AS owner_delete,
      has_table_privilege('jupiter_governance_owner',c.oid,'UPDATE') AS owner_update,
      has_table_privilege('jupiter_governance_owner',c.oid,'TRUNCATE') AS owner_truncate,
      has_table_privilege('jupiter_governance_owner',c.oid,'REFERENCES') AS owner_references,
      has_table_privilege('jupiter_governance_owner',c.oid,'TRIGGER') AS owner_trigger,
      EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
       WHERE a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')) AS public_access,
      (has_table_privilege('jupiter_app',c.oid,'SELECT') OR has_table_privilege('jupiter_app',c.oid,'INSERT')
       OR has_table_privilege('jupiter_app',c.oid,'UPDATE') OR has_table_privilege('jupiter_app',c.oid,'DELETE')
       OR has_table_privilege('jupiter_app',c.oid,'TRUNCATE') OR has_table_privilege('jupiter_app',c.oid,'REFERENCES')
       OR has_table_privilege('jupiter_app',c.oid,'TRIGGER')) AS app_access,
      (has_table_privilege('jupiter_test',c.oid,'SELECT') OR has_table_privilege('jupiter_test',c.oid,'INSERT')
       OR has_table_privilege('jupiter_test',c.oid,'UPDATE') OR has_table_privilege('jupiter_test',c.oid,'DELETE')
       OR has_table_privilege('jupiter_test',c.oid,'TRUNCATE') OR has_table_privilege('jupiter_test',c.oid,'REFERENCES')
       OR has_table_privilege('jupiter_test',c.oid,'TRIGGER')) AS test_access
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_roles r ON r.oid=c.relowner WHERE n.nspname='public'
      AND c.relname='component_life_limit_governance_transition_gate'`, { type: QueryTypes.SELECT });
  expect(gate).toEqual({ owner: 'jupiter_governance_owner', owner_select: true, owner_insert: true,
    owner_delete: true, owner_update: false, owner_truncate: false, owner_references: false,
    owner_trigger: false, public_access: false, app_access: false, test_access: false });
  for (const signature of GOVERNANCE_FUNCTIONS) {
    const isEntry = (ENTRY_FUNCTIONS as readonly string[]).includes(signature);
    const [fn] = await admin.query<Record<string, unknown>>(
      `SELECT r.rolname AS owner,p.prosecdef,p.proconfig,
        EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
         WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute,
        has_function_privilege('jupiter_app',p.oid,'EXECUTE') AS app_execute,
        has_function_privilege('jupiter_test',p.oid,'EXECUTE') AS test_execute
        FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid=p.proowner WHERE p.oid=$1::regprocedure`,
      { bind: [signature], type: QueryTypes.SELECT });
    expect(fn).toMatchObject({ owner: 'jupiter_governance_owner', prosecdef: true,
      public_execute: false, app_execute: isEntry, test_execute: isEntry });
    expect(fn.proconfig).toContain('search_path=pg_catalog, public');
  }
}

async function verifyLedgerSeedsAndNoFixtures(runtime: Pool): Promise<void> {
  const ledger = await runtime.query<{ name: string; count: number }>(
    `SELECT expected.name,count(meta.name)::int AS count
       FROM unnest($1::text[]) expected(name)
       LEFT JOIN public."SequelizeMeta" meta ON meta.name=expected.name
      GROUP BY expected.name ORDER BY expected.name`, [[...ADMIN_MIGRATIONS]]);
  expect(ledger.rows).toEqual(ADMIN_MIGRATIONS.map(name => ({ name, count: 1 })));
  const seed = await runtime.query<{ roles: number; permissions: number }>(
    `SELECT (SELECT count(*)::int FROM public.rf_role) AS roles,(SELECT count(*)::int FROM public.rf_permission) AS permissions`);
  expect(seed.rows[0].roles).toBeGreaterThan(0);
  expect(seed.rows[0].permissions).toBeGreaterThan(0);
  const fixtures = await runtime.query<{ count: number }>(
    `SELECT (SELECT count(*) FROM public.component_life_limit_proposals)
      +(SELECT count(*) FROM public.component_life_limit_publications)
      +(SELECT count(*) FROM public.component_life_limit_governance_history) AS count`);
  expect(Number(fixtures.rows[0].count)).toBe(0);
}

async function applyOwnershipBoundary(admin: Sequelize, runtime: Pool): Promise<void> {
  await verifyOwnerRole(admin);
  await reproduceProductionEmptyGateAcl(runtime);
  await ownershipRepair.up(admin.getQueryInterface());
  await verifyMigration582LeavesProductionAclBroken(admin);
  await gateAclRepair.up(admin.getQueryInterface());
  await activationGateWriteRepair.up(admin.getQueryInterface());
  await grantTestEntryExecution(admin);
  await verifyGovernanceBoundary(admin);
}

async function returnGovernanceOwnershipForReset(admin: Sequelize): Promise<void> {
  await admin.transaction(async transaction => {
    await admin.query('ALTER TABLE public.component_life_limit_governance_transition_gate OWNER TO jupiter_test', { transaction });
    for (const signature of GOVERNANCE_FUNCTIONS) await admin.query(`ALTER FUNCTION ${signature} OWNER TO jupiter_test`, { transaction });
  });
}

async function prepareFreshGuardedTestDatabase(admin: Sequelize, runtime: Pool): Promise<void> {
  await returnGovernanceOwnershipForReset(admin);
  await run('npm.cmd', ['run', 'db:test:reset']);
  await runOrdinaryPreparation(runtime);
  await verifyOrdinaryOwnership(admin);
}

async function restoreGuardedTestDatabase(admin: Sequelize, runtime: Pool): Promise<void> {
  await returnGovernanceOwnershipForReset(admin);
  await run('npm.cmd', ['run', 'db:test:reset']);
  await runOrdinaryPreparation(runtime);
  await verifyOrdinaryOwnership(admin);
  await applyOwnershipBoundary(admin, runtime);
  await verifyLedgerSeedsAndNoFixtures(runtime);
}

describe('guarded positive governance ownership production-parity test', () => {
  positiveTest('prepares, verifies and unconditionally restores guarded jupiter_test ownership', async () => {
    const config = validateGuardedOwnershipEnvironment(process.env);
    const runtime = new Pool({ host: config.host, port: config.port, database: 'jupiter_test', user: 'jupiter_test', password: config.runtimePassword });
    const admin = new Sequelize({ dialect: 'postgres', host: config.host, port: config.port, database: 'jupiter_test', username: 'postgres', password: config.adminPassword, logging: false });
    let primaryFailure: unknown;
    let restorationFailure: unknown;
    try {
      await verifyLiveIdentities(runtime, admin, config.port);
      await prepareFreshGuardedTestDatabase(admin, runtime);
      await applyOwnershipBoundary(admin, runtime);
      await expect(runtime.query('INSERT INTO public.component_life_limit_governance_transition_gate DEFAULT VALUES')).rejects.toThrow();
      await run('npx.cmd', ['vitest', 'run',
        'tests/integration/component_life_limit_governance_phase_1b_http.test.ts',
        'tests/integration/component_life_limit_governance_phase_2_activation.test.ts']);
    } catch (error) {
      primaryFailure = error;
    } finally {
      try {
        await restoreGuardedTestDatabase(admin, runtime);
      } catch (error) {
        restorationFailure = error;
      } finally {
        await admin.close().catch(() => undefined);
        await runtime.end().catch(() => undefined);
      }
    }
    if (primaryFailure && restorationFailure) throw new AggregateError([primaryFailure, restorationFailure], 'GUARDED_OWNERSHIP_TEST: workflow and restoration both failed');
    if (primaryFailure) throw primaryFailure;
    if (restorationFailure) throw restorationFailure;
  }, 300_000);
});
