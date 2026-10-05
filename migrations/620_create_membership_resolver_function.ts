'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

// Pre-context membership resolver.
//
// tenant_memberships is FORCE ROW LEVEL SECURITY (migration 613) with the
// predicate tenant_id = current_setting('jupiter.tenant_id', true)::uuid.
// During login no tenant context exists yet, so the runtime role cannot read
// its own memberships (and the table owner is also subject to RLS because of
// FORCE). This migration introduces a narrowly scoped SECURITY DEFINER function
// owned by postgres (superuser + BYPASSRLS, always RLS-exempt) that returns ONLY
// the authenticated user's membership + tenant relationship columns required to
// make the existing eligibility decision. It is not a general cross-tenant
// lookup and exposes no role, platform, or unnecessary data.

const FUNCTION_NAME = 'resolve_authenticated_memberships';
const RESOLVER_OWNER = 'postgres';
const RUNTIME_ROLES = ['jupiter_app', 'jupiter_test'] as const;

const SIGNATURE = `public.${FUNCTION_NAME}(uuid)`;

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [roles] = await queryInterface.sequelize.query<{
        owner: boolean;
        runtime_app: boolean;
        runtime_test: boolean;
      }>(
        `SELECT
           EXISTS(SELECT 1 FROM pg_roles WHERE rolname = :owner) AS owner,
           EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'jupiter_app') AS runtime_app,
           EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'jupiter_test') AS runtime_test`,
        { replacements: { owner: RESOLVER_OWNER }, type: QueryTypes.SELECT, transaction },
      );
      if (!roles?.owner || !roles.runtime_app || !roles.runtime_test) {
        throw new Error('MIGRATION_620_RESOLVER_ROLES_MISSING');
      }

      await queryInterface.sequelize.query(
        `CREATE FUNCTION public.${FUNCTION_NAME}(p_user_id uuid)
         RETURNS TABLE (
           membership_id uuid,
           membership_tenant_id uuid,
           membership_user_id uuid,
           membership_status text,
           tenant_id uuid,
           tenant_public_id uuid,
           tenant_code text,
           tenant_display_name text,
           tenant_status text
         )
         LANGUAGE sql
         STABLE
         SECURITY DEFINER
         SET search_path = pg_catalog, public
         AS $$
           SELECT m.id, m.tenant_id, m.user_id, m.status,
                  t.id, t.public_id, t.code, t.display_name, t.status
           FROM public.tenant_memberships AS m
           JOIN public.tenants AS t ON t.id = m.tenant_id
           WHERE m.user_id = p_user_id
         $$;`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER FUNCTION ${SIGNATURE} OWNER TO ${RESOLVER_OWNER}`,
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
        { replacements: { signature: SIGNATURE, owner: RESOLVER_OWNER }, type: QueryTypes.SELECT, transaction },
      );
      if (
        !verified ||
        !verified.fn_exists ||
        !verified.owner_ok ||
        !verified.security_definer ||
        !verified.runtime_app_execute ||
        !verified.runtime_test_execute
      ) {
        throw new Error('MIGRATION_620_RESOLVER_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DROP FUNCTION IF EXISTS ${SIGNATURE}`,
        { transaction },
      );

      const [verified] = await queryInterface.sequelize.query<{ fn_exists: boolean }>(
        `SELECT to_regprocedure(:signature) IS NOT NULL AS fn_exists`,
        { replacements: { signature: SIGNATURE }, type: QueryTypes.SELECT, transaction },
      );
      if (!verified || verified.fn_exists) {
        throw new Error('MIGRATION_620_RESOLVER_DOWN_VERIFICATION_FAILED');
      }
    });
  },
};

