export const MIGRATION_ROLE = 'postgres';
export const RUNTIME_ROLES = ['jupiter_app', 'jupiter_test'] as const;
export const GOVERNANCE_OWNER_ROLE = 'jupiter_governance_owner';
export const GOVERNANCE_TRANSITION_GATE =
  'component_life_limit_governance_transition_gate';

const ALL_TABLE_DML = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
type TableDml = (typeof ALL_TABLE_DML)[number];

/**
 * Tables whose runtime DML contract is deliberately narrowed by migrations
 * 594/595/596/598/601/602/621. The baseline must NOT re-grant full CRUD on
 * these; it leaves their migration-established grants intact and only verifies
 * their final state.
 */
export const RESTRICTED_RUNTIME_TABLE_PRIVILEGES: ReadonlyArray<
  readonly [table: string, allowed: readonly TableDml[]]
> = [
  ['aircraft_component_movement_history', ['SELECT', 'INSERT']],
  ['platform_capabilities', ['SELECT']],
  ['platform_global_audit_log', ['SELECT', 'INSERT']],
  ['platform_principals', ['SELECT', 'INSERT', 'UPDATE']],
  ['platform_capability_grants', ['SELECT', 'INSERT', 'UPDATE']],
  ['tenants', ['SELECT', 'INSERT', 'UPDATE']],
  ['tenant_memberships', ['SELECT', 'INSERT', 'UPDATE']],
  ['tenant_membership_roles', ['INSERT', 'UPDATE']],
  ['tenant_context_switch_attempts', ['INSERT', 'UPDATE']],
  ['staff_invitations', ['SELECT', 'INSERT', 'UPDATE']],
  ['tenant_membership_authority_audit', ['SELECT', 'INSERT']],
  ['platform_user_invitations', ['SELECT', 'INSERT', 'UPDATE']],
];

const RESTRICTED_RUNTIME_TABLE_NAMES = RESTRICTED_RUNTIME_TABLE_PRIVILEGES.map(
  ([table]) => table,
);

const FORBIDDEN_RUNTIME_TABLE_PRIVILEGES = RESTRICTED_RUNTIME_TABLE_PRIVILEGES.flatMap(
  ([table, allowed]) =>
    ALL_TABLE_DML.filter((privilege) => !allowed.includes(privilege)).map(
      (privilege) => [table, privilege] as const,
    ),
);

function quoteList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

function joinRoles(roles: readonly string[]): string {
  return roles.join(', ');
}

/**
 * Idempotent administrative SQL for use only after the guarded migration
 * identity and target checks have succeeded. It establishes defaults for new
 * objects and grants the runtime contract on already-created ordinary objects.
 * Function EXECUTE remains migration-owned and explicit. Restricted tables keep
 * their migration-established narrower contracts.
 */
export function buildDatabasePrivilegeBaselineSql(
  runtimeRoles: readonly string[] = RUNTIME_ROLES,
): string {
  const runtimeRoleList = joinRoles(runtimeRoles);
  const excludedTableList = quoteList([
    GOVERNANCE_TRANSITION_GATE,
    ...RESTRICTED_RUNTIME_TABLE_NAMES,
  ]);
  return `REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ${runtimeRoleList}, ${GOVERNANCE_OWNER_ROLE};
REVOKE CREATE ON SCHEMA public FROM ${runtimeRoleList}, ${GOVERNANCE_OWNER_ROLE};

ALTER DEFAULT PRIVILEGES FOR ROLE ${MIGRATION_ROLE} IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${runtimeRoleList};
ALTER DEFAULT PRIVILEGES FOR ROLE ${MIGRATION_ROLE} IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM ${runtimeRoleList};
ALTER DEFAULT PRIVILEGES FOR ROLE ${MIGRATION_ROLE} IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ${runtimeRoleList};
ALTER DEFAULT PRIVILEGES FOR ROLE ${MIGRATION_ROLE} IN SCHEMA public
  REVOKE UPDATE ON SEQUENCES FROM ${runtimeRoleList};
ALTER DEFAULT PRIVILEGES FOR ROLE ${MIGRATION_ROLE} IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $baseline$
DECLARE ordinary_object record;
BEGIN
  FOR ordinary_object IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname <> ALL(ARRAY[${excludedTableList}]::text[])
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO ${runtimeRoleList}',
      ordinary_object.nspname, ordinary_object.relname
    );
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %I.%I FROM ${runtimeRoleList}',
      ordinary_object.nspname, ordinary_object.relname
    );
  END LOOP;

  FOR ordinary_object IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
  LOOP
    EXECUTE format(
      'GRANT SELECT ON TABLE %I.%I TO ${runtimeRoleList}',
      ordinary_object.nspname, ordinary_object.relname
    );
  END LOOP;

  FOR ordinary_object IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE %I.%I TO ${runtimeRoleList}',
      ordinary_object.nspname, ordinary_object.relname
    );
    EXECUTE format(
      'REVOKE UPDATE ON SEQUENCE %I.%I FROM ${runtimeRoleList}',
      ordinary_object.nspname, ordinary_object.relname
    );
  END LOOP;
END
$baseline$;

REVOKE ALL ON TABLE public.${GOVERNANCE_TRANSITION_GATE}
  FROM PUBLIC, ${runtimeRoleList};`;
}

export interface DatabasePrivilegeVerification extends Record<string, unknown> {
  public_schema_create: boolean;
  governance_owner_schema_usage: boolean;
  governance_owner_schema_create: boolean;
  owner_rolcanlogin: boolean;
  owner_rolsuper: boolean;
  owner_rolcreatedb: boolean;
  owner_rolcreaterole: boolean;
  owner_rolinherit: boolean;
  owner_rolreplication: boolean;
  owner_rolbypassrls: boolean;
  migration_schema_create: boolean;
  runtime_gate_privilege_count: number;
  runtime_missing_table_privilege_count: number;
  runtime_unsafe_table_privilege_count: number;
  runtime_restricted_table_privilege_violation_count: number;
  runtime_missing_sequence_privilege_count: number;
  runtime_unsafe_sequence_privilege_count: number;
  runtime_missing_view_select_count: number;
  runtime_owned_protected_object_count: number;
  protected_function_exposure_count: number;
}

export interface DatabasePrivilegeQueryable {
  query<Row extends Record<string, unknown>>(
    sql: string
  ): Promise<{ rows: Row[] }>;
}

export function buildDatabasePrivilegeVerificationSql(
  runtimeRoles: readonly string[] = RUNTIME_ROLES,
): string {
  const roleArray = quoteList(runtimeRoles);
  const roleSchemaChecks = runtimeRoles
    .map(
      (role) =>
        `  has_schema_privilege('${role}', 'public', 'USAGE') AS ${role}_schema_usage,\n` +
        `  has_schema_privilege('${role}', 'public', 'CREATE') AS ${role}_schema_create,\n` +
        `  pg_has_role('${role}', '${GOVERNANCE_OWNER_ROLE}', 'SET') AS ${role}_can_set_governance_owner,\n` +
        `  pg_has_role('${role}', '${GOVERNANCE_OWNER_ROLE}', 'MEMBER') AS ${role}_is_governance_owner_member,`,
    )
    .join('\n');

  const excludedTableList = quoteList([
    GOVERNANCE_TRANSITION_GATE,
    ...RESTRICTED_RUNTIME_TABLE_NAMES,
  ]);
  const forbiddenValues = FORBIDDEN_RUNTIME_TABLE_PRIVILEGES.map(
    ([table, privilege]) => `('${table}', '${privilege}')`,
  ).join(', ');

  return `SELECT
  has_schema_privilege('public', 'public', 'CREATE') AS public_schema_create,
${roleSchemaChecks}
  has_schema_privilege('${GOVERNANCE_OWNER_ROLE}', 'public', 'USAGE') AS governance_owner_schema_usage,
  has_schema_privilege('${GOVERNANCE_OWNER_ROLE}', 'public', 'CREATE') AS governance_owner_schema_create,
  COALESCE((SELECT rolcanlogin FROM pg_roles WHERE rolname = '${GOVERNANCE_OWNER_ROLE}'), true) AS owner_rolcanlogin,
  COALESCE((SELECT rolsuper FROM pg_roles WHERE rolname = '${GOVERNANCE_OWNER_ROLE}'), true) AS owner_rolsuper,
  COALESCE((SELECT rolcreatedb FROM pg_roles WHERE rolname = '${GOVERNANCE_OWNER_ROLE}'), true) AS owner_rolcreatedb,
  COALESCE((SELECT rolcreaterole FROM pg_roles WHERE rolname = '${GOVERNANCE_OWNER_ROLE}'), true) AS owner_rolcreaterole,
  COALESCE((SELECT rolinherit FROM pg_roles WHERE rolname = '${GOVERNANCE_OWNER_ROLE}'), true) AS owner_rolinherit,
  COALESCE((SELECT rolreplication FROM pg_roles WHERE rolname = '${GOVERNANCE_OWNER_ROLE}'), true) AS owner_rolreplication,
  COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = '${GOVERNANCE_OWNER_ROLE}'), true) AS owner_rolbypassrls,
  has_schema_privilege('${MIGRATION_ROLE}', 'public', 'CREATE') AS migration_schema_create,
  (SELECT count(*)::int FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = '${GOVERNANCE_TRANSITION_GATE}'
      AND grantee IN ('PUBLIC', ${roleArray})) AS runtime_gate_privilege_count,
  (SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY[${roleArray}]) AS runtime(role_name)
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname <> ALL(ARRAY[${excludedTableList}]::text[])
      AND NOT (
        has_table_privilege(runtime.role_name, c.oid, 'SELECT')
        AND has_table_privilege(runtime.role_name, c.oid, 'INSERT')
        AND has_table_privilege(runtime.role_name, c.oid, 'UPDATE')
        AND has_table_privilege(runtime.role_name, c.oid, 'DELETE')
      ))
    AS runtime_missing_table_privilege_count,
  (SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY[${roleArray}]) AS runtime(role_name)
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND (
        has_table_privilege(runtime.role_name, c.oid, 'TRUNCATE')
        OR has_table_privilege(runtime.role_name, c.oid, 'REFERENCES')
        OR has_table_privilege(runtime.role_name, c.oid, 'TRIGGER')
      ))
    AS runtime_unsafe_table_privilege_count,
  (SELECT count(*)::int
    FROM (VALUES ${forbiddenValues}) AS restricted(table_name, privilege_type)
    CROSS JOIN unnest(ARRAY[${roleArray}]) AS runtime(role_name)
    WHERE has_table_privilege(
      runtime.role_name,
      ('public.' || restricted.table_name)::regclass,
      restricted.privilege_type
    ))
    AS runtime_restricted_table_privilege_violation_count,
  (SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY[${roleArray}]) AS runtime(role_name)
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND NOT (
        has_sequence_privilege(runtime.role_name, c.oid, 'USAGE')
        AND has_sequence_privilege(runtime.role_name, c.oid, 'SELECT')
      ))
    AS runtime_missing_sequence_privilege_count,
  (SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY[${roleArray}]) AS runtime(role_name)
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND has_sequence_privilege(runtime.role_name, c.oid, 'UPDATE'))
    AS runtime_unsafe_sequence_privilege_count,
  (SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY[${roleArray}]) AS runtime(role_name)
    WHERE n.nspname = 'public'
      AND c.relkind IN ('v', 'm')
      AND NOT has_table_privilege(runtime.role_name, c.oid, 'SELECT'))
    AS runtime_missing_view_select_count,
  (SELECT count(*)::int FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r ON r.oid = c.relowner
    WHERE n.nspname = 'public'
      AND c.relname = '${GOVERNANCE_TRANSITION_GATE}'
      AND r.rolname IN (${roleArray})) AS runtime_owned_protected_object_count,
  (SELECT count(*)::int
    FROM unnest(ARRAY[
      'public.fn_cllg_validate_proposal_revision()',
      'public.fn_cllg_protect_proposal()',
      'public.fn_cllg_protect_publication()',
      'public.fn_cllg_prevent_history_mutation()',
      'public.fn_cllg_protect_operational_limit()'
    ]) AS protected(signature)
    CROSS JOIN unnest(ARRAY[${roleArray}]) AS runtime(role_name)
    WHERE has_function_privilege(runtime.role_name, protected.signature, 'EXECUTE'))
    AS protected_function_exposure_count`;
}

export function assertDatabasePrivilegeVerification(
  result: DatabasePrivilegeVerification,
  runtimeRoles: readonly string[] = RUNTIME_ROLES,
): void {
  let passes =
    !result.public_schema_create &&
    result.governance_owner_schema_usage &&
    !result.governance_owner_schema_create &&
    !result.owner_rolcanlogin &&
    !result.owner_rolsuper &&
    !result.owner_rolcreatedb &&
    !result.owner_rolcreaterole &&
    !result.owner_rolinherit &&
    !result.owner_rolreplication &&
    !result.owner_rolbypassrls &&
    result.migration_schema_create &&
    result.runtime_gate_privilege_count === 0 &&
    result.runtime_missing_table_privilege_count === 0 &&
    result.runtime_unsafe_table_privilege_count === 0 &&
    result.runtime_restricted_table_privilege_violation_count === 0 &&
    result.runtime_missing_sequence_privilege_count === 0 &&
    result.runtime_unsafe_sequence_privilege_count === 0 &&
    result.runtime_missing_view_select_count === 0 &&
    result.runtime_owned_protected_object_count === 0 &&
    result.protected_function_exposure_count === 0;

  for (const role of runtimeRoles) {
    passes =
      passes &&
      result[`${role}_schema_usage`] === true &&
      result[`${role}_schema_create`] === false &&
      result[`${role}_can_set_governance_owner`] === false &&
      result[`${role}_is_governance_owner_member`] === false;
  }

  if (!passes) {
    throw new Error('DATABASE_PRIVILEGE_BASELINE: verification failed');
  }
}

export async function applyAndVerifyDatabasePrivilegeBaseline(
  admin: DatabasePrivilegeQueryable,
  runtimeRoles: readonly string[] = RUNTIME_ROLES,
): Promise<void> {
  await admin.query('BEGIN');
  try {
    await admin.query(buildDatabasePrivilegeBaselineSql(runtimeRoles));
    const verification = await admin.query<DatabasePrivilegeVerification>(
      buildDatabasePrivilegeVerificationSql(runtimeRoles)
    );
    const result = verification.rows[0];
    if (!result) {
      throw new Error(
        'DATABASE_PRIVILEGE_BASELINE: verification returned no row'
      );
    }
    assertDatabasePrivilegeVerification(result, runtimeRoles);
    await admin.query('COMMIT');
  } catch (error) {
    await admin.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
