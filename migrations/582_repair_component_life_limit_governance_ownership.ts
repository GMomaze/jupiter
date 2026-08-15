'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const GOVERNANCE_OWNER = 'jupiter_governance_owner';
const RUNTIME_ROLE = 'jupiter_app';

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

type RoleSafety = {
  exists: boolean;
  safe_attributes: boolean;
  runtime_can_set_role: boolean;
  migration_authorized: boolean;
};

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [role] = await queryInterface.sequelize.query<RoleSafety>(
        `SELECT
           EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=:owner) AS exists,
           COALESCE((SELECT NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb
                            AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls
                            AND NOT rolinherit
                     FROM pg_catalog.pg_roles WHERE rolname=:owner), false) AS safe_attributes,
           CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=:owner)
                THEN pg_catalog.pg_has_role(:runtime, :owner, 'SET') ELSE false END AS runtime_can_set_role,
           CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=:owner)
                THEN current_user <> :runtime AND (
                  (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user)
                  OR pg_catalog.pg_has_role(current_user, :owner, 'SET')
                ) ELSE false END AS migration_authorized;`,
        {
          replacements: { owner: GOVERNANCE_OWNER, runtime: RUNTIME_ROLE },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      if (!role?.exists) throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNER_MISSING');
      if (!role.safe_attributes || role.runtime_can_set_role) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNER_UNSAFE');
      }
      if (!role.migration_authorized) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_MIGRATION_AUTHORITY_REQUIRED');
      }

      const allFunctions = [...ENTRY_FUNCTIONS, ...TRIGGER_FUNCTIONS];
      const [objects] = await queryInterface.sequelize.query<{ function_count: number; gate_exists: boolean }>(
        `SELECT
           (SELECT COUNT(*)::int FROM pg_catalog.pg_proc p
             WHERE p.oid = ANY(ARRAY[:functions]::regprocedure[])) AS function_count,
           to_regclass('public.component_life_limit_governance_transition_gate') IS NOT NULL AS gate_exists;`,
        {
          replacements: { functions: allFunctions },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      if (!objects?.gate_exists || objects.function_count !== allFunctions.length) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_OBJECTS_MISSING');
      }

      await queryInterface.sequelize.query(
        `GRANT USAGE ON SCHEMA public TO ${GOVERNANCE_OWNER};
         REVOKE CREATE ON SCHEMA public FROM ${GOVERNANCE_OWNER};

         ALTER TABLE public.component_life_limit_governance_transition_gate OWNER TO ${GOVERNANCE_OWNER};
         REVOKE ALL ON TABLE public.component_life_limit_governance_transition_gate FROM PUBLIC;
         REVOKE ALL ON TABLE public.component_life_limit_governance_transition_gate FROM ${RUNTIME_ROLE};

         GRANT SELECT, UPDATE ON TABLE public.component_life_limit_proposals TO ${GOVERNANCE_OWNER};
         GRANT SELECT, INSERT, UPDATE ON TABLE public.component_life_limit_publications TO ${GOVERNANCE_OWNER};
         GRANT INSERT ON TABLE public.component_life_limit_governance_history TO ${GOVERNANCE_OWNER};
         GRANT SELECT, INSERT, UPDATE ON TABLE public.component_life_limits TO ${GOVERNANCE_OWNER};
         GRANT SELECT ON TABLE public.user_roles, public.rf_role_permissions, public.rf_permission TO ${GOVERNANCE_OWNER};`,
        { transaction }
      );

      for (const signature of ENTRY_FUNCTIONS) {
        await queryInterface.sequelize.query(
          `ALTER FUNCTION ${signature} OWNER TO ${GOVERNANCE_OWNER};
           ALTER FUNCTION ${signature} SECURITY DEFINER;
           ALTER FUNCTION ${signature} SET search_path = pg_catalog, public;
           REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC;
           REVOKE ALL ON FUNCTION ${signature} FROM ${RUNTIME_ROLE};
           GRANT EXECUTE ON FUNCTION ${signature} TO ${RUNTIME_ROLE};`,
          { transaction }
        );
      }
      for (const signature of TRIGGER_FUNCTIONS) {
        await queryInterface.sequelize.query(
          `ALTER FUNCTION ${signature} OWNER TO ${GOVERNANCE_OWNER};
           ALTER FUNCTION ${signature} SECURITY DEFINER;
           ALTER FUNCTION ${signature} SET search_path = pg_catalog, public;
           REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC;
           REVOKE ALL ON FUNCTION ${signature} FROM ${RUNTIME_ROLE};`,
          { transaction }
        );
      }

      const [verified] = await queryInterface.sequelize.query<{
        owned_functions: number;
        safe_functions: number;
        public_entry_execute: boolean;
        runtime_entry_execute: boolean;
        runtime_trigger_execute: boolean;
        gate_owner: string;
        runtime_gate_access: boolean;
        public_gate_access: boolean;
        owner_schema_usage: boolean;
        owner_schema_create: boolean;
      }>(
        `WITH governed AS (
           SELECT p.oid,p.prosecdef,p.proconfig,p.proacl,p.proowner,r.rolname AS owner
           FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
           WHERE p.oid = ANY(ARRAY[:functions]::regprocedure[])
         ) SELECT
           COUNT(*) FILTER (WHERE owner=:owner)::int AS owned_functions,
           COUNT(*) FILTER (WHERE prosecdef AND proconfig @> ARRAY['search_path=pg_catalog, public'])::int AS safe_functions,
           EXISTS (SELECT 1 FROM governed g
             JOIN pg_catalog.aclexplode(COALESCE(g.proacl,pg_catalog.acldefault('f',g.proowner))) acl ON true
             WHERE g.oid=ANY(ARRAY[:entries]::regprocedure[]) AND acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_entry_execute,
           NOT EXISTS (SELECT 1 FROM unnest(ARRAY[:entries]::regprocedure[]) f WHERE NOT has_function_privilege(:runtime,f,'EXECUTE')) AS runtime_entry_execute,
           EXISTS (SELECT 1 FROM unnest(ARRAY[:triggers]::regprocedure[]) f WHERE has_function_privilege(:runtime,f,'EXECUTE')) AS runtime_trigger_execute,
           (SELECT r.rolname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles r ON r.oid=c.relowner
             WHERE c.oid='public.component_life_limit_governance_transition_gate'::regclass) AS gate_owner,
           has_table_privilege(:runtime,'public.component_life_limit_governance_transition_gate','SELECT,INSERT,UPDATE,DELETE') AS runtime_gate_access,
           EXISTS (SELECT 1 FROM pg_catalog.pg_class gate
             JOIN pg_catalog.aclexplode(COALESCE(gate.relacl,pg_catalog.acldefault('r',gate.relowner))) acl ON true
             WHERE gate.oid='public.component_life_limit_governance_transition_gate'::regclass
               AND acl.grantee=0 AND acl.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')) AS public_gate_access,
           has_schema_privilege(:owner,'public','USAGE') AS owner_schema_usage,
           has_schema_privilege(:owner,'public','CREATE') AS owner_schema_create
         FROM governed;`,
        {
          replacements: { functions: allFunctions, entries: [...ENTRY_FUNCTIONS], triggers: [...TRIGGER_FUNCTIONS], owner: GOVERNANCE_OWNER, runtime: RUNTIME_ROLE },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      if (!verified || verified.owned_functions !== allFunctions.length || verified.safe_functions !== allFunctions.length
          || verified.public_entry_execute || !verified.runtime_entry_execute || verified.runtime_trigger_execute
          || verified.gate_owner !== GOVERNANCE_OWNER || verified.runtime_gate_access || verified.public_gate_access
          || !verified.owner_schema_usage || verified.owner_schema_create) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNERSHIP_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [history] = await queryInterface.sequelize.query<{ count: number }>(
        `SELECT (SELECT COUNT(*) FROM public.component_life_limit_proposals)
              + (SELECT COUNT(*) FROM public.component_life_limit_publications)
              + (SELECT COUNT(*) FROM public.component_life_limit_governance_history) AS count;`,
        { type: QueryTypes.SELECT, transaction }
      );
      if (Number(history?.count || 0) > 0) throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_HISTORY_EXISTS');
      throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNERSHIP_ROLLBACK_REFUSED');
    });
  },
};
