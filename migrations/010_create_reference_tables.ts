'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

async function createReferenceTable(queryInterface, Sequelize, tableName) {
  const exists = await tableExists(queryInterface, tableName);

  if (!exists) {
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },

      code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      label: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      description: {
        type: Sequelize.TEXT,
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },

      system_locked: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  }

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS ${tableName}_code_idx
    ON ${tableName} (code);
  `);
}

export default {
  async up(queryInterface, Sequelize) {

    // =========================================
    // GENERIC REFERENCE TABLES
    // =========================================
    const genericTables = [
      'rf_role',
      'rf_task_state',
      'rf_workpack_status',
      'rf_component_condition',
      'rf_signoff_role',
      'rf_aircraft_category',
      'rf_component_categories'
    ];

    for (const table of genericTables) {
      await createReferenceTable(queryInterface, Sequelize, table);
    }

    // =========================================
    // SPECIAL TABLE: rf_asset_type
    // =========================================
    const assetExists = await tableExists(queryInterface, 'rf_asset_type');

    if (!assetExists) {
      await queryInterface.createTable('rf_asset_type', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        code: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },

        label: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        description: {
          type: Sequelize.TEXT,
        },

        is_installable_on_aircraft: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        is_required_for_aircraft: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },

        required_quantity: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },

        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },

        system_locked: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },

        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS rf_asset_type_code_idx
      ON rf_asset_type (code);
    `);

    // =========================================
    // SPECIAL TABLE: rf_permission
    // =========================================
    const permExists = await tableExists(queryInterface, 'rf_permission');

    if (!permExists) {
      await queryInterface.createTable('rf_permission', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        code: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },

        label: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        description: {
          type: Sequelize.TEXT,
        },

        module: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },

        system_locked: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },

        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS rf_permission_code_idx
      ON rf_permission (code);
    `);
  },

  async down(queryInterface) {
    const tables = [
      'rf_permission',
      'rf_component_categories',
      'rf_asset_type',
      'rf_aircraft_category',
      'rf_signoff_role',
      'rf_component_condition',
      'rf_workpack_status',
      'rf_task_state',
      'rf_role',
    ];

    for (const table of tables) {
      await queryInterface.dropTable(table).catch(() => {});
    }
  },
};