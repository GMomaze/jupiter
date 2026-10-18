'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

// SECURITY DEFINER resolver for the active-tenant RBAC hydration.
// tenant_membership_roles is FORCE RLS and jupiter_app is denied SELECT on it except a
// narrow column-level (id, revoked_at) grant (migration 628), so the hydration middleware
// cannot read
// the authenticated user's roles directly. This function returns only the
// authenticated user's roles and permissions for one exact membership, mirroring
// migration 620's resolver pattern. It exposes no cross-tenant data.

const FUNCTION_NAME = 'resolve_authenticated_membership_roles';
const SIGNATURE = `public.${FUNCTION_NAME}(uuid, uuid, uuid)`;
const OWNER = 'postgres';
const RUNTIME_ROLES = ['jupiter_app', 'jupiter_test'] as const;

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [roles] = await queryInterface.sequelize.query<{
        owner: boolean;
        runtime_app: boolean;
        runtime_test: boolean;
      }>(
        `SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = :owner) AS owner,
                EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'jupiter_app') AS runtime_app,
                EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'jupiter_test') AS runtime_test`,
        { replacements: { owner: OWNER }, type: QueryTypes.SELECT, transaction },
      );
      if (!roles?.owner || !roles.runtime_app || !roles.runtime_test) {
        throw new Error('MIGRATION_625_ROLES_MISSING');
      }

      await queryInterface.sequelize.query(
        `CREATE FUNCTION public.${FUNCTION_NAME}(p_user_id uuid, p_membership_id uuid, p_tenant_id uuid)
         RETURNS TABLE (role_code text, permissions json)
         LANGUAGE sql
         STABLE
         SECURITY DEFINER
         SET search_path = pg_catalog, public
         AS $$
           SELECT r.code,
                  COALESCE(json_agg(json_build_object('code', p.code) ORDER BY p.code)
                    FILTER (WHERE p.id IS NOT NULL AND p.is_active = true), '[]'::json)
           FROM public.tenant_memberships tm
           JOIN public.tenant_membership_roles tmr ON tmr.membership_id = tm.id AND tmr.revoked_at IS NULL
           JOIN public.rf_role r ON r.id = tmr.role_id AND r.is_active = true
           LEFT JOIN public.rf_role_permissions rp ON rp.role_id = r.id
           LEFT JOIN public.rf_permission p ON p.id = rp.permission_id
           WHERE tm.id = p_membership_id AND tm.tenant_id = p_tenant_id
             AND tm.user_id = p_user_id AND tm.status = 'ACTIVE'
           GROUP BY r.id, r.code
           ORDER BY r.code
         $$;`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `ALTER FUNCTION ${SIGNATURE} OWNER TO ${OWNER}`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `REVOKE ALL ON FUNCTION ${SIGNATURE} FROM PUBLIC`,
        { transaction },
      );
      for (const role of RUNTIME_ROLES) {
        await queryInterface.sequelize.query(
          `GRANT EXECUTE ON FUNCTION ${SIGNATURE} TO ${role}`,
          { transaction },
        );
      }

      const [verified] = await queryInterface.sequelize.query<{
        fn_exists: boolean;
        owner_ok: boolean;
        security_definer: boolean;
        runtime_app_execute: boolean;
        runtime_test_execute: boolean;
      }>(
        `SELECT
           to_regprocedure(:signature) IS NOT NULL AS fn_exists,
           EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
                  WHERE p.oid = to_regprocedure(:signature) AND r.rolname = :owner) AS owner_ok,
           (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure(:signature)) AS security_definer,
           has_function_privilege('jupiter_app', :signature, 'EXECUTE') AS runtime_app_execute,
           has_function_privilege('jupiter_test', :signature, 'EXECUTE') AS runtime_test_execute`,
        {
          replacements: { signature: SIGNATURE, owner: OWNER },
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      if (
        !verified ||
        !verified.fn_exists ||
        !verified.owner_ok ||
        !verified.security_definer ||
        !verified.runtime_app_execute ||
        !verified.runtime_test_execute
      ) {
        throw new Error('MIGRATION_625_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS ${SIGNATURE}`, {
        transaction,
      });
      const [verified] = await queryInterface.sequelize.query<{ fn_exists: boolean }>(
        `SELECT to_regprocedure(:signature) IS NOT NULL AS fn_exists`,
        { replacements: { signature: SIGNATURE }, type: QueryTypes.SELECT, transaction },
      );
      if (!verified || verified.fn_exists) {
        throw new Error('MIGRATION_625_DOWN_VERIFICATION_FAILED');
      }
    });
  },
};
