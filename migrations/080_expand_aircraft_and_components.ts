'use strict';

export default {
  up: async (queryInterface, Sequelize) => {
    // =========================================
    // COMPONENT MODELS
    // =========================================
    await queryInterface.createTable('component_models', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },

      manufacturer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'manufacturers',
          key: 'id',
        },
      },

      model_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      category_id: {
        type: Sequelize.UUID,
        references: {
          model: 'rf_component_categories',
          key: 'id',
        },
      },

      default_tbo_hours: Sequelize.DECIMAL(10, 2),
      default_tbo_months: Sequelize.INTEGER,
      service_interval_hours: Sequelize.DECIMAL(10, 2),
      service_interval_months: Sequelize.INTEGER,
      overhaul_interval_hours: Sequelize.DECIMAL(10, 2),
      overhaul_interval_months: Sequelize.INTEGER,
      maintenance_notes: Sequelize.TEXT,

      is_life_limited: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      asset_type_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'rf_asset_type',
          key: 'id',
        },
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

    // =========================================
    // AIRCRAFT COMPONENTS
    // =========================================
    await queryInterface.createTable('aircraft_components', {
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

      model_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'component_models',
          key: 'id',
        },
      },

      serial_number: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      position_code: Sequelize.STRING(50),

      installation_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      install_af_hours: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },

      tso_at_install: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },

      tsn_at_install: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
      },

      current_status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'INSTALLED',
      },

      is_quarantined: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      removed_at: Sequelize.DATE,

      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // =========================================
    // PARTIAL UNIQUE INDEX
    // =========================================
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_component
      ON aircraft_components (aircraft_id, model_id)
      WHERE current_status = 'INSTALLED';
    `);
  },

  down: async (queryInterface) => {
    // =========================================
    // CLEANUP (match your original logic)
    // =========================================
    await queryInterface.sequelize.query(`
      DROP VIEW IF EXISTS vw_component_status;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_unique_active_component;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'aircraft_model_id_foreign'
        ) THEN
          ALTER TABLE aircraft
          DROP CONSTRAINT aircraft_model_id_foreign;
        END IF;
      END
      $$;
    `);

    await queryInterface.dropTable('aircraft_components');
    await queryInterface.dropTable('component_models');
  },
};
