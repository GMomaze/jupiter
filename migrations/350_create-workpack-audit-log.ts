'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'workpack_audit_log';
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

        workpack_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'workpacks',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },

        task_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'task_cards',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },

        user_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },

        action: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        field: {
          type: Sequelize.STRING,
          allowNull: true,
        },

        old_value: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: null,
        },

        new_value: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: null,
        },

        metadata: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        },

        hash: {
          type: Sequelize.TEXT,
          allowNull: false,
        },

        previous_hash: {
          type: Sequelize.TEXT,
          allowNull: false,
          defaultValue: '',
        },

        sequence: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },

        created_at: {
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
          WHERE constraint_name = 'workpack_audit_log_execution_sequence_unique'
        ) THEN
          ALTER TABLE workpack_audit_log
          ADD CONSTRAINT workpack_audit_log_execution_sequence_unique
          UNIQUE (execution_id, sequence);
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_audit_log_hash_unique'
        ) THEN
          ALTER TABLE workpack_audit_log
          ADD CONSTRAINT workpack_audit_log_hash_unique
          UNIQUE (hash);
        END IF;
      END
      $$;
    `);

    // =========================================
    // INDEXES (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_audit_log_action_index
      ON workpack_audit_log (action);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_audit_log_execution_id_index
      ON workpack_audit_log (execution_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_audit_log_sequence_index
      ON workpack_audit_log (sequence);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workpack_audit_log').catch(() => {});
  },
};