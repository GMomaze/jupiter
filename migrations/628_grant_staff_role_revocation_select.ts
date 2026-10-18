'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

// Narrow column-level SELECT grant to restore staff-role revocation under jupiter_app.
// tenant_membership_roles is FORCE RLS and jupiter_app holds only INSERT/UPDATE on it
// (migration 602). The revocation UPDATE (`... WHERE id=$1 AND revoked_at IS NULL`)
// requires SELECT on the WHERE columns `id` and `revoked_at`; this migration grants ONLY
// those two columns. membership_id / role_id / assigned_by_user_id / revocation_reason
// (the protected role-assignment data) remain unreadable, and no table-level SELECT is
// granted. Row discovery remains confined to the current tenant by the FORCE RLS policy
// (migration 613).

const TABLE = 'tenant_membership_roles';
const ROLE = 'jupiter_app';
const APPROVED_COLUMNS = ['id', 'revoked_at'];

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [state] = await queryInterface.sequelize.query<{ table: boolean; role: boolean }>(
        `SELECT to_regclass('public.${TABLE}') IS NOT NULL AS "table",
                EXISTS(SELECT 1 FROM pg_roles WHERE rolname = :role) AS role`,
        { replacements: { role: ROLE }, type: QueryTypes.SELECT, transaction },
      );
      if (!state?.table || !state?.role) {
        throw new Error('MIGRATION_628_REQUIRES_TABLE_AND_ROLE');
      }

      await queryInterface.sequelize.query(
        `GRANT SELECT (${APPROVED_COLUMNS.join(', ')}) ON TABLE public.${TABLE} TO ${ROLE};`,
        { transaction },
      );

      const [verified] = await queryInterface.sequelize.query<{
        id_select: boolean;
        revoked_at_select: boolean;
        table_select: boolean;
        unexpected_columns: number;
      }>(
        `SELECT
           has_column_privilege(:role, 'public.${TABLE}', 'id', 'SELECT') AS id_select,
           has_column_privilege(:role, 'public.${TABLE}', 'revoked_at', 'SELECT') AS revoked_at_select,
           has_table_privilege(:role, 'public.${TABLE}', 'SELECT') AS table_select,
           (SELECT count(*)::int FROM information_schema.column_privileges
             WHERE table_schema = 'public' AND table_name = '${TABLE}' AND grantee = :role
               AND privilege_type = 'SELECT'
               AND column_name NOT IN (${APPROVED_COLUMNS.map((c) => `'${c}'`).join(', ')})) AS unexpected_columns`,
        { replacements: { role: ROLE }, type: QueryTypes.SELECT, transaction },
      );
      if (
        !verified ||
        !verified.id_select ||
        !verified.revoked_at_select ||
        verified.table_select ||
        verified.unexpected_columns > 0
      ) {
        throw new Error('MIGRATION_628_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `REVOKE SELECT (${APPROVED_COLUMNS.join(', ')}) ON TABLE public.${TABLE} FROM ${ROLE};`,
        { transaction },
      );
      const [verified] = await queryInterface.sequelize.query<{ id_select: boolean; revoked_at_select: boolean }>(
        `SELECT
           has_column_privilege(:role, 'public.${TABLE}', 'id', 'SELECT') AS id_select,
           has_column_privilege(:role, 'public.${TABLE}', 'revoked_at', 'SELECT') AS revoked_at_select`,
        { replacements: { role: ROLE }, type: QueryTypes.SELECT, transaction },
      );
      if (!verified || verified.id_select || verified.revoked_at_select) {
        throw new Error('MIGRATION_628_DOWN_VERIFICATION_FAILED');
      }
    });
  },
};
