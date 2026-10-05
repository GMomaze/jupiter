'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

// Additive platform-only human invitation foundation.
//
// A platform-only human (e.g. a shared-master operator) has a global `users`
// identity but deliberately NO tenant membership, tenant role, or platform
// principal at invitation time. `staff_invitations` is tenant-bound by design
// (`tenant_id`/`membership_id` NOT NULL), so platform-only onboarding requires
// its own invitation table with no tenant/membership foreign keys. Only the
// token hash is persisted; plaintext tokens never touch the database.

const TABLE = 'platform_user_invitations';

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `CREATE TABLE public.${TABLE} (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          normalized_email varchar(320) NOT NULL,
          token_hash char(64) NOT NULL UNIQUE,
          expires_at timestamptz NOT NULL,
          invited_by_user_id uuid NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          consumed_at timestamptz NULL,
          revoked_at timestamptz NULL,
          revoked_by_user_id uuid NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT platform_user_invitations_email_normalized CHECK (normalized_email = lower(btrim(normalized_email))),
          CONSTRAINT platform_user_invitations_expiry CHECK (expires_at > created_at),
          CONSTRAINT platform_user_invitations_terminal_state CHECK (NOT (consumed_at IS NOT NULL AND revoked_at IS NOT NULL)),
          CONSTRAINT platform_user_invitations_revocation_shape CHECK ((revoked_at IS NULL AND revoked_by_user_id IS NULL) OR (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL))
        )`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX platform_user_invitations_one_live_email ON public.${TABLE}(normalized_email) WHERE consumed_at IS NULL AND revoked_at IS NULL`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX platform_user_invitations_email_created ON public.${TABLE}(normalized_email, created_at)`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='jupiter_app') THEN
           GRANT SELECT,INSERT,UPDATE ON public.${TABLE} TO jupiter_app;
           REVOKE DELETE ON public.${TABLE} FROM jupiter_app;
         END IF; END $$`,
        { transaction },
      );

      const [verified] = await queryInterface.sequelize.query<{
        table_exists: boolean;
        live_index: boolean;
        created_index: boolean;
      }>(
        `SELECT
           to_regclass('public.${TABLE}') IS NOT NULL AS table_exists,
           EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='platform_user_invitations_one_live_email') AS live_index,
           EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='platform_user_invitations_email_created') AS created_index`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (!verified || !verified.table_exists || !verified.live_index || !verified.created_index) {
        throw new Error('MIGRATION_621_PLATFORM_USER_INVITATION_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [state] = await queryInterface.sequelize.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM public.${TABLE}`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (state && state.count > 0) {
        throw new Error('MIGRATION_621_DOWN_REFUSES_LIVE_INVITATIONS');
      }
      await queryInterface.sequelize.query(`DROP TABLE public.${TABLE}`, { transaction });
      const [verified] = await queryInterface.sequelize.query<{ exists: boolean }>(
        `SELECT to_regclass('public.${TABLE}') IS NOT NULL AS exists`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (!verified || verified.exists) {
        throw new Error('MIGRATION_621_DOWN_VERIFICATION_FAILED');
      }
    });
  },
};
