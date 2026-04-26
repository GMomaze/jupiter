'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'workpack_compliance';
    const exists = await tableExists(queryInterface, table);

    if (exists) {
      return;
    }

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

      compliance_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'compliance_items',
          key: 'id',
        },
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },

      task_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'task_cards',
          key: 'id',
        },
        onUpdate: 'NO ACTION',
        onDelete: 'SET NULL',
      },

      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'PLANNED',
      },

      linked_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },

      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      notes: {
        type: Sequelize.TEXT,
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

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_compliance_workpack_item_unique'
        ) THEN
          ALTER TABLE workpack_compliance
          ADD CONSTRAINT workpack_compliance_workpack_item_unique
          UNIQUE (workpack_id, compliance_item_id);
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_compliance_status_check'
        ) THEN
          ALTER TABLE workpack_compliance
          ADD CONSTRAINT workpack_compliance_status_check
          CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_compliance_workpack_id_index
      ON workpack_compliance (workpack_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_compliance_compliance_item_id_index
      ON workpack_compliance (compliance_item_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_compliance_task_id_index
      ON workpack_compliance (task_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_compliance_status_index
      ON workpack_compliance (status);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workpack_compliance').catch(() => {});
  },
};
