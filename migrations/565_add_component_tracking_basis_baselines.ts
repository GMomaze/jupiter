'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName).catch(() => null);
  return Boolean(table?.[columnName]);
}

async function addColumnIfMissing(queryInterface, Sequelize, tableName, columnName, definition) {
  if (!(await columnExists(queryInterface, tableName, columnName))) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

async function removeColumnIfExists(queryInterface, tableName, columnName) {
  if (await columnExists(queryInterface, tableName, columnName)) {
    await queryInterface.removeColumn(tableName, columnName);
  }
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'aircraft_component_installations';

    await addColumnIfMissing(queryInterface, Sequelize, table, 'tracking_basis', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, table, 'install_aircraft_hours', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, table, 'install_aircraft_cycles', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, table, 'install_csn', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, table, 'install_cso', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, table, 'removal_aircraft_hours', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, table, 'removal_aircraft_cycles', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, table, 'removal_csn', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, table, 'removal_cso', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS aircraft_component_installations_tracking_basis_index
      ON ${table} (tracking_basis);
    `);
  },

  async down(queryInterface) {
    const table = 'aircraft_component_installations';

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS aircraft_component_installations_tracking_basis_index;
    `);

    await removeColumnIfExists(queryInterface, table, 'removal_cso');
    await removeColumnIfExists(queryInterface, table, 'removal_csn');
    await removeColumnIfExists(queryInterface, table, 'removal_aircraft_cycles');
    await removeColumnIfExists(queryInterface, table, 'removal_aircraft_hours');
    await removeColumnIfExists(queryInterface, table, 'install_cso');
    await removeColumnIfExists(queryInterface, table, 'install_csn');
    await removeColumnIfExists(queryInterface, table, 'install_aircraft_cycles');
    await removeColumnIfExists(queryInterface, table, 'install_aircraft_hours');
    await removeColumnIfExists(queryInterface, table, 'tracking_basis');
  },
};
