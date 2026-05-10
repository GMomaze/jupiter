'use strict';

async function tableExists(queryInterface, tableName) {
  return await queryInterface.describeTable(tableName).catch(() => null);
}

export default {
  async up(queryInterface) {
    const hasStatusTable = await tableExists(queryInterface, 'rf_workpack_status');

    if (!hasStatusTable) {
      return;
    }

    await queryInterface.sequelize.query(
      `
        INSERT INTO rf_workpack_status (
          code,
          label,
          description,
          is_active,
          system_locked,
          created_at
        )
        VALUES (
          'CLOSED',
          'Closed',
          'Final administrative workpack close completed',
          TRUE,
          FALSE,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (code) DO NOTHING;
      `,
      { raw: true }
    );
  },

  async down() {
    // Intentionally no-op to avoid deleting reference data once introduced.
  },
};
