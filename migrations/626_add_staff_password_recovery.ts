'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

// Additive self-service staff password recovery foundation.
//
//  1. Adds nullable reset-token hash + expiry columns to `users` so ordinary
//     staff and tenant administrators can request a password reset (mirrors the
//     CustomerUser `password_reset_token_hash`/`password_reset_expires_at` shape).
//  2. Creates a narrowly scoped IMMUTABLE recovery audit table. The platform-
//     global audit (`platform_global_audit_log`) requires a platform principal,
//     which ordinary staff do not have, so a dedicated table records reset
//     request/completion/refusal with no token, password or email material.
//
// The audit table is immutable (BEFORE UPDATE/DELETE trigger) and is granted
// only SELECT/INSERT to the runtime roles (no UPDATE/DELETE), so recovery
// evidence cannot be altered after the fact.

const AUDIT_TABLE = 'staff_password_recovery_audit';

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [pre] = await queryInterface.sequelize.query<{ token: number; expiry: number }>(
        `SELECT
           (SELECT count(*)::int FROM pg_attribute WHERE attrelid='public.users'::regclass AND attname='password_reset_token_hash') AS token,
           (SELECT count(*)::int FROM pg_attribute WHERE attrelid='public.users'::regclass AND attname='password_reset_expires_at') AS expiry`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (pre && (pre.token > 0 || pre.expiry > 0)) {
        throw new Error('MIGRATION_626_USERS_RESET_COLUMNS_ALREADY_EXIST');
      }

      await queryInterface.sequelize.query(
        `ALTER TABLE public.users
           ADD COLUMN password_reset_token_hash varchar(255) NULL,
           ADD COLUMN password_reset_expires_at timestamptz NULL`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `CREATE TABLE public.${AUDIT_TABLE} (
           id uuid PRIMARY KEY,
           user_id uuid NULL REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
           action varchar(120) NOT NULL,
           outcome varchar(32) NOT NULL,
           reason text NULL,
           correlation_id uuid NOT NULL,
           created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX ${AUDIT_TABLE}_user_idx ON public.${AUDIT_TABLE}(user_id)`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX ${AUDIT_TABLE}_correlation_idx ON public.${AUDIT_TABLE}(correlation_id)`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `CREATE FUNCTION public.fn_${AUDIT_TABLE}_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
         BEGIN RAISE EXCEPTION 'STAFF_PASSWORD_RECOVERY_AUDIT_IMMUTABLE'; END; $$`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE TRIGGER tr_${AUDIT_TABLE}_immutable
           BEFORE UPDATE OR DELETE ON public.${AUDIT_TABLE}
           FOR EACH ROW EXECUTE FUNCTION public.fn_${AUDIT_TABLE}_immutable()`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `REVOKE ALL ON TABLE public.${AUDIT_TABLE} FROM PUBLIC, jupiter_app`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `GRANT SELECT, INSERT ON TABLE public.${AUDIT_TABLE} TO jupiter_app`,
        { transaction },
      );

      const [verified] = await queryInterface.sequelize.query<{
        token: boolean;
        expiry: boolean;
        table: boolean;
        trigger: boolean;
        runtime_update: boolean;
        runtime_delete: boolean;
        runtime_insert: boolean;
      }>(
        `SELECT
           EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.users'::regclass AND attname='password_reset_token_hash') AS token,
           EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.users'::regclass AND attname='password_reset_expires_at') AS expiry,
           to_regclass('public.${AUDIT_TABLE}') IS NOT NULL AS table,
           EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_${AUDIT_TABLE}_immutable' AND tgenabled<>'D') AS trigger,
           has_table_privilege('jupiter_app','public.${AUDIT_TABLE}','UPDATE') AS runtime_update,
           has_table_privilege('jupiter_app','public.${AUDIT_TABLE}','DELETE') AS runtime_delete,
           has_table_privilege('jupiter_app','public.${AUDIT_TABLE}','INSERT') AS runtime_insert`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (
        !verified ||
        !verified.token ||
        !verified.expiry ||
        !verified.table ||
        !verified.trigger ||
        verified.runtime_update ||
        verified.runtime_delete ||
        !verified.runtime_insert
      ) {
        throw new Error('MIGRATION_626_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DROP TRIGGER IF EXISTS tr_${AUDIT_TABLE}_immutable ON public.${AUDIT_TABLE}`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `DROP FUNCTION IF EXISTS public.fn_${AUDIT_TABLE}_immutable()`,
        { transaction },
      );
      await queryInterface.sequelize.query(`DROP TABLE IF EXISTS public.${AUDIT_TABLE}`, {
        transaction,
      });
      await queryInterface.sequelize.query(
        `ALTER TABLE public.users
           DROP COLUMN IF EXISTS password_reset_token_hash,
           DROP COLUMN IF EXISTS password_reset_expires_at`,
        { transaction },
      );

      const [verified] = await queryInterface.sequelize.query<{ table: boolean; token: number; expiry: number }>(
        `SELECT
           to_regclass('public.${AUDIT_TABLE}') IS NOT NULL AS table,
           (SELECT count(*)::int FROM pg_attribute WHERE attrelid='public.users'::regclass AND attname='password_reset_token_hash') AS token,
           (SELECT count(*)::int FROM pg_attribute WHERE attrelid='public.users'::regclass AND attname='password_reset_expires_at') AS expiry`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (!verified || verified.table || verified.token !== 0 || verified.expiry !== 0) {
        throw new Error('MIGRATION_626_DOWN_VERIFICATION_FAILED');
      }
    });
  },
};
