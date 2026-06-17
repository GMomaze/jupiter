'use strict';

async function tableExists(queryInterface, table) {
  return Boolean(await queryInterface.describeTable(table).catch(() => null));
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'utilisation_events';

    if (!(await tableExists(queryInterface, table))) {
      await queryInterface.createTable(table, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
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
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        source_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        source_reference: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        effective_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        previous_total_time_hours: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
        },
        new_total_time_hours: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
        },
        delta_hours: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
        },
        previous_total_time_cycles: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        new_total_time_cycles: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        delta_cycles: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        reason: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        correction_of_event_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: table,
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: true,
        },
        created_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS utilisation_events_aircraft_id_index
      ON utilisation_events (aircraft_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS utilisation_events_effective_date_index
      ON utilisation_events (effective_date);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS utilisation_events_source_type_index
      ON utilisation_events (source_type);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS utilisation_events_correction_of_event_id_index
      ON utilisation_events (correction_of_event_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION prevent_utilisation_event_mutation()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'UTILISATION_EVENT_IMMUTABLE';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS utilisation_events_prevent_update ON utilisation_events;
      CREATE TRIGGER utilisation_events_prevent_update
      BEFORE UPDATE ON utilisation_events
      FOR EACH ROW
      EXECUTE FUNCTION prevent_utilisation_event_mutation();
    `);

    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS utilisation_events_prevent_delete ON utilisation_events;
      CREATE TRIGGER utilisation_events_prevent_delete
      BEFORE DELETE ON utilisation_events
      FOR EACH ROW
      EXECUTE FUNCTION prevent_utilisation_event_mutation();
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS utilisation_events_prevent_update ON utilisation_events;
    `);
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS utilisation_events_prevent_delete ON utilisation_events;
    `);
    await queryInterface.dropTable('utilisation_events').catch(() => undefined);
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS prevent_utilisation_event_mutation();
    `);
  },
};
