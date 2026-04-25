'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'workpack_snags';
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

        workpack_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'workpacks',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },

        description: {
          type: Sequelize.TEXT,
          allowNull: false,
        },

        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'OPEN',
        },

        resolution: Sequelize.TEXT,

        reported_by: {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },

        started_by: {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },

        completed_by: {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },

        reported_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },

        started_at: Sequelize.DATE,
        completed_at: Sequelize.DATE,

        version: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
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

        assigned_to: {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },

        resolved_by: {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },

        resolved_at: Sequelize.DATE,

        closed_by: {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },

        closed_at: Sequelize.DATE,

        resolution_notes: Sequelize.TEXT,

        created_by: {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },

        category: Sequelize.STRING,

        priority: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'MEDIUM',
        },

        parts_used: Sequelize.TEXT,
        time_spent_minutes: Sequelize.INTEGER,

        snag_no: {
          type: Sequelize.INTEGER,
          allowNull: false,
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
          WHERE constraint_name = 'workpack_snags_workpack_id_snag_no_unique'
        ) THEN
          ALTER TABLE workpack_snags
          ADD CONSTRAINT workpack_snags_workpack_id_snag_no_unique
          UNIQUE (workpack_id, snag_no);
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
          WHERE constraint_name = 'workpack_snags_status_check'
        ) THEN
          ALTER TABLE workpack_snags
          ADD CONSTRAINT workpack_snags_status_check
          CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'));
        END IF;
      END
      $$;
    `);

    // =========================================
    // INDEXES (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_snags_completed_by_index
      ON workpack_snags (completed_by);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_snags_reported_by_index
      ON workpack_snags (reported_by);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_snags_started_by_index
      ON workpack_snags (started_by);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_snags_status_index
      ON workpack_snags (status);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_snags_workpack_id_index
      ON workpack_snags (workpack_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workpack_snags').catch(() => {});
  },
};