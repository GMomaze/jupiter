'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const CTX = "NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid";
const PRED = `tenant_id = ${CTX}`;

// The 609 hybrid (workpack + aircraft) SELECT predicate breaks the ORM's
// `INSERT ... RETURNING`, because PostgreSQL subjects the RETURNING row to the
// SELECT policy, which requires a workpack_tasks link that cannot exist yet at
// creation time. Since task_cards.tenant_id is now pinned to the authoritative
// aircraft tenant via a composite FK (migration 615), the direct `tenant_id =
// CTX` predicate is the verified, non-circular formulation for SELECT/UPDATE/
// DELETE and preserves the aircraft-consistency ambiguity protection 609 added.

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DROP POLICY IF EXISTS task_cards_tenant_rls_select ON public.task_cards;
         CREATE POLICY task_cards_tenant_rls_select ON public.task_cards FOR SELECT USING (${PRED});

         DROP POLICY IF EXISTS task_cards_tenant_rls_update ON public.task_cards;
         CREATE POLICY task_cards_tenant_rls_update ON public.task_cards FOR UPDATE USING (${PRED}) WITH CHECK (${PRED});

         DROP POLICY IF EXISTS task_cards_tenant_rls_delete ON public.task_cards;
         CREATE POLICY task_cards_tenant_rls_delete ON public.task_cards FOR DELETE USING (${PRED});`,
        { transaction },
      );

      const [verified] = await queryInterface.sequelize.query<{
        select_policy: number; update_policy: number; delete_policy: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM pg_catalog.pg_policies WHERE tablename = 'task_cards' AND policyname = 'task_cards_tenant_rls_select' AND cmd = 'SELECT') AS select_policy,
           (SELECT count(*)::int FROM pg_catalog.pg_policies WHERE tablename = 'task_cards' AND policyname = 'task_cards_tenant_rls_update' AND cmd = 'UPDATE') AS update_policy,
           (SELECT count(*)::int FROM pg_catalog.pg_policies WHERE tablename = 'task_cards' AND policyname = 'task_cards_tenant_rls_delete' AND cmd = 'DELETE') AS delete_policy`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (!verified || verified.select_policy !== 1 || verified.update_policy !== 1 || verified.delete_policy !== 1) {
        throw new Error('TENANT_TASK_CARD_TENANT_ID_POLICY_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const HYBRID = `EXISTS (SELECT 1 FROM public.workpack_tasks wt
            JOIN public.workpacks w ON w.id = wt.workpack_id
            WHERE wt.task_id = task_cards.id AND w.tenant_id = ${CTX})
         AND EXISTS (SELECT 1 FROM public.aircraft a
            WHERE a.id = task_cards.aircraft_id AND a.tenant_id = ${CTX})`;
      await queryInterface.sequelize.query(
        `DROP POLICY IF EXISTS task_cards_tenant_rls_select ON public.task_cards;
         CREATE POLICY task_cards_tenant_rls_select ON public.task_cards FOR SELECT USING (${HYBRID});

         DROP POLICY IF EXISTS task_cards_tenant_rls_update ON public.task_cards;
         CREATE POLICY task_cards_tenant_rls_update ON public.task_cards FOR UPDATE USING (${HYBRID}) WITH CHECK (${HYBRID});

         DROP POLICY IF EXISTS task_cards_tenant_rls_delete ON public.task_cards;
         CREATE POLICY task_cards_tenant_rls_delete ON public.task_cards FOR DELETE USING (${HYBRID});`,
        { transaction },
      );
    });
  },
};
