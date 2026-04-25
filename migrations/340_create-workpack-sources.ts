'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'workpack_sources';
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

        source_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        reference: {
          type: Sequelize.STRING,
          allowNull: false,
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
    // UNIQUE CONSTRAINT (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_sources_execution_id_source_type_reference_unique'
        ) THEN
          ALTER TABLE workpack_sources
          ADD CONSTRAINT workpack_sources_execution_id_source_type_reference_unique
          UNIQUE (execution_id, source_type, reference);
        END IF;
      END
      $$;
    `);

    // =========================================
    // CHECK CONSTRAINT (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_sources_type_check'
        ) THEN
          ALTER TABLE workpack_sources
          ADD CONSTRAINT workpack_sources_type_check
          CHECK (source_type IN ('AD', 'SB'));
        END IF;
      END
      $$;
    `);

    // =========================================
    // INDEXES (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_sources_execution_id_index
      ON workpack_sources (execution_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_sources_reference_index
      ON workpack_sources (reference);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_sources_source_type_index
      ON workpack_sources (source_type);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workpack_sources').catch(() => {});
  },
};