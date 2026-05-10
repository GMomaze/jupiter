async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  up: async (queryInterface, Sequelize) => {
    const exists = await tableExists(queryInterface, 'task_templates');

    if (exists) return;

    await queryInterface.createTable('task_templates', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },

      // ✅ REQUIRED (matches seed + system design)
      task_card_number: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      // ✅ REQUIRED (ordering in workpacks/templates)
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      scope: {
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

      aircraft_model_id: {
        type: Sequelize.UUID,
        references: {
          model: 'component_models',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },

      aircraft_id: {
        type: Sequelize.UUID,
        references: {
          model: 'aircraft',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      is_required_for_wood: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      is_required_for_fabric: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      is_required_for_bungees: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      is_required_for_woodprop: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      is_required_for_retractable: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
    await queryInterface.addIndex('task_templates', ['task_card_number'], {
      name: 'task_templates_number_idx',
    });

    await queryInterface.addIndex('task_templates', ['scope'], {
      name: 'task_templates_scope_idx',
    });

    await queryInterface.addIndex('task_templates', ['aircraft_model_id'], {
      name: 'task_templates_model_idx',
    });

    await queryInterface.addIndex('task_templates', ['aircraft_id'], {
      name: 'task_templates_aircraft_idx',
    });

    await queryInterface.addIndex('task_templates', ['sort_order'], {
      name: 'task_templates_sort_order_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('task_templates');
  },
};
