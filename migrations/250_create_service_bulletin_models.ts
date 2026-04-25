'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const exists = await tableExists(queryInterface, 'service_bulletin_models');

    if (!exists) {
      await queryInterface.createTable('service_bulletin_models', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        service_bulletin_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },

        model_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
      });

      // =========================================
      // FOREIGN KEYS (CONTROLLED — no duplication)
      // =========================================
      await queryInterface.sequelize.query(`
        ALTER TABLE service_bulletin_models
        ADD CONSTRAINT sb_models_sb_fk
        FOREIGN KEY (service_bulletin_id)
        REFERENCES service_bulletins(id)
        ON DELETE CASCADE;
      `);

      await queryInterface.sequelize.query(`
        ALTER TABLE service_bulletin_models
        ADD CONSTRAINT sb_models_model_fk
        FOREIGN KEY (model_id)
        REFERENCES component_models(id)
        ON DELETE CASCADE;
      `);

      // =========================================
      // INDEXES
      // =========================================
      await queryInterface.addIndex('service_bulletin_models', ['service_bulletin_id'], {
        name: 'sb_models_sb_idx',
      });

      await queryInterface.addIndex('service_bulletin_models', ['model_id'], {
        name: 'sb_models_model_idx',
      });

      await queryInterface.addIndex(
        'service_bulletin_models',
        ['service_bulletin_id', 'model_id'],
        {
          unique: true,
          name: 'sb_models_unique',
        }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE service_bulletin_models
      DROP CONSTRAINT IF EXISTS sb_models_sb_fk;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE service_bulletin_models
      DROP CONSTRAINT IF EXISTS sb_models_model_fk;
    `);

    await queryInterface.dropTable('service_bulletin_models');
  },
};