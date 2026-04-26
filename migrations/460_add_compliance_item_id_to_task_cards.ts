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

    if (!(await columnExists(queryInterface, table, 'compliance_item_id'))) {
      await queryInterface.addColumn(table, 'compliance_item_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'compliance_items',
          key: 'id',
        },
        onUpdate: 'NO ACTION',
        onDelete: 'SET NULL',
      });
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS task_cards_compliance_item_id_idx
      ON task_cards (compliance_item_id);
    `);
  },

  async down(queryInterface) {
    const table = 'task_cards';

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS task_cards_compliance_item_id_idx;
    `);

    await queryInterface.removeColumn(table, 'compliance_item_id').catch(() => {});
  },
};
