'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

// Add the supporting index for the task_cards RLS predicate `tenant_id = CTX`
// introduced by migration 615/616. The composite FK on (aircraft_id, tenant_id)
// does not auto-index the referencing columns, so a tenant_id index is required
// for the direct-custody RLS predicate to avoid a full sequential scan.

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS task_cards_tenant_id ON public.task_cards (tenant_id);`,
        { transaction },
      );
      const [verified] = await queryInterface.sequelize.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_indexes WHERE tablename = 'task_cards' AND indexname = 'task_cards_tenant_id'`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (!verified || verified.n !== 1) {
        throw new Error('TENANT_TASK_CARD_TENANT_ID_INDEX_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS public.task_cards_tenant_id;`, { transaction });
    });
  },
};
