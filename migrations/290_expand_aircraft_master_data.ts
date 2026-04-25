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
    const table = 'aircraft';

    const def = await tableExists(queryInterface, table);
    if (!def) return;

    // =========================================
    // 1. OWNER / OPERATOR
    // =========================================
    if (!(await columnExists(queryInterface, table, 'owner_name'))) {
      await queryInterface.addColumn(table, 'owner_name', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, table, 'operator_name'))) {
      await queryInterface.addColumn(table, 'operator_name', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // =========================================
    // 2. STATUS FLAGS
    // =========================================
    if (!(await columnExists(queryInterface, table, 'is_active'))) {
      await queryInterface.addColumn(table, 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    if (!(await columnExists(queryInterface, table, 'is_airworthy'))) {
      await queryInterface.addColumn(table, 'is_airworthy', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    // =========================================
    // 3. NOTES
    // =========================================
    if (!(await columnExists(queryInterface, table, 'notes'))) {
      await queryInterface.addColumn(table, 'notes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    // =========================================
    // 4. INDEXES (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS aircraft_model_id_idx
      ON aircraft (model_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS aircraft_status_idx
      ON aircraft (status);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS aircraft_is_active_idx
      ON aircraft (is_active);
    `);
  },

  async down(queryInterface) {
    const table = 'aircraft';

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS aircraft_model_id_idx;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS aircraft_status_idx;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS aircraft_is_active_idx;
    `);

    await queryInterface.removeColumn(table, 'notes').catch(() => {});
    await queryInterface.removeColumn(table, 'is_airworthy').catch(() => {});
    await queryInterface.removeColumn(table, 'is_active').catch(() => {});
    await queryInterface.removeColumn(table, 'operator_name').catch(() => {});
    await queryInterface.removeColumn(table, 'owner_name').catch(() => {});
  },
};