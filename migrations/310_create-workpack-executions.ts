'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'workpack_executions';
    const exists = await tableExists(queryInterface, table);

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

        attempt_no: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },

        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'OPEN',
        },

        started_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },

        completed_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },

        certified_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },

        started_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },

        completed_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },

        certified_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },

        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },

        failure_reason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },

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
      });
    }

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_executions_workpack_task_attempt_unique'
        ) THEN
          ALTER TABLE workpack_executions
          ADD CONSTRAINT workpack_executions_workpack_task_attempt_unique
          UNIQUE (workpack_id, task_id, attempt_no);
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_executions_status_check'
        ) THEN
          ALTER TABLE workpack_executions
          ADD CONSTRAINT workpack_executions_status_check
          CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED_BY_MECHANIC', 'CERTIFIED_BY_ENGINEER'));
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_executions_workpack_id_idx
      ON workpack_executions (workpack_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_executions_task_id_idx
      ON workpack_executions (task_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_executions_status_idx
      ON workpack_executions (status);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_executions_started_by_idx
      ON workpack_executions (started_by);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_executions_completed_by_idx
      ON workpack_executions (completed_by);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_executions_certified_by_idx
      ON workpack_executions (certified_by);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_executions_created_at_idx
      ON workpack_executions (created_at);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workpack_executions').catch(() => {});
  },
};
