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
    return;
  },

  async down(queryInterface) {
    const table = 'task_templates';
    if (!(await tableExists(queryInterface, table))) return;
    return;
  },
};
