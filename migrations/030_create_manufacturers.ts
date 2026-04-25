'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    const exists = await queryInterface
      .describeTable('manufacturers')
      .catch(() => null);

    if (!exists) {
      await queryInterface.createTable('manufacturers', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        code: {
          type: Sequelize.STRING,
          unique: true,
        },

        description: Sequelize.TEXT,

        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },

        website: Sequelize.TEXT,
        logo_url: Sequelize.TEXT,

        address_line_1: Sequelize.TEXT,
        address_line_2: Sequelize.TEXT,
        city: Sequelize.TEXT,
        state: Sequelize.TEXT,
        country: Sequelize.TEXT,
        postal_code: Sequelize.TEXT,

        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },

        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('manufacturers');
  },
};