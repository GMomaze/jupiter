export const MIGRATION_ROLE = 'postgres';
export const RUNTIME_ROLES = ['jupiter_app', 'jupiter_test'] as const;
export const GOVERNANCE_OWNER_ROLE = 'jupiter_governance_owner';
export const GOVERNANCE_TRANSITION_GATE =
  'component_life_limit_governance_transition_gate';

const runtimeRoleList = RUNTIME_ROLES.join(', ');

/**
 * Idempotent administrative SQL for use only after the guarded migration
 * identity and target checks have succeeded. It establishes defaults for new
 * objects and grants the runtime contract on already-created ordinary objects.
 * Function EXECUTE remains migration-owned and explicit.
 */
export function buildDatabasePrivilegeBaselineSql(): string {
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
      AND c.relname <> '${GOVERNANCE_TRANSITION_GATE}'
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
  app_schema_usage: boolean;
  app_schema_create: boolean;
  test_schema_usage: boolean;
  test_schema_create: boolean;
  governance_owner_schema_usage: boolean;
  governance_owner_schema_create: boolean;
  app_can_set_governance_owner: boolean;
  test_can_set_governance_owner: boolean;
  app_is_governance_owner_member: boolean;
  test_is_governance_owner_member: boolean;
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

export const DATABASE_PRIVILEGE_VERIFICATION_SQL = `SELECT
  has_schema_privilege('public', 'public', 'CREATE') AS public_schema_create,
  has_schema_privilege('jupiter_app', 'public', 'USAGE') AS app_schema_usage,
  has_schema_privilege('jupiter_app', 'public', 'CREATE') AS app_schema_create,
  has_schema_privilege('jupiter_test', 'public', 'USAGE') AS test_schema_usage,
  has_schema_privilege('jupiter_test', 'public', 'CREATE') AS test_schema_create,
  has_schema_privilege('jupiter_governance_owner', 'public', 'USAGE') AS governance_owner_schema_usage,
  has_schema_privilege('jupiter_governance_owner', 'public', 'CREATE') AS governance_owner_schema_create,
  pg_has_role('jupiter_app', 'jupiter_governance_owner', 'SET') AS app_can_set_governance_owner,
  pg_has_role('jupiter_test', 'jupiter_governance_owner', 'SET') AS test_can_set_governance_owner,
  pg_has_role('jupiter_app', 'jupiter_governance_owner', 'MEMBER') AS app_is_governance_owner_member,
  pg_has_role('jupiter_test', 'jupiter_governance_owner', 'MEMBER') AS test_is_governance_owner_member,
  COALESCE((SELECT rolcanlogin FROM pg_roles WHERE rolname = 'jupiter_governance_owner'), true) AS owner_rolcanlogin,
  COALESCE((SELECT rolsuper FROM pg_roles WHERE rolname = 'jupiter_governance_owner'), true) AS owner_rolsuper,
  COALESCE((SELECT rolcreatedb FROM pg_roles WHERE rolname = 'jupiter_governance_owner'), true) AS owner_rolcreatedb,
  COALESCE((SELECT rolcreaterole FROM pg_roles WHERE rolname = 'jupiter_governance_owner'), true) AS owner_rolcreaterole,
  COALESCE((SELECT rolinherit FROM pg_roles WHERE rolname = 'jupiter_governance_owner'), true) AS owner_rolinherit,
  COALESCE((SELECT rolreplication FROM pg_roles WHERE rolname = 'jupiter_governance_owner'), true) AS owner_rolreplication,
  COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'jupiter_governance_owner'), true) AS owner_rolbypassrls,
  has_schema_privilege('postgres', 'public', 'CREATE') AS migration_schema_create,
  (SELECT count(*)::int FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = '${GOVERNANCE_TRANSITION_GATE}'
      AND grantee IN ('PUBLIC', 'jupiter_app', 'jupiter_test')) AS runtime_gate_privilege_count,
  (SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY['jupiter_app', 'jupiter_test']) AS runtime(role_name)
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname <> '${GOVERNANCE_TRANSITION_GATE}'
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
    CROSS JOIN unnest(ARRAY['jupiter_app', 'jupiter_test']) AS runtime(role_name)
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND (
        has_table_privilege(runtime.role_name, c.oid, 'TRUNCATE')
        OR has_table_privilege(runtime.role_name, c.oid, 'REFERENCES')
        OR has_table_privilege(runtime.role_name, c.oid, 'TRIGGER')
      ))
    AS runtime_unsafe_table_privilege_count,
  (SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY['jupiter_app', 'jupiter_test']) AS runtime(role_name)
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
    CROSS JOIN unnest(ARRAY['jupiter_app', 'jupiter_test']) AS runtime(role_name)
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND has_sequence_privilege(runtime.role_name, c.oid, 'UPDATE'))
    AS runtime_unsafe_sequence_privilege_count,
  (SELECT count(*)::int
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY['jupiter_app', 'jupiter_test']) AS runtime(role_name)
    WHERE n.nspname = 'public'
      AND c.relkind IN ('v', 'm')
      AND NOT has_table_privilege(runtime.role_name, c.oid, 'SELECT'))
    AS runtime_missing_view_select_count,
  (SELECT count(*)::int FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r ON r.oid = c.relowner
    WHERE n.nspname = 'public'
      AND c.relname = '${GOVERNANCE_TRANSITION_GATE}'
      AND r.rolname IN ('jupiter_app', 'jupiter_test')) AS runtime_owned_protected_object_count,
  (SELECT count(*)::int
    FROM unnest(ARRAY[
      'public.fn_cllg_validate_proposal_revision()',
      'public.fn_cllg_protect_proposal()',
      'public.fn_cllg_protect_publication()',
      'public.fn_cllg_prevent_history_mutation()',
      'public.fn_cllg_protect_operational_limit()'
    ]) AS protected(signature)
    WHERE has_function_privilege('jupiter_app', protected.signature, 'EXECUTE')
       OR has_function_privilege('jupiter_test', protected.signature, 'EXECUTE'))
    AS protected_function_exposure_count`;

export function assertDatabasePrivilegeVerification(
  result: DatabasePrivilegeVerification
): void {
  const passes =
    !result.public_schema_create &&
    result.app_schema_usage &&
    !result.app_schema_create &&
    result.test_schema_usage &&
    !result.test_schema_create &&
    result.governance_owner_schema_usage &&
    !result.governance_owner_schema_create &&
    !result.app_can_set_governance_owner &&
    !result.test_can_set_governance_owner &&
    !result.app_is_governance_owner_member &&
    !result.test_is_governance_owner_member &&
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
    result.runtime_missing_sequence_privilege_count === 0 &&
    result.runtime_unsafe_sequence_privilege_count === 0 &&
    result.runtime_missing_view_select_count === 0 &&
    result.runtime_owned_protected_object_count === 0 &&
    result.protected_function_exposure_count === 0;
  if (!passes) {
    throw new Error('DATABASE_PRIVILEGE_BASELINE: verification failed');
  }
}

export async function applyAndVerifyDatabasePrivilegeBaseline(
  admin: DatabasePrivilegeQueryable
): Promise<void> {
  await admin.query('BEGIN');
  try {
    await admin.query(buildDatabasePrivilegeBaselineSql());
    const verification = await admin.query<DatabasePrivilegeVerification>(
      DATABASE_PRIVILEGE_VERIFICATION_SQL
    );
    const result = verification.rows[0];
    if (!result) {
      throw new Error(
        'DATABASE_PRIVILEGE_BASELINE: verification returned no row'
      );
    }
    assertDatabasePrivilegeVerification(result);
    await admin.query('COMMIT');
  } catch (error) {
    await admin.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
