'use strict';

async function tableExists(queryInterface, tableName) {
  return await queryInterface.describeTable(tableName).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const hasStatusTable = await tableExists(queryInterface, 'rf_workpack_status');

    if (!hasStatusTable) {
      return;
    }

    await queryInterface.sequelize.query(
      `
        INSERT INTO rf_workpack_status (
          id,
          code,
          label,
          description,
          is_active,
          system_locked,
          created_at
        )
        SELECT
          gen_random_uuid(),
          'CLOSED',
          'Closed',
          'Final administrative workpack close completed',
          TRUE,
          FALSE,
          CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
          SELECT 1
          FROM rf_workpack_status
          WHERE code = 'CLOSED'
        );
      `,
      { raw: true }
    );
  },

  async down() {
    // Intentionally no-op to avoid deleting reference data once introduced.
  },
};
