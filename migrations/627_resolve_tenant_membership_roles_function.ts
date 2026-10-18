'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

// SECURITY DEFINER resolver for tenant staff listing and role toggling.
// tenant_membership_roles is FORCE RLS and jupiter_app is denied SELECT on it except a
// narrow column-level (id, revoked_at) grant (migration 628). The staff repository must
// not read
// role assignments directly (SQLSTATE 42501); it reads them through this narrow
// resolver. The resolver takes NO caller-supplied tenant id: it derives the tenant
// from the transaction-local `jupiter.tenant_id` setting established by the
// application's validated TenantQueryAuthority (via set_config), mirroring the
// FORCE RLS predicate. This prevents any tenant from requesting another tenant's
// role assignments.

const FUNCTION_NAME = 'resolve_tenant_membership_roles';
const SIGNATURE = `public.${FUNCTION_NAME}()`;
const OWNER = 'postgres';

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
      // postgres (owner) and jupiter_app are mandatory; jupiter_test is optional
      // (operational/commissioning installations may not have a test-only role).
      if (!roles?.owner || !roles.runtime_app) {
        throw new Error('MIGRATION_627_ROLES_MISSING');
      }

      await queryInterface.sequelize.query(
        `CREATE FUNCTION public.${FUNCTION_NAME}()
         RETURNS TABLE (membership_id uuid, assignment_id uuid, role_id uuid, role_code text)
         LANGUAGE sql
         STABLE
         SECURITY DEFINER
         SET search_path = pg_catalog, public
         AS $$
           SELECT tm.id AS membership_id,
                  tmr.id AS assignment_id,
                  r.id AS role_id,
                  r.code AS role_code
           FROM public.tenant_memberships tm
           JOIN public.tenant_membership_roles tmr
             ON tmr.membership_id = tm.id AND tmr.revoked_at IS NULL
           JOIN public.rf_role r ON r.id = tmr.role_id AND r.is_active = true
           WHERE tm.tenant_id = NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid
             AND tm.status = 'ACTIVE'
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
      await queryInterface.sequelize.query(
        `GRANT EXECUTE ON FUNCTION ${SIGNATURE} TO jupiter_app`,
        { transaction },
      );
      if (roles.runtime_test) {
        await queryInterface.sequelize.query(
          `GRANT EXECUTE ON FUNCTION ${SIGNATURE} TO jupiter_test`,
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
           CASE WHEN EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'jupiter_test')
                THEN has_function_privilege('jupiter_test', :signature, 'EXECUTE')
                ELSE true
           END AS runtime_test_execute`,
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
        (roles.runtime_test && !verified.runtime_test_execute)
      ) {
        throw new Error('MIGRATION_627_VERIFICATION_FAILED');
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
        throw new Error('MIGRATION_627_DOWN_VERIFICATION_FAILED');
      }
    });
  },
};
