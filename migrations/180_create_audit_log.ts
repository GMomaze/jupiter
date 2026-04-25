'use strict';

async function tableExists(queryInterface, tableName) {
  return await queryInterface.describeTable(tableName).catch(() => null);
}

export default {
  up: async (queryInterface, Sequelize) => {
    const exists = await tableExists(queryInterface, 'audit_log');

    if (exists) return;

    await queryInterface.createTable('audit_log', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },

      table_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      row_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      action: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      actor_id: {
        type: Sequelize.UUID,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },

      old_values: Sequelize.JSONB,
      new_values: Sequelize.JSONB,

      reason: Sequelize.TEXT,

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // =========================================
    // INDEXES
    // =========================================
    await queryInterface.addIndex('audit_log', ['table_name'], {
      name: 'audit_log_table_name_idx',
    });

    await queryInterface.addIndex('audit_log', ['row_id'], {
      name: 'audit_log_row_id_idx',
    });

    await queryInterface.addIndex('audit_log', ['actor_id'], {
      name: 'audit_log_actor_id_idx',
    });

    await queryInterface.addIndex('audit_log', ['created_at'], {
      name: 'audit_log_created_at_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('audit_log');
  },
};