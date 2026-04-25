'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('model_sids', {
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

      sid_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'cessna_sids',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Prevent duplicates
    await queryInterface.addConstraint('model_sids', {
      fields: ['model_id', 'sid_id'],
      type: 'unique',
      name: 'model_sids_unique',
    });

    // Indexes
    await queryInterface.addIndex('model_sids', ['model_id']);
    await queryInterface.addIndex('model_sids', ['sid_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('model_sids');
  },
};