'use strict';

const TABLE_NAME = 'customer_users';
const STATUS_CHECK = 'customer_users_status_check';
const STATUS_VALUES = ['ACTIVE', 'INVITED', 'DISABLED'];

function statusList() {
  return STATUS_VALUES.map((value) => `'${value}'`).join(', ');
}

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE_NAME, {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      customer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'customers', key: 'id' },
        onUpdate: 'NO ACTION',
        onDelete: 'RESTRICT',
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      display_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      password_hash: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'INVITED',
      },
      invite_token_hash: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      invite_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      password_reset_token_hash: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      password_reset_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE ${TABLE_NAME}
      ADD CONSTRAINT ${STATUS_CHECK}
      CHECK (status IN (${statusList()}));
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX customer_users_email_unique
      ON ${TABLE_NAME} (email);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX customer_users_customer_id_index
      ON ${TABLE_NAME} (customer_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX customer_users_status_index
      ON ${TABLE_NAME} (status);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_users_status_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_users_customer_id_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_users_email_unique;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS ${TABLE_NAME}
      DROP CONSTRAINT IF EXISTS ${STATUS_CHECK};
    `);
    await queryInterface.dropTable(TABLE_NAME);
  },
};
