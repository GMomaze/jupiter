'use strict';

async function columnExists(queryInterface, table, column) {
  const definition = await queryInterface.describeTable(table).catch(() => null);
  return Boolean(definition && definition[column]);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'manufacturers';

    if (!(await columnExists(queryInterface, table, 'current_owner'))) {
      await queryInterface.addColumn(table, 'current_owner', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, table, 'is_operational'))) {
      await queryInterface.addColumn(table, 'is_operational', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      });
    }

    if (!(await columnExists(queryInterface, table, 'support_email'))) {
      await queryInterface.addColumn(table, 'support_email', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, table, 'support_phone'))) {
      await queryInterface.addColumn(table, 'support_phone', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, table, 'notes'))) {
      await queryInterface.addColumn(table, 'notes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = 'manufacturers';

    if (await columnExists(queryInterface, table, 'notes')) {
      await queryInterface.removeColumn(table, 'notes');
    }

    if (await columnExists(queryInterface, table, 'support_phone')) {
      await queryInterface.removeColumn(table, 'support_phone');
    }

    if (await columnExists(queryInterface, table, 'support_email')) {
      await queryInterface.removeColumn(table, 'support_email');
    }

    if (await columnExists(queryInterface, table, 'is_operational')) {
      await queryInterface.removeColumn(table, 'is_operational');
    }

    if (await columnExists(queryInterface, table, 'current_owner')) {
      await queryInterface.removeColumn(table, 'current_owner');
    }
  },
};
