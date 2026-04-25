'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('sessions', {
      sid: {
        type: Sequelize.STRING,
        primaryKey: true,
      },

      sess: {
        type: Sequelize.JSONB,
        allowNull: false,
      },

      expire: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Index on expire
    await queryInterface.addIndex('sessions', ['expire'], {
      name: 'sessions_expire_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('sessions');
  },
};