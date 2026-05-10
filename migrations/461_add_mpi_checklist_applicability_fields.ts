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
    const taskTemplatesTable = 'task_templates';
    if (!(await tableExists(queryInterface, taskTemplatesTable))) return;
    return;
  },

  async down(queryInterface) {
    const taskTemplatesTable = 'task_templates';
    if (!(await tableExists(queryInterface, taskTemplatesTable))) return;
    return;
  },
};
