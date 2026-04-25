'use strict';

async function tableExists(queryInterface, tableName) {
  return await queryInterface.describeTable(tableName).catch(() => null);
}

export default {
  up: async (queryInterface, Sequelize) => {
    const exists = await tableExists(queryInterface, 'maintenance_requirements');

    if (!exists) {
      await queryInterface.createTable('maintenance_requirements', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        model_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'component_models',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },

        title: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        interval_hours: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },

        interval_months: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },

        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
      });

      // =========================================
      // INDEX
      // =========================================
      await queryInterface.addIndex('maintenance_requirements', ['model_id'], {
        name: 'maintenance_requirements_model_id_idx',
      });

      console.log('✅ Table "maintenance_requirements" created.');
    } else {
      console.log('⚠️ Table "maintenance_requirements" already exists. Skipping creation.');
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('maintenance_requirements');
  },
};