'use strict';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('aircraft_sid_status', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },

      aircraft_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'aircraft',
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

      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'DUE', // DUE | COMPLIANT | OVERDUE
      },

      last_done_hours: {
        type: Sequelize.DECIMAL(10, 2),
      },

      last_done_date: {
        type: Sequelize.DATE,
      },

      next_due_hours: {
        type: Sequelize.DECIMAL(10, 2),
      },

      next_due_date: {
        type: Sequelize.DATE,
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },

      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Prevent duplicates per aircraft
    await queryInterface.addConstraint('aircraft_sid_status', {
      fields: ['aircraft_id', 'sid_id'],
      type: 'unique',
      name: 'aircraft_sid_unique',
    });

    await queryInterface.addIndex('aircraft_sid_status', ['aircraft_id']);
    await queryInterface.addIndex('aircraft_sid_status', ['sid_id']);
    await queryInterface.addIndex('aircraft_sid_status', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('aircraft_sid_status');
  },
};