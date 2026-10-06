import type { MigrationTarget } from './migrationSafety.js';

/**
 * Migration-runner compatibility for the immutable governance migrations that
 * reference the guarded test-only role `jupiter_test` (migrations 583, 584,
 * 595, 596 and 620). On a genuinely fresh production-style `jupiter_db` that
 * role does not exist, so the historical migrations would fail. This module
 * creates a tightly-locked, clearly-marked TEMPORARY `NOLOGIN` role before the
 * chain, lets the immutable migrations run unchanged, and then removes the
 * temporary role with fail-closed verification.
 *
 * Provenance is a `COMMENT ON ROLE` marker (not a naming/attribute guess): a
 * role carrying this exact comment was created by this mechanism. A pre-existing
 * `jupiter_test` without the marker is never touched — the runner fails closed.
 */

const ROLE = 'jupiter_test';
const MARKER = 'jupiter_migration_compatibility_temporary_role';

const HISTORY_TABLE = 'aircraft_component_movement_history';
const RESOLVER_FUNCTION = 'public.resolve_authenticated_memberships(uuid)';

export interface MigrationCompatibilityQueryable {
  query(sql: string): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface MigrationCompatibilityState {
  readonly created: boolean;
}

interface RoleState {
  readonly comment: string | null;
  readonly canLogin: boolean;
  readonly isSuperuser: boolean;
  readonly canCreateDb: boolean;
  readonly canCreateRole: boolean;
  readonly canReplicate: boolean;
  readonly bypassRls: boolean;
  readonly inherit: boolean;
}

const READ_ROLE_STATE_SQL = `SELECT
  sh.description AS comment,
  r.rolcanlogin AS can_login,
  r.rolsuper AS is_superuser,
  r.rolcreatedb AS can_create_db,
  r.rolcreaterole AS can_create_role,
  r.rolreplication AS can_replicate,
  r.rolbypassrls AS bypass_rls,
  r.rolinherit AS inherit
FROM pg_catalog.pg_roles r
LEFT JOIN pg_catalog.pg_shdescription sh
  ON sh.objoid = r.oid AND sh.classoid = 'pg_catalog.pg_authid'::regclass
WHERE r.rolname = '${ROLE}'`;

const CREATE_TEMPORARY_ROLE_SQL = `CREATE ROLE ${ROLE}
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
COMMENT ON ROLE ${ROLE} IS '${MARKER}'`;

const REVOKE_KNOWN_PRIVILEGES_SQL = `DO $$
BEGIN
  IF to_regclass('public.${HISTORY_TABLE}') IS NOT NULL THEN
    REVOKE SELECT, INSERT ON TABLE public.${HISTORY_TABLE} FROM ${ROLE};
  END IF;
  IF to_regprocedure('${RESOLVER_FUNCTION}') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION ${RESOLVER_FUNCTION} FROM ${ROLE};
  END IF;
END $$`;

const VERIFY_NO_RESIDUE_SQL = `SELECT
  EXISTS (SELECT 1 FROM pg_catalog.pg_database WHERE datdba = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${ROLE}')) AS owns_database,
  EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${ROLE}')) AS owns_schema,
  EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE relowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${ROLE}')) AS owns_relation,
  EXISTS (SELECT 1 FROM pg_catalog.pg_proc WHERE proowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${ROLE}')) AS owns_function,
  EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE roleid = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${ROLE}')
          OR member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = '${ROLE}')) AS has_membership,
  has_table_privilege('${ROLE}', 'public.${HISTORY_TABLE}', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS history_privilege,
  has_function_privilege('${ROLE}', '${RESOLVER_FUNCTION}', 'EXECUTE') AS resolver_execute`;

const DROP_TEMPORARY_ROLE_SQL = `DROP ROLE ${ROLE}`;

const VERIFY_DROPPED_SQL = `SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${ROLE}') AS still_exists`;

function isNonTestTarget(target: MigrationTarget): boolean {
  return target !== 'test';
}

async function readRoleState(
  client: MigrationCompatibilityQueryable,
): Promise<RoleState | undefined> {
  const result = await client.query(READ_ROLE_STATE_SQL);
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    comment: typeof row.comment === 'string' ? row.comment : null,
    canLogin: Boolean(row.can_login),
    isSuperuser: Boolean(row.is_superuser),
    canCreateDb: Boolean(row.can_create_db),
    canCreateRole: Boolean(row.can_create_role),
    canReplicate: Boolean(row.can_replicate),
    bypassRls: Boolean(row.bypass_rls),
    inherit: Boolean(row.inherit),
  };
}

function assertLockedAttributes(state: RoleState): void {
  if (
    state.canLogin ||
    state.isSuperuser ||
    state.canCreateDb ||
    state.canCreateRole ||
    state.canReplicate ||
    state.bypassRls ||
    state.inherit
  ) {
    throw new Error('MIGRATION_COMPATIBILITY: temporary role attributes are not locked');
  }
}

export async function prepareMigrationCompatibility(
  client: MigrationCompatibilityQueryable,
  target: MigrationTarget,
): Promise<MigrationCompatibilityState> {
  if (!isNonTestTarget(target)) return Object.freeze({ created: false });

  const existing = await readRoleState(client);
  if (!existing) {
    await client.query(CREATE_TEMPORARY_ROLE_SQL);
    return Object.freeze({ created: true });
  }

  if (existing.comment !== MARKER) {
    throw new Error(
      'MIGRATION_COMPATIBILITY: unexpected pre-existing jupiter_test role without temporary marker',
    );
  }

  assertLockedAttributes(existing);
  return Object.freeze({ created: false });
}

export async function finalizeMigrationCompatibility(
  client: MigrationCompatibilityQueryable,
  target: MigrationTarget,
): Promise<void> {
  if (!isNonTestTarget(target)) return;

  const existing = await readRoleState(client);
  if (!existing) return;
  if (existing.comment !== MARKER) {
    throw new Error(
      'MIGRATION_COMPATIBILITY: refusing to drop jupiter_test without temporary marker',
    );
  }

  assertLockedAttributes(existing);
  await client.query(REVOKE_KNOWN_PRIVILEGES_SQL);

  const residue = await client.query(VERIFY_NO_RESIDUE_SQL);
  const row = residue.rows[0];
  if (
    !row ||
    row.owns_database ||
    row.owns_schema ||
    row.owns_relation ||
    row.owns_function ||
    row.has_membership ||
    row.history_privilege ||
    row.resolver_execute
  ) {
    throw new Error('MIGRATION_COMPATIBILITY: temporary role residue detected; refusing to drop');
  }

  await client.query(DROP_TEMPORARY_ROLE_SQL);

  const dropped = await client.query(VERIFY_DROPPED_SQL);
  if (dropped.rows[0]?.still_exists) {
    throw new Error('MIGRATION_COMPATIBILITY: temporary role still exists after drop');
  }
}

