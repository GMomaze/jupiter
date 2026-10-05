'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

// Additive user retirement: introduces an explicit `retired_at` marker so an
// obsolete onboarding-created identity can be retired (historical evidence
// preserved, FK references intact) without blocking future legitimate reuse of
// its historical email. Email uniqueness is narrowed to non-retired users only,
// preserving the established lowercase-email case semantics (the app already
// stores normalized lowercase emails; the unique index remains on the raw
// `email` column exactly like the prior `users_email_key` constraint).

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [pre] = await queryInterface.sequelize.query<{ has: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='users_email_key') AS has`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (!pre?.has) throw new Error('MIGRATION_619_REQUIRES_USERS_EMAIL_KEY');

      await queryInterface.sequelize.query(
        `ALTER TABLE public.users ADD COLUMN retired_at timestamptz NULL`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE public.users DROP CONSTRAINT users_email_key`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX users_email_live_unique ON public.users (email) WHERE retired_at IS NULL`,
        { transaction },
      );

      const [verified] = await queryInterface.sequelize.query<{
        constraint: number;
        column: boolean;
        index: boolean;
      }>(
        `SELECT
           (SELECT count(*)::int FROM pg_constraint WHERE conname='users_email_key') AS constraint,
           EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.users'::regclass AND attname='retired_at') AS column,
           EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='users_email_live_unique') AS index`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (!verified || verified.constraint !== 0 || !verified.column || !verified.index) {
        throw new Error('MIGRATION_619_USER_RETIREMENT_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [duplicate] = await queryInterface.sequelize.query<{ has: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM public.users a JOIN public.users b ON a.email=b.email AND a.id<>b.id
         ) AS has`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (duplicate?.has) {
        throw new Error('MIGRATION_619_DOWN_REFUSES_EMAIL_COLLISION');
      }

      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS public.users_email_live_unique`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE public.users DROP COLUMN retired_at`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email)`,
        { transaction },
      );

      const [verified] = await queryInterface.sequelize.query<{
        constraint: boolean;
        column: number;
        index: number;
      }>(
        `SELECT
           EXISTS(SELECT 1 FROM pg_constraint WHERE conname='users_email_key') AS constraint,
           (SELECT count(*)::int FROM pg_attribute WHERE attrelid='public.users'::regclass AND attname='retired_at') AS column,
           (SELECT count(*)::int FROM pg_indexes WHERE indexname='users_email_live_unique') AS index`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (!verified || !verified.constraint || verified.column !== 0 || verified.index !== 0) {
        throw new Error('MIGRATION_619_DOWN_VERIFICATION_FAILED');
      }
    });
  },
};
