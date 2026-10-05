'use strict';

import { QueryInterface } from 'sequelize';

const CTX = "NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid";
const POLICY = 'task_cards_tenant_rls';

// Migration 608 predicate (workpack root only).
const OLD_PREDICATE = `EXISTS (SELECT 1 FROM public.workpack_tasks wt
      JOIN public.workpacks w ON w.id = wt.workpack_id
      WHERE wt.task_id = task_cards.id AND w.tenant_id = ${CTX})`;

// Hybrid predicate: workpack root AND aircraft tenant consistency (defence-in-depth).
const NEW_PREDICATE = `EXISTS (SELECT 1 FROM public.workpack_tasks wt
      JOIN public.workpacks w ON w.id = wt.workpack_id
      WHERE wt.task_id = task_cards.id AND w.tenant_id = ${CTX})
   AND EXISTS (SELECT 1 FROM public.aircraft a
      WHERE a.id = task_cards.aircraft_id AND a.tenant_id = ${CTX})`;

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DROP POLICY IF EXISTS ${POLICY} ON public.task_cards;
         CREATE POLICY ${POLICY} ON public.task_cards
           FOR ALL
           USING (${NEW_PREDICATE})
           WITH CHECK (${NEW_PREDICATE});`,
        { transaction }
      );
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DROP POLICY IF EXISTS ${POLICY} ON public.task_cards;
         CREATE POLICY ${POLICY} ON public.task_cards
           FOR ALL
           USING (${OLD_PREDICATE})
           WITH CHECK (${OLD_PREDICATE});`,
        { transaction }
      );
    });
  },
};
