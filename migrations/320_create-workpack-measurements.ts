'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {

    const table = 'workpack_measurements';
    const exists = await tableExists(queryInterface, table);

    // =========================================
    // CREATE TABLE (SAFE)
    // =========================================
    if (!exists) {
      await queryInterface.createTable(table, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        execution_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'workpack_executions',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },

        field_key: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        field_label: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        position: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },

        value: {
          type: Sequelize.STRING,
          allowNull: true,
        },

        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },

        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    // =========================================
    // UNIQUE CONSTRAINTS (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_measurements_execution_id_field_key_unique'
        ) THEN
          ALTER TABLE workpack_measurements
          ADD CONSTRAINT workpack_measurements_execution_id_field_key_unique
          UNIQUE (execution_id, field_key);
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_measurements_execution_id_position_unique'
        ) THEN
          ALTER TABLE workpack_measurements
          ADD CONSTRAINT workpack_measurements_execution_id_position_unique
          UNIQUE (execution_id, position);
        END IF;
      END
      $$;
    `);

    // =========================================
    // INDEXES (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_measurements_execution_id_index
      ON workpack_measurements (execution_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_measurements_field_key_index
      ON workpack_measurements (field_key);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_measurements_position_index
      ON workpack_measurements (position);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workpack_measurements').catch(() => {});
  },
};