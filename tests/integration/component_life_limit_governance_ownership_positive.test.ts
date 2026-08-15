import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { QueryTypes, Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';
import ownershipRepair from '../../migrations/582_repair_component_life_limit_governance_ownership.js';
import { assertTestDatabaseSafety } from '../../src/config/testDatabaseSafety.js';

dotenv.config({ path: resolve(process.cwd(), '.env.test.local'), override: false, quiet: true });

const MIGRATION_582 = '582_repair_component_life_limit_governance_ownership.ts';
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

function requiredEnvironment(): { host: string; port: number; adminPassword: string } {
  const required = (key: string): string => {
    const value = process.env[key];
    if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`GUARDED_OWNERSHIP_TEST: ${key} is required`);
    return value.trim();
  };
  if (process.env.NODE_ENV !== 'test') throw new Error('GUARDED_OWNERSHIP_TEST: NODE_ENV must be exactly test');
  if (process.env.DB_NAME !== 'jupiter_test') throw new Error('GUARDED_OWNERSHIP_TEST: DB_NAME must be exactly jupiter_test');
  if (process.env.DB_USER !== 'jupiter_test') throw new Error('GUARDED_OWNERSHIP_TEST: DB_USER must be exactly jupiter_test');
  if (process.env.ALLOW_TEST_DATABASE_RESET !== 'YES') throw new Error('GUARDED_OWNERSHIP_TEST: ALLOW_TEST_DATABASE_RESET must be exactly YES');
  if (process.env.ALLOW_GOVERNANCE_OWNERSHIP_TEST !== 'YES') throw new Error('GUARDED_OWNERSHIP_TEST: ALLOW_GOVERNANCE_OWNERSHIP_TEST must be exactly YES');
  if (process.env.RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST !== 'YES') throw new Error('GUARDED_OWNERSHIP_TEST: RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST must be exactly YES');
  if (process.env.DB_ADMIN_USER !== 'postgres') throw new Error('GUARDED_OWNERSHIP_TEST: DB_ADMIN_USER must be exactly postgres');
  const host = required('DB_HOST');
  const portValue = required('DB_PORT');
  if (!/^\d+$/.test(portValue)) throw new Error('GUARDED_OWNERSHIP_TEST: DB_PORT must be an explicit valid port');
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('GUARDED_OWNERSHIP_TEST: DB_PORT must be an explicit valid port');
  return { host, port, adminPassword: required('DB_ADMIN_PASSWORD') };
}

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

async function mark582ForSeparateAdministration(runtime: Pool): Promise<void> {
  await runtime.query(`CREATE TABLE IF NOT EXISTS public."SequelizeMeta" (name varchar(255) NOT NULL UNIQUE PRIMARY KEY)`);
  await runtime.query(`INSERT INTO public."SequelizeMeta" (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [MIGRATION_582]);
}

async function runOrdinaryPreparation(runtime: Pool): Promise<void> {
  await mark582ForSeparateAdministration(runtime);
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

async function verifyGovernanceBoundary(admin: Sequelize): Promise<void> {
  const [schemaAcl] = await admin.query<{ owner_usage: boolean; owner_create: boolean }>(
    `SELECT has_schema_privilege('jupiter_governance_owner','public','USAGE') AS owner_usage,
      has_schema_privilege('jupiter_governance_owner','public','CREATE') AS owner_create`,
    { type: QueryTypes.SELECT }
  );
  expect(schemaAcl).toEqual({ owner_usage: true, owner_create: false });
  const [gate] = await admin.query<Record<string, unknown>>(
    `SELECT r.rolname AS owner,
      EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
       WHERE a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')) AS public_access,
      has_table_privilege('jupiter_app',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS app_access,
      has_table_privilege('jupiter_test',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS test_access
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_roles r ON r.oid=c.relowner WHERE n.nspname='public'
      AND c.relname='component_life_limit_governance_transition_gate'`, { type: QueryTypes.SELECT });
  expect(gate).toEqual({ owner: 'jupiter_governance_owner', public_access: false, app_access: false, test_access: false });
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
  const ledger = await runtime.query<{ count: number }>(`SELECT count(*)::int AS count FROM public."SequelizeMeta" WHERE name=$1`, [MIGRATION_582]);
  expect(ledger.rows[0].count).toBe(1);
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

async function applyOwnershipBoundary(admin: Sequelize): Promise<void> {
  await verifyOwnerRole(admin);
  await ownershipRepair.up(admin.getQueryInterface());
  await grantTestEntryExecution(admin);
  await verifyGovernanceBoundary(admin);
}

async function returnGovernanceOwnershipForReset(admin: Sequelize): Promise<void> {
  await admin.transaction(async transaction => {
    await admin.query('ALTER TABLE public.component_life_limit_governance_transition_gate OWNER TO jupiter_test', { transaction });
    for (const signature of GOVERNANCE_FUNCTIONS) await admin.query(`ALTER FUNCTION ${signature} OWNER TO jupiter_test`, { transaction });
  });
}

async function restoreGuardedTestDatabase(admin: Sequelize, runtime: Pool): Promise<void> {
  await returnGovernanceOwnershipForReset(admin);
  await run('npm.cmd', ['run', 'db:test:reset']);
  await runOrdinaryPreparation(runtime);
  await verifyOrdinaryOwnership(admin);
  await applyOwnershipBoundary(admin);
  await verifyLedgerSeedsAndNoFixtures(runtime);
}

describe('guarded positive governance ownership production-parity test', () => {
  positiveTest('prepares, verifies and unconditionally restores guarded jupiter_test ownership', async () => {
    const config = requiredEnvironment();
    const runtime = new Pool({ host: config.host, port: config.port, database: 'jupiter_test', user: 'jupiter_test', password: process.env.DB_PASSWORD });
    const admin = new Sequelize({ dialect: 'postgres', host: config.host, port: config.port, database: 'jupiter_test', username: 'postgres', password: config.adminPassword, logging: false });
    let primaryFailure: unknown;
    let restorationFailure: unknown;
    try {
      await verifyLiveIdentities(runtime, admin, config.port);
      await runOrdinaryPreparation(runtime);
      await verifyOrdinaryOwnership(admin);
      await applyOwnershipBoundary(admin);
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
