'use strict';

async function tableExists(queryInterface, table: string) {
  return await queryInterface.describeTable(table).catch(() => null);
}

async function columnExists(queryInterface, table: string, column: string) {
  const def = await queryInterface.describeTable(table).catch(() => null);
  return Boolean(def && def[column]);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'task_templates';
    if (!(await tableExists(queryInterface, table))) return;

    const flags = [
      'is_required_for_wood',
      'is_required_for_fabric',
      'is_required_for_bungees',
      'is_required_for_woodprop',
      'is_required_for_retractable',
    ];

    for (const flag of flags) {
      if (!(await columnExists(queryInterface, table, flag))) {
        await queryInterface.addColumn(table, flag, {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        });
      }
    }
  },

  async down(queryInterface) {
    const table = 'task_templates';
    const flags = [
      'is_required_for_wood',
      'is_required_for_fabric',
      'is_required_for_bungees',
      'is_required_for_woodprop',
      'is_required_for_retractable',
    ];

    for (const flag of flags) {
      await queryInterface.removeColumn(table, flag).catch(() => {});
    }
  },
};
