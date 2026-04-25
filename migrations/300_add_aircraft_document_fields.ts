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
    const table = 'aircraft';
    if (!(await tableExists(queryInterface, table))) return;

    const columns = [
      {
        name: 'loaded_into_system_at',
        definition: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
      },
      {
        name: 'manufacture_date',
        definition: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
      },
      {
        name: 'tcds_number',
        definition: {
          type: Sequelize.STRING,
          allowNull: true,
        },
      },
      {
        name: 'tcds_url',
        definition: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
      },
      {
        name: 'photo_url',
        definition: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
      },
    ];

    for (const column of columns) {
      if (!(await columnExists(queryInterface, table, column.name))) {
        await queryInterface.addColumn(table, column.name, column.definition);
      }
    }
  },

  async down(queryInterface) {
    const table = 'aircraft';
    const columns = [
      'photo_url',
      'tcds_url',
      'tcds_number',
      'manufacture_date',
      'loaded_into_system_at',
    ];

    for (const column of columns) {
      await queryInterface.removeColumn(table, column).catch(() => {});
    }
  },
};
