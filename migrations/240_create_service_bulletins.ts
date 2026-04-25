'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const exists = await tableExists(queryInterface, 'service_bulletins');

    if (!exists) {
      await queryInterface.createTable('service_bulletins', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        sb_number: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        title: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },

        issued_on: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },

        compliance_type: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'MANUAL',
        },

        source_primary: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'MANUAL',
        },

        source_refs: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: Sequelize.literal(`'[]'::jsonb`),
        },

        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE',
        },

        revision: {
          type: Sequelize.STRING,
          allowNull: true,
        },

        document_url: {
          type: Sequelize.TEXT,
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

      // Indexes
      await queryInterface.addIndex('service_bulletins', ['sb_number'], {
        unique: true,
        name: 'service_bulletins_sb_number_unique',
      });

      await queryInterface.addIndex('service_bulletins', ['source_primary'], {
        name: 'service_bulletins_source_primary_idx',
      });

      await queryInterface.addIndex('service_bulletins', ['status'], {
        name: 'service_bulletins_status_idx',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('service_bulletins');
  },
};