'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const GOVERNANCE_OWNER = 'jupiter_governance_owner';
const RUNTIME_ROLE = 'jupiter_app';
const TEST_ROLE = 'jupiter_test';
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

type Preflight = {
  database_approved: boolean;
  migration_authorized: boolean;
  owner_exists: boolean;
  owner_safe: boolean;
  runtime_can_set_owner: boolean;
  test_can_set_owner: boolean;
  gate_exists: boolean;
  gate_owner: string | null;
  migration_582_applied: boolean;
  function_count: number;
  owned_function_count: number;
  safe_function_count: number;
  owner_schema_usage: boolean;
  owner_schema_create: boolean;
};

type Verification = {
  owner_select: boolean;
  owner_insert: boolean;
  owner_delete: boolean;
  owner_update: boolean;
  owner_truncate: boolean;
  owner_references: boolean;
  owner_trigger: boolean;
  public_access: boolean;
  runtime_access: boolean;
  test_access: boolean;
  owner_schema_usage: boolean;
  owner_schema_create: boolean;
  owned_function_count: number;
  safe_function_count: number;
  public_execute: boolean;
  runtime_entries: boolean;
  runtime_triggers: boolean;
};

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const allFunctions = [...ENTRY_FUNCTIONS, ...TRIGGER_FUNCTIONS];
      const [preflight] = await queryInterface.sequelize.query<Preflight>(
        `WITH governed AS (
           SELECT p.oid,p.prosecdef,p.proconfig,r.rolname AS owner
           FROM unnest(ARRAY[:functions]::text[]) requested(signature)
           LEFT JOIN LATERAL pg_catalog.to_regprocedure(requested.signature) resolved(oid) ON true
           LEFT JOIN pg_catalog.pg_proc p ON p.oid=resolved.oid
           LEFT JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
         ) SELECT
           current_database() IN ('jupiter_db','jupiter_test') AS database_approved,
           current_user='postgres' AND COALESCE((SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user),false) AS migration_authorized,
           EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=:owner) AS owner_exists,
           COALESCE((SELECT NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
                            AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls
                     FROM pg_catalog.pg_roles WHERE rolname=:owner),false) AS owner_safe,
           CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=:owner)
             THEN pg_catalog.pg_has_role(:runtime,:owner,'SET') ELSE false END AS runtime_can_set_owner,
           CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=:owner)
             THEN pg_catalog.pg_has_role(:test,:owner,'SET') ELSE false END AS test_can_set_owner,
           to_regclass('public.component_life_limit_governance_transition_gate') IS NOT NULL AS gate_exists,
           (SELECT r.rolname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles r ON r.oid=c.relowner
             WHERE c.oid=to_regclass('public.component_life_limit_governance_transition_gate')) AS gate_owner,
           EXISTS (SELECT 1 FROM public."SequelizeMeta" WHERE name=:migration582) AS migration_582_applied,
           COUNT(oid)::int AS function_count,
           COUNT(oid) FILTER (WHERE owner=:owner)::int AS owned_function_count,
           COUNT(oid) FILTER (WHERE prosecdef AND proconfig @> ARRAY['search_path=pg_catalog, public'])::int AS safe_function_count,
           has_schema_privilege(:owner,'public','USAGE') AS owner_schema_usage,
           has_schema_privilege(:owner,'public','CREATE') AS owner_schema_create
         FROM governed;`,
        {
          replacements: {
            functions: allFunctions,
            owner: GOVERNANCE_OWNER,
            runtime: RUNTIME_ROLE,
            test: TEST_ROLE,
            migration582: MIGRATION_582,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      if (!preflight?.database_approved) {
        throw new Error('COMPONENT_LIFE_LIMIT_GATE_ACL_DATABASE_IDENTITY_REQUIRED');
      }
      if (!preflight.migration_authorized) {
        throw new Error('COMPONENT_LIFE_LIMIT_GATE_ACL_MIGRATION_AUTHORITY_REQUIRED');
      }
      if (!preflight.owner_exists) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNER_MISSING');
      }
      if (!preflight.owner_safe || preflight.runtime_can_set_owner || preflight.test_can_set_owner) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNER_UNSAFE');
      }
      if (!preflight.gate_exists) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_GATE_MISSING');
      }
      if (preflight.gate_owner !== GOVERNANCE_OWNER) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_GATE_OWNER_INVALID');
      }
      if (!preflight.migration_582_applied) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_MIGRATION_582_REQUIRED');
      }
      if (preflight.function_count !== allFunctions.length
          || preflight.owned_function_count !== allFunctions.length
          || preflight.safe_function_count !== allFunctions.length) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_FUNCTION_BOUNDARY_INVALID');
      }
      if (!preflight.owner_schema_usage || preflight.owner_schema_create) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_SCHEMA_BOUNDARY_INVALID');
      }

      await queryInterface.sequelize.query(
        `REVOKE ALL ON TABLE public.component_life_limit_governance_transition_gate FROM PUBLIC;
         REVOKE ALL ON TABLE public.component_life_limit_governance_transition_gate FROM ${RUNTIME_ROLE};
         REVOKE ALL ON TABLE public.component_life_limit_governance_transition_gate FROM ${TEST_ROLE};
         GRANT SELECT, INSERT, DELETE
           ON TABLE public.component_life_limit_governance_transition_gate
           TO ${GOVERNANCE_OWNER};
         REVOKE UPDATE, TRUNCATE, REFERENCES, TRIGGER
           ON TABLE public.component_life_limit_governance_transition_gate
           FROM ${GOVERNANCE_OWNER};`,
        { transaction }
      );

      const [verified] = await queryInterface.sequelize.query<Verification>(
        `WITH gate AS (
           SELECT c.oid,c.relacl,c.relowner
           FROM pg_catalog.pg_class c
           WHERE c.oid='public.component_life_limit_governance_transition_gate'::regclass
         ), governed AS (
           SELECT p.oid,p.prosecdef,p.proconfig,p.proacl,p.proowner,r.rolname AS owner
           FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
           WHERE p.oid=ANY(ARRAY[:functions]::regprocedure[])
         ) SELECT
           has_table_privilege(:owner,(SELECT oid FROM gate),'SELECT') AS owner_select,
           has_table_privilege(:owner,(SELECT oid FROM gate),'INSERT') AS owner_insert,
           has_table_privilege(:owner,(SELECT oid FROM gate),'DELETE') AS owner_delete,
           has_table_privilege(:owner,(SELECT oid FROM gate),'UPDATE') AS owner_update,
           has_table_privilege(:owner,(SELECT oid FROM gate),'TRUNCATE') AS owner_truncate,
           has_table_privilege(:owner,(SELECT oid FROM gate),'REFERENCES') AS owner_references,
           has_table_privilege(:owner,(SELECT oid FROM gate),'TRIGGER') AS owner_trigger,
           EXISTS (SELECT 1 FROM gate
             JOIN pg_catalog.aclexplode(COALESCE(relacl,pg_catalog.acldefault('r',relowner))) acl ON true
             WHERE acl.grantee=0 AND acl.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')) AS public_access,
           (has_table_privilege(:runtime,(SELECT oid FROM gate),'SELECT')
             OR has_table_privilege(:runtime,(SELECT oid FROM gate),'INSERT')
             OR has_table_privilege(:runtime,(SELECT oid FROM gate),'UPDATE')
             OR has_table_privilege(:runtime,(SELECT oid FROM gate),'DELETE')
             OR has_table_privilege(:runtime,(SELECT oid FROM gate),'TRUNCATE')
             OR has_table_privilege(:runtime,(SELECT oid FROM gate),'REFERENCES')
             OR has_table_privilege(:runtime,(SELECT oid FROM gate),'TRIGGER')) AS runtime_access,
           (has_table_privilege(:test,(SELECT oid FROM gate),'SELECT')
             OR has_table_privilege(:test,(SELECT oid FROM gate),'INSERT')
             OR has_table_privilege(:test,(SELECT oid FROM gate),'UPDATE')
             OR has_table_privilege(:test,(SELECT oid FROM gate),'DELETE')
             OR has_table_privilege(:test,(SELECT oid FROM gate),'TRUNCATE')
             OR has_table_privilege(:test,(SELECT oid FROM gate),'REFERENCES')
             OR has_table_privilege(:test,(SELECT oid FROM gate),'TRIGGER')) AS test_access,
           has_schema_privilege(:owner,'public','USAGE') AS owner_schema_usage,
           has_schema_privilege(:owner,'public','CREATE') AS owner_schema_create,
           (SELECT COUNT(*) FILTER (WHERE owner=:owner)::int FROM governed) AS owned_function_count,
           (SELECT COUNT(*) FILTER (WHERE prosecdef AND proconfig @> ARRAY['search_path=pg_catalog, public'])::int FROM governed) AS safe_function_count,
           EXISTS (SELECT 1 FROM governed g
             JOIN pg_catalog.aclexplode(COALESCE(g.proacl,pg_catalog.acldefault('f',g.proowner))) acl ON true
             WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_execute,
           NOT EXISTS (SELECT 1 FROM unnest(ARRAY[:entries]::regprocedure[]) f
             WHERE NOT has_function_privilege(:runtime,f,'EXECUTE')) AS runtime_entries,
           EXISTS (SELECT 1 FROM unnest(ARRAY[:triggers]::regprocedure[]) f
             WHERE has_function_privilege(:runtime,f,'EXECUTE')) AS runtime_triggers;`,
        {
          replacements: {
            functions: allFunctions,
            entries: [...ENTRY_FUNCTIONS],
            triggers: [...TRIGGER_FUNCTIONS],
            owner: GOVERNANCE_OWNER,
            runtime: RUNTIME_ROLE,
            test: TEST_ROLE,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      if (!verified || !verified.owner_select || !verified.owner_insert || !verified.owner_delete
          || verified.owner_update || verified.owner_truncate || verified.owner_references || verified.owner_trigger
          || verified.public_access || verified.runtime_access || verified.test_access
          || !verified.owner_schema_usage || verified.owner_schema_create
          || verified.owned_function_count !== allFunctions.length
          || verified.safe_function_count !== allFunctions.length
          || verified.public_execute || !verified.runtime_entries || verified.runtime_triggers) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_GATE_ACL_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async () => {
      throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_GATE_ACL_ROLLBACK_REFUSED');
    });
  },
};
