'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  up: async (queryInterface, Sequelize) => {

    // =========================================
    // CREATE TABLE (SAFE)
    // =========================================
    const exists = await tableExists(queryInterface, 'task_cards');

    if (!exists) {
      await queryInterface.createTable('task_cards', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        // ✅ FIX: ADD THIS
        task_card_number: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        title: {
          type: Sequelize.STRING,
          allowNull: false,
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

        aircraft_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'aircraft',
            key: 'id',
          },
        },

        assigned_to: {
          type: Sequelize.UUID,
          references: {
            model: 'users',
            key: 'id',
          },
        },

        component_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },

        signed_by: {
          type: Sequelize.UUID,
          references: {
            model: 'users',
            key: 'id',
          },
        },

        signed_at: Sequelize.DATE,

        signature_snapshot_url: Sequelize.TEXT,

        work_performed: Sequelize.TEXT,

        // 🔧 keep future fields consistent with model
        mechanic_completed_by: {
          type: Sequelize.UUID,
          allowNull: true,
        },

        mechanic_completed_at: Sequelize.DATE,

        engineer_certified_by: {
          type: Sequelize.UUID,
          allowNull: true,
        },

        engineer_certified_at: Sequelize.DATE,

        template_source_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },

        service_bulletin_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },

        version: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
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

      // =========================================
      // INDEXES
      // =========================================
      await queryInterface.addIndex('task_cards', ['task_card_number']);
      await queryInterface.addIndex('task_cards', ['aircraft_id']);
      await queryInterface.addIndex('task_cards', ['status']);
    }

    // =========================================
    // CREATE TRIGGER (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_trigger
          WHERE tgname = 'tr_audit_tasks'
        ) THEN
          CREATE TRIGGER tr_audit_tasks
          AFTER INSERT OR UPDATE ON task_cards
          FOR EACH ROW
          EXECUTE FUNCTION fn_audit_trigger();
        END IF;
      END
      $$;
    `);
  },

  down: async (queryInterface) => {

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS tr_audit_tasks ON task_cards;
    `);

    await queryInterface.dropTable('task_cards').catch(() => {});
  },
};