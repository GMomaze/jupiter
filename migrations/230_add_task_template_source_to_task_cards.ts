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

    const hasTemplateSourceId = await columnExists(
      queryInterface,
      'task_cards',
      'template_source_id'
    );

    if (!hasTemplateSourceId) {
      await queryInterface.addColumn('task_cards', 'template_source_id', {
        type: Sequelize.UUID,
        references: {
          model: 'task_templates',
          key: 'id',
        },
        onDelete: 'SET NULL',
      });
    }
  },

  down: async (queryInterface) => {
    const hasTaskCards = await tableExists(queryInterface, 'task_cards');

    if (!hasTaskCards) return;

    const hasTemplateSourceId = await columnExists(
      queryInterface,
      'task_cards',
      'template_source_id'
    );

    if (hasTemplateSourceId) {
      await queryInterface.removeColumn('task_cards', 'template_source_id');
    }
  },
};