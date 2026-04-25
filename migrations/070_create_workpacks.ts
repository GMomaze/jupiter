'use strict';

async function tableExists(queryInterface, tableName) {
  return await queryInterface.describeTable(tableName).catch(() => null);
}

export default {
  up: async (queryInterface, Sequelize) => {
    // =========================================
    // WORKPACKS
    // =========================================
    if (!(await tableExists(queryInterface, 'workpacks'))) {
      await queryInterface.createTable('workpacks', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        work_order_number: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },

        status_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'rf_workpack_status',
            key: 'id',
          },
          onDelete: 'RESTRICT',
        },

        aircraft_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'aircraft',
            key: 'id',
          },
          onDelete: 'RESTRICT',
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
    }

    // =========================================
    // WORKPACK_TASKS (junction table)
    // =========================================
    if (!(await tableExists(queryInterface, 'workpack_tasks'))) {
      await queryInterface.createTable('workpack_tasks', {
        workpack_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'workpacks',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },

        task_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'task_cards',
            key: 'id',
          },
          onDelete: 'RESTRICT',
        },
      });

      // Composite PK
      await queryInterface.addConstraint('workpack_tasks', {
        fields: ['workpack_id', 'task_id'],
        type: 'primary key',
        name: 'workpack_tasks_pkey',
      });
    }

    // =========================================
    // WORKPACK_REQUIREMENTS
    // =========================================
    if (!(await tableExists(queryInterface, 'workpack_requirements'))) {
      await queryInterface.createTable('workpack_requirements', {
        workpack_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'workpacks',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },

        maintenance_requirement_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },

        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'OPEN',
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

      // Composite PK
      await queryInterface.addConstraint('workpack_requirements', {
        fields: ['workpack_id', 'maintenance_requirement_id'],
        type: 'primary key',
        name: 'workpack_requirements_pkey',
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('workpack_requirements');
    await queryInterface.dropTable('workpack_tasks');
    await queryInterface.dropTable('workpacks');
  },
};