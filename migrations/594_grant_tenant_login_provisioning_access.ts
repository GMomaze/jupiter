import type { QueryInterface } from 'sequelize';

const TABLES = [
  'tenants',
  'tenant_memberships',
  'tenant_context_switch_attempts',
] as const;

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      for (const table of TABLES) {
        const [rows] = await queryInterface.sequelize.query(
          `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
          { transaction },
        ) as [{ present: boolean }[], unknown];
        if (!rows[0]?.present) {
          throw new Error(`MIGRATION_594_PREREQUISITE_MISSING:${table}`);
        }
      }

      await queryInterface.sequelize.query(
        `GRANT SELECT ON TABLE public.tenants TO jupiter_app;
         GRANT SELECT ON TABLE public.tenant_memberships TO jupiter_app;
         GRANT INSERT, UPDATE ON TABLE public.tenant_context_switch_attempts TO jupiter_app;`,
        { transaction },
      );
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(
        `REVOKE INSERT, UPDATE ON TABLE public.tenant_context_switch_attempts FROM jupiter_app;
         REVOKE SELECT ON TABLE public.tenant_memberships FROM jupiter_app;
         REVOKE SELECT ON TABLE public.tenants FROM jupiter_app;`,
        { transaction },
      );
    });
  },
};
