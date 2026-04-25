'use strict';

export default {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      -- ============================================================
      -- REMOVE CASCADE DELETE FROM maintenance_requirements.model_id
      -- Replace ON DELETE CASCADE with ON DELETE RESTRICT
      -- ============================================================

      DO $$
      DECLARE
          constraint_name text;
      BEGIN
          -- Locate existing FK constraint
          SELECT tc.constraint_name
          INTO constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'maintenance_requirements'
            AND kcu.column_name = 'model_id'
            AND tc.constraint_type = 'FOREIGN KEY';

          -- Drop existing constraint if found
          IF constraint_name IS NOT NULL THEN
              EXECUTE format(
                  'ALTER TABLE maintenance_requirements DROP CONSTRAINT %I',
                  constraint_name
              );
          END IF;

          -- Recreate FK with RESTRICT
          ALTER TABLE maintenance_requirements
          ADD CONSTRAINT maintenance_requirements_model_id_fk
          FOREIGN KEY (model_id)
          REFERENCES component_models(id)
          ON DELETE RESTRICT;
      END
      $$;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      -- ============================================================
      -- Rollback: restore CASCADE behavior
      -- ============================================================

      DO $$
      DECLARE
          constraint_name text;
      BEGIN
          -- Find current constraint
          SELECT tc.constraint_name
          INTO constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'maintenance_requirements'
            AND kcu.column_name = 'model_id'
            AND tc.constraint_type = 'FOREIGN KEY';

          -- Drop current constraint
          IF constraint_name IS NOT NULL THEN
              EXECUTE format(
                  'ALTER TABLE maintenance_requirements DROP CONSTRAINT %I',
                  constraint_name
              );
          END IF;

          -- Restore CASCADE
          ALTER TABLE maintenance_requirements
          ADD CONSTRAINT maintenance_requirements_model_id_fk
          FOREIGN KEY (model_id)
          REFERENCES component_models(id)
          ON DELETE CASCADE;
      END
      $$;
    `);
  },
};