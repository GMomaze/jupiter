'use strict';

async function columnExists(queryInterface, table, column) {
  const def = await queryInterface.describeTable(table).catch(() => null);
  return def && def[column];
}

export default {
  up: async (queryInterface, Sequelize) => {
    const table = 'aircraft';

    const hasVersion = await columnExists(queryInterface, table, 'version');
    const hasModelId = await columnExists(queryInterface, table, 'model_id');
    const hasModel = await columnExists(queryInterface, table, 'model');

    // =========================================
    // 1. ADD VERSION COLUMN
    // =========================================
    if (!hasVersion) {
      await queryInterface.addColumn(table, 'version', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    // =========================================
    // 2. ENSURE model_id COLUMN EXISTS
    // =========================================
    if (!hasModelId) {
      await queryInterface.addColumn(table, 'model_id', {
        type: Sequelize.UUID,
        allowNull: false,
      });
    }

    // =========================================
    // 3. DROP ANY EXISTING FK ON model_id (DEFENSIVE)
    // =========================================
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE
          constraint_name text;
      BEGIN
          SELECT tc.constraint_name
          INTO constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'aircraft'
            AND kcu.column_name = 'model_id'
            AND tc.constraint_type = 'FOREIGN KEY'
          LIMIT 1;

          IF constraint_name IS NOT NULL THEN
            EXECUTE format(
              'ALTER TABLE aircraft DROP CONSTRAINT %I',
              constraint_name
            );
          END IF;
      END
      $$;
    `);

    // =========================================
    // 4. ENFORCE COLUMN (NO FK YET)
    // =========================================
    await queryInterface.changeColumn(table, 'model_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    // =========================================
    // 5. ADD SINGLE CLEAN FK
    // =========================================
    await queryInterface.sequelize.query(`
      ALTER TABLE aircraft
      ADD CONSTRAINT aircraft_model_id_fk
      FOREIGN KEY (model_id)
      REFERENCES component_models(id)
      ON DELETE RESTRICT;
    `);

    // =========================================
    // 6. DROP LEGACY COLUMN
    // =========================================
    if (hasModel) {
      await queryInterface.removeColumn(table, 'model');
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = 'aircraft';

    // =========================================
    // 1. RESTORE LEGACY COLUMN
    // =========================================
    const hasModel = await columnExists(queryInterface, table, 'model');

    if (!hasModel) {
      await queryInterface.addColumn(table, 'model', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // =========================================
    // 2. DROP FK SAFELY
    // =========================================
    await queryInterface.sequelize.query(`
      ALTER TABLE aircraft
      DROP CONSTRAINT IF EXISTS aircraft_model_id_fk;
    `);

    // =========================================
    // 3. RELAX model_id COLUMN
    // =========================================
    const hasModelId = await columnExists(queryInterface, table, 'model_id');

    if (hasModelId) {
      await queryInterface.changeColumn(table, 'model_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    // =========================================
    // 4. REMOVE VERSION COLUMN
    // =========================================
    const hasVersion = await columnExists(queryInterface, table, 'version');

    if (hasVersion) {
      await queryInterface.removeColumn(table, 'version');
    }
  },
};