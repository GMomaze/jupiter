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

    if (!(await columnExists(queryInterface, table, 'source_type'))) {
      await queryInterface.addColumn(table, 'source_type', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, table, 'interval_hours'))) {
      await queryInterface.addColumn(table, 'interval_hours', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, table, 'interval_months'))) {
      await queryInterface.addColumn(table, 'interval_months', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, table, 'model_applicability'))) {
      await queryInterface.addColumn(table, 'model_applicability', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, table, 'aircraft_applicability'))) {
      await queryInterface.addColumn(table, 'aircraft_applicability', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = 'task_templates';
    if (!(await tableExists(queryInterface, table))) return;

    if (await columnExists(queryInterface, table, 'aircraft_applicability')) {
      await queryInterface.removeColumn(table, 'aircraft_applicability');
    }

    if (await columnExists(queryInterface, table, 'model_applicability')) {
      await queryInterface.removeColumn(table, 'model_applicability');
    }

    if (await columnExists(queryInterface, table, 'interval_months')) {
      await queryInterface.removeColumn(table, 'interval_months');
    }

    if (await columnExists(queryInterface, table, 'interval_hours')) {
      await queryInterface.removeColumn(table, 'interval_hours');
    }

    if (await columnExists(queryInterface, table, 'source_type')) {
      await queryInterface.removeColumn(table, 'source_type');
    }
  },
};
