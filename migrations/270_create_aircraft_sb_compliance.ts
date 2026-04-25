'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'aircraft_sb_compliance';
    const exists = await tableExists(queryInterface, table);

    if (!exists) {
      await queryInterface.createTable(table, {
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

        service_bulletin_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'service_bulletins',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },

        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'PENDING',
        },

        complied_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },

        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },

        // ✅ include timestamps (safe + consistent)
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },

        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      // =========================================
      // UNIQUE (prevent duplicate SB per aircraft)
      // =========================================
      await queryInterface.addConstraint(table, {
        fields: ['aircraft_id', 'service_bulletin_id'],
        type: 'unique',
        name: 'aircraft_sb_unique',
      });

      // =========================================
      // INDEXES
      // =========================================
      await queryInterface.addIndex(table, ['aircraft_id']);
      await queryInterface.addIndex(table, ['service_bulletin_id']);
      await queryInterface.addIndex(table, ['status']);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('aircraft_sb_compliance').catch(() => {});
  },
};