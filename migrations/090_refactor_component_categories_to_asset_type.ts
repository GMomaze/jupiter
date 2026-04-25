'use strict';

async function tableExists(queryInterface, tableName) {
  return await queryInterface.describeTable(tableName).catch(() => null);
}

export default {
  up: async (queryInterface) => {
    const hasAssetType = await tableExists(queryInterface, 'rf_asset_type');
    const hasOldTable = await tableExists(queryInterface, 'rf_component_categories');

    // 🔥 ONLY run rename if old system exists and new one does not
    if (!hasAssetType && hasOldTable) {
      await queryInterface.renameTable(
        'rf_component_categories',
        'rf_asset_type'
      );

      // Rename indexes safely
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_class WHERE relname = 'rf_component_categories_pkey'
          ) THEN
            ALTER INDEX rf_component_categories_pkey RENAME TO rf_asset_type_pkey;
          END IF;
        END
        $$;
      `);

      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_class WHERE relname = 'rf_component_categories_code_key'
          ) THEN
            ALTER INDEX rf_component_categories_code_key RENAME TO rf_asset_type_code_key;
          END IF;
        END
        $$;
      `);

      // Fix FK
      await queryInterface.sequelize.query(`
        ALTER TABLE component_models
        DROP CONSTRAINT IF EXISTS component_models_category_id_fkey;
      `);

      await queryInterface.sequelize.query(`
        ALTER TABLE component_models
        ADD CONSTRAINT component_models_asset_type_id_fkey
        FOREIGN KEY (category_id)
        REFERENCES rf_asset_type(id);
      `);
    }
  },

  down: async (queryInterface) => {
    const hasAssetType = await tableExists(queryInterface, 'rf_asset_type');
    const hasOldTable = await tableExists(queryInterface, 'rf_component_categories');

    // 🔥 ONLY rollback if rename actually happened
    if (hasAssetType && !hasOldTable) {
      await queryInterface.sequelize.query(`
        ALTER TABLE component_models
        DROP CONSTRAINT IF EXISTS component_models_asset_type_id_fkey;
      `);

      await queryInterface.renameTable(
        'rf_asset_type',
        'rf_component_categories'
      );

      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_class WHERE relname = 'rf_asset_type_pkey'
          ) THEN
            ALTER INDEX rf_asset_type_pkey RENAME TO rf_component_categories_pkey;
          END IF;
        END
        $$;
      `);

      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_class WHERE relname = 'rf_asset_type_code_key'
          ) THEN
            ALTER INDEX rf_asset_type_code_key RENAME TO rf_component_categories_code_key;
          END IF;
        END
        $$;
      `);

      await queryInterface.sequelize.query(`
        ALTER TABLE component_models
        ADD CONSTRAINT component_models_category_id_fkey
        FOREIGN KEY (category_id)
        REFERENCES rf_component_categories(id);
      `);
    }
  },
};