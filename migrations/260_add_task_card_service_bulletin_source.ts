'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

async function columnExists(queryInterface, table, column) {
  const def = await queryInterface.describeTable(table).catch(() => null);
  return def && def[column];
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'task_cards';

    const exists = await tableExists(queryInterface, table);
    if (!exists) return;

    // =========================================
    // COLUMN
    // =========================================
    if (!(await columnExists(queryInterface, table, 'service_bulletin_id'))) {
      await queryInterface.addColumn(table, 'service_bulletin_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'service_bulletins',
          key: 'id',
        },
        onUpdate: 'NO ACTION',
        onDelete: 'SET NULL',
      });
    }

    // =========================================
    // INDEX (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS task_cards_service_bulletin_id_idx
      ON task_cards (service_bulletin_id);
    `);
  },

  async down(queryInterface) {
    const table = 'task_cards';

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS task_cards_service_bulletin_id_idx;
    `);

    await queryInterface.removeColumn(table, 'service_bulletin_id').catch(() => {});
  },
};