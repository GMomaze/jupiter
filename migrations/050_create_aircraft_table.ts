'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  up: async (queryInterface, Sequelize) => {

    // =========================================
    // CREATE TABLE (SAFE)
    // =========================================
    const exists = await tableExists(queryInterface, 'aircraft');

    if (!exists) {
      await queryInterface.createTable('aircraft', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        registration: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },

        serial_number: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },

        model: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        category_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'rf_aircraft_category',
            key: 'id',
          },
        },

        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'REGISTERED',
        },

        total_time_hours: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
        },

        total_time_cycles: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
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

    // =========================================
    // CREATE TRIGGER (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_trigger
          WHERE tgname = 'tr_audit_aircraft'
        ) THEN
          CREATE TRIGGER tr_audit_aircraft
          AFTER INSERT OR UPDATE ON aircraft
          FOR EACH ROW
          EXECUTE FUNCTION public.fn_audit_trigger();
        END IF;
      END
      $$;
    `);
  },

  down: async (queryInterface) => {

    // =========================================
    // DROP FK (DEFENSIVE)
    // =========================================
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'aircraft_components_aircraft_id_foreign'
        ) THEN
          ALTER TABLE aircraft_components
          DROP CONSTRAINT aircraft_components_aircraft_id_foreign;
        END IF;
      END
      $$;
    `);

    // =========================================
    // DROP TRIGGER (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS tr_audit_aircraft ON aircraft;
    `);

    // =========================================
    // DROP TABLE
    // =========================================
    await queryInterface.dropTable('aircraft').catch(() => {});
  },
};