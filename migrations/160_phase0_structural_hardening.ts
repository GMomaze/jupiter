'use strict';

export default {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      -- ============================================================
      -- 0.0 CLEAN INVALID manufacturer_id REFERENCES
      -- ============================================================

      INSERT INTO manufacturers (id, name, code, description, is_active, created_at, updated_at)
      SELECT
        gen_random_uuid(),
        'Unknown Manufacturer',
        'UNKNOWN',
        'Fallback manufacturer created by migration 230',
        true,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
        SELECT 1 FROM manufacturers WHERE code = 'UNKNOWN'
      );

      UPDATE component_models cm
      SET manufacturer_id = (
        SELECT id FROM manufacturers WHERE code = 'UNKNOWN' LIMIT 1
      )
      WHERE manufacturer_id IS NULL
         OR NOT EXISTS (
          SELECT 1 FROM manufacturers m
          WHERE m.id = cm.manufacturer_id
        );

      -- ============================================================
      -- 0.1 ENSURE FK: component_models.asset_type_id → rf_asset_type(id)
      -- ============================================================

      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.table_constraints
              WHERE constraint_name = 'component_models_asset_type_fk'
          ) THEN
              ALTER TABLE component_models
              ADD CONSTRAINT component_models_asset_type_fk
              FOREIGN KEY (asset_type_id)
              REFERENCES rf_asset_type(id)
              ON DELETE RESTRICT;
          END IF;
      END
      $$;

      -- ============================================================
      -- 0.2 FIX manufacturer FK SAFELY
      -- ============================================================

      DO $$
      DECLARE
          constraint_name text;
      BEGIN
          SELECT tc.constraint_name
          INTO constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'component_models'
            AND kcu.column_name = 'manufacturer_id'
            AND tc.constraint_type = 'FOREIGN KEY';

          IF constraint_name IS NOT NULL THEN
              EXECUTE format('ALTER TABLE component_models DROP CONSTRAINT %I', constraint_name);
          END IF;

          ALTER TABLE component_models
          ADD CONSTRAINT component_models_manufacturer_fk
          FOREIGN KEY (manufacturer_id)
          REFERENCES manufacturers(id)
          ON DELETE RESTRICT;
      END
      $$;

      -- ============================================================
      -- 0.3 ADD LIFECYCLE COLUMN
      -- ============================================================

      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'component_models'
                AND column_name = 'is_active'
          ) THEN
              ALTER TABLE component_models
              ADD COLUMN is_active boolean DEFAULT true;
          END IF;
      END
      $$;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE component_models
      DROP COLUMN IF EXISTS is_active;

      ALTER TABLE component_models
      DROP CONSTRAINT IF EXISTS component_models_asset_type_fk;

      ALTER TABLE component_models
      DROP CONSTRAINT IF EXISTS component_models_manufacturer_fk;
    `);
  },
};