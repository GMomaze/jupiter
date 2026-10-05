'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

// Repair the `customers` and `customer_users` RLS residue: the superseded 4.4
// proof-of-concept test's teardown called `DISABLE ROW LEVEL SECURITY` on these
// two direct/indirect roots, leaving their (correct) `_tenant_rls` policies
// ineffective. Re-enable + FORCE RLS so the defence-in-depth boundary is intact
// again. The policies themselves were already correct and are left unchanged.

const TABLES = ['customers', 'customer_users'] as const;

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const t of TABLES) {
        await queryInterface.sequelize.query(
          `ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY; ALTER TABLE public.${t} FORCE ROW LEVEL SECURITY;`,
          { transaction },
        );
      }
      const [verified] = await queryInterface.sequelize.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_class c
          WHERE c.relname IN ('customers','customer_users')
            AND c.relrowsecurity AND c.relforcerowsecurity`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (!verified || verified.n !== 2) {
        throw new Error('TENANT_CUSTOMER_RLS_REENABLE_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const t of TABLES) {
        await queryInterface.sequelize.query(
          `ALTER TABLE public.${t} NO FORCE ROW LEVEL SECURITY; ALTER TABLE public.${t} DISABLE ROW LEVEL SECURITY;`,
          { transaction },
        );
      }
    });
  },
};
