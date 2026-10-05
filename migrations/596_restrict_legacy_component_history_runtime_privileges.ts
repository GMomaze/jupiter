import type { QueryInterface } from 'sequelize';

const TABLE = 'aircraft_component_movement_history';

export default {
  async up(queryInterface: QueryInterface) {
    if (!await queryInterface.describeTable(TABLE).catch(() => null)) {
      throw new Error('MIGRATION_596_HISTORY_TABLE_REQUIRED');
    }
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(
        `REVOKE UPDATE, DELETE ON TABLE public.${TABLE} FROM jupiter_app, jupiter_test;
         GRANT SELECT, INSERT ON TABLE public.${TABLE} TO jupiter_app, jupiter_test;`,
        { transaction },
      );
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(
        `GRANT UPDATE, DELETE ON TABLE public.${TABLE} TO jupiter_app, jupiter_test;`,
        { transaction },
      );
    });
  },
};
