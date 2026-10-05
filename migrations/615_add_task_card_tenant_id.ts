'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const CTX = "NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid";

// Denormalize the authoritative tenant root onto task_cards so the INSERT RLS
// policy can use a direct `tenant_id = CTX` predicate (the same mechanism as
// migration 606 direct-custody tables), which is reliably evaluated by the
// Sequelize ORM. A composite FK pins task_cards.tenant_id to its aircraft's
// tenant, preventing tenant_id from becoming an independently forgeable value.
const INSERT_PREDICATE = `tenant_id = ${CTX}`;

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `ALTER TABLE public.task_cards ADD COLUMN tenant_id uuid;`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE public.task_cards tc
           SET tenant_id = a.tenant_id
           FROM public.aircraft a
          WHERE a.id = tc.aircraft_id;`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE public.task_cards ALTER COLUMN tenant_id SET NOT NULL;`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE public.aircraft ADD CONSTRAINT aircraft_id_tenant_id_uq UNIQUE (id, tenant_id);`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE public.task_cards
           ADD CONSTRAINT task_cards_aircraft_tenant_fk
           FOREIGN KEY (aircraft_id, tenant_id)
           REFERENCES public.aircraft (id, tenant_id);`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `DROP POLICY IF EXISTS task_cards_tenant_rls_insert ON public.task_cards;
         CREATE POLICY task_cards_tenant_rls_insert ON public.task_cards
           FOR INSERT WITH CHECK (${INSERT_PREDICATE});`,
        { transaction },
      );

      const [verified] = await queryInterface.sequelize.query<{
        col_not_null: number; fk_count: number; policies: number; forced: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM information_schema.columns
              WHERE table_name = 'task_cards' AND column_name = 'tenant_id' AND is_nullable = 'NO') AS col_not_null,
           (SELECT count(*)::int FROM pg_catalog.pg_constraint
              WHERE conname = 'task_cards_aircraft_tenant_fk') AS fk_count,
           (SELECT count(*)::int FROM pg_catalog.pg_policies
              WHERE tablename = 'task_cards' AND policyname = 'task_cards_tenant_rls_insert') AS policies,
           (SELECT count(*)::int FROM pg_catalog.pg_class
              WHERE relname = 'task_cards' AND relforcerowsecurity) AS forced`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (!verified || verified.col_not_null !== 1 || verified.fk_count !== 1 || verified.policies !== 1 || verified.forced !== 1) {
        throw new Error('TENANT_TASK_CARD_TENANT_ID_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Restore the 614 aircraft-root INSERT policy.
      await queryInterface.sequelize.query(
        `DROP POLICY IF EXISTS task_cards_tenant_rls_insert ON public.task_cards;
         CREATE POLICY task_cards_tenant_rls_insert ON public.task_cards
           FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = aircraft_id AND a.tenant_id = ${CTX}));`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE public.task_cards DROP CONSTRAINT IF EXISTS task_cards_aircraft_tenant_fk;`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE public.aircraft DROP CONSTRAINT IF EXISTS aircraft_id_tenant_id_uq;`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE public.task_cards DROP COLUMN IF EXISTS tenant_id;`,
        { transaction },
      );
    });
  },
};
