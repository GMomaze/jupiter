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

    // =========================================
    // 1. ADD model_code (SAFE)
    // =========================================
    const hasModels = await tableExists(queryInterface, 'component_models');

    if (hasModels) {
      if (!(await columnExists(queryInterface, 'component_models', 'model_code'))) {
        await queryInterface.addColumn('component_models', 'model_code', {
          type: Sequelize.STRING(100),
          allowNull: true,
        });
      }
    }

    // =========================================
    // 2. INDEXES (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS component_models_manufacturer_id_idx
      ON component_models (manufacturer_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS component_models_model_name_idx
      ON component_models (model_name);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS manufacturers_name_idx
      ON manufacturers (name);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS manufacturers_code_idx
      ON manufacturers (code);
    `);

    // =========================================
    // 3. NORMALIZE MANUFACTURER CODES
    // =========================================
    await queryInterface.sequelize.query(`
      UPDATE manufacturers
      SET code = UPPER(code)
      WHERE code IS NOT NULL;
    `);

    // =========================================
    // 4. NORMALIZE MODEL CODES
    // =========================================
    await queryInterface.sequelize.query(`
      UPDATE component_models
      SET model_code = UPPER(model_code)
      WHERE model_code IS NOT NULL;
    `);
  },

  async down(queryInterface) {

    // SAFE index drops
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS component_models_manufacturer_id_idx;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS component_models_model_name_idx;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS manufacturers_name_idx;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS manufacturers_code_idx;
    `);

    // SAFE column drop
    await queryInterface.removeColumn('component_models', 'model_code').catch(() => {});
  },
};