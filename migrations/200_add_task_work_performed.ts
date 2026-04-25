'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

async function columnExists(queryInterface, table, column) {
  const def = await queryInterface.describeTable(table).catch(() => null);
  return def && def[column];
}

export default {
  up: async (queryInterface, Sequelize) => {
    const hasTaskCards = await tableExists(queryInterface, 'task_cards');

    if (!hasTaskCards) return;

    const hasWorkPerformed = await columnExists(
      queryInterface,
      'task_cards',
      'work_performed'
    );

    if (!hasWorkPerformed) {
      await queryInterface.addColumn('task_cards', 'work_performed', {
        type: Sequelize.TEXT,
      });
    }
  },

  down: async (queryInterface) => {
    const hasTaskCards = await tableExists(queryInterface, 'task_cards');

    if (!hasTaskCards) return;

    const hasWorkPerformed = await columnExists(
      queryInterface,
      'task_cards',
      'work_performed'
    );

    if (hasWorkPerformed) {
      await queryInterface.removeColumn('task_cards', 'work_performed');
    }
  },
};