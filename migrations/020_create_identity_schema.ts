'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  up: async (queryInterface, Sequelize) => {

    // =========================================
    // 1. USERS TABLE
    // =========================================
    const usersExists = await tableExists(queryInterface, 'users');

    if (!usersExists) {
      await queryInterface.createTable('users', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        email: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },

        password_hash: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        full_name: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
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

    // 🔥 SAFE INDEX (fixes your error)
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS users_is_active_index
      ON users (is_active);
    `);

    // =========================================
    // 2. USER ROLES TABLE
    // =========================================
    const userRolesExists = await tableExists(queryInterface, 'user_roles');

    if (!userRolesExists) {
      await queryInterface.createTable('user_roles', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },

        role_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'rf_role',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
      });
    }

    // 🔥 SAFE UNIQUE CONSTRAINT
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'user_roles_user_id_role_id_unique'
        ) THEN
          ALTER TABLE user_roles
          ADD CONSTRAINT user_roles_user_id_role_id_unique
          UNIQUE (user_id, role_id);
        END IF;
      END
      $$;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('user_roles').catch(() => {});
    await queryInterface.dropTable('users').catch(() => {});
  },
};