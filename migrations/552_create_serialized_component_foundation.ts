'use strict';

async function tableExists(queryInterface, tableName) {
  const table = await queryInterface.describeTable(tableName).catch(() => null);
  return Boolean(table);
}

export default {
  async up(queryInterface, Sequelize) {
    const serializedComponentsTable = 'serialized_components';
    const aircraftComponentInstallationsTable = 'aircraft_component_installations';
    const serializedComponentLifeStatesTable = 'serialized_component_life_states';
    const serializedComponentMaintenanceEventsTable = 'serialized_component_maintenance_events';
    const componentLifeLimitsTable = 'component_life_limits';

    if (!(await tableExists(queryInterface, serializedComponentsTable))) {
      await queryInterface.createTable(serializedComponentsTable, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        component_model_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'component_models', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        serial_number: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        part_number: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'AVAILABLE',
        },
        condition: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        notes: {
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
    }

    if (!(await tableExists(queryInterface, componentLifeLimitsTable))) {
      await queryInterface.createTable(componentLifeLimitsTable, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        component_model_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'component_models', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        limit_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        basis: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        limit_hours: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        limit_cycles: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        limit_months: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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
    }

    if (!(await tableExists(queryInterface, serializedComponentLifeStatesTable))) {
      await queryInterface.createTable(serializedComponentLifeStatesTable, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        serialized_component_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: serializedComponentsTable, key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        tsn_hours: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        tso_hours: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        csn_cycles: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        cso_cycles: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        overhaul_reference_date: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        calendar_reference_date: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        notes: {
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
    }

    if (!(await tableExists(queryInterface, aircraftComponentInstallationsTable))) {
      await queryInterface.createTable(aircraftComponentInstallationsTable, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        aircraft_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'aircraft', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        serialized_component_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: serializedComponentsTable, key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        installation_context: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'MAINTENANCE_INSTALL',
        },
        installed_at: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        removed_at: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        position: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        install_tsn: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        install_tso: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        removal_tsn: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        removal_tso: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        installed_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        removed_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        notes: {
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
    }

    if (!(await tableExists(queryInterface, serializedComponentMaintenanceEventsTable))) {
      await queryInterface.createTable(serializedComponentMaintenanceEventsTable, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        serialized_component_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: serializedComponentsTable, key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        event_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        occurred_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        recorded_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        notes: {
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
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS serialized_components_component_model_id_index
      ON ${serializedComponentsTable} (component_model_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS serialized_components_status_index
      ON ${serializedComponentsTable} (status);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS serialized_components_serial_number_index
      ON ${serializedComponentsTable} (serial_number);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS component_life_limits_component_model_id_index
      ON ${componentLifeLimitsTable} (component_model_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS component_life_limits_is_active_index
      ON ${componentLifeLimitsTable} (is_active);
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS serialized_component_life_states_serialized_component_id_unique
      ON ${serializedComponentLifeStatesTable} (serialized_component_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS aircraft_component_installations_aircraft_id_index
      ON ${aircraftComponentInstallationsTable} (aircraft_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS aircraft_component_installations_serialized_component_id_index
      ON ${aircraftComponentInstallationsTable} (serialized_component_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS aircraft_component_installations_aircraft_removed_at_index
      ON ${aircraftComponentInstallationsTable} (aircraft_id, removed_at);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS aircraft_component_installations_serialized_installed_at_index
      ON ${aircraftComponentInstallationsTable} (serialized_component_id, installed_at);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS serialized_component_maintenance_events_component_id_index
      ON ${serializedComponentMaintenanceEventsTable} (serialized_component_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS serialized_component_maintenance_events_recorded_by_index
      ON ${serializedComponentMaintenanceEventsTable} (recorded_by);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS serialized_component_maintenance_events_occurred_at_index
      ON ${serializedComponentMaintenanceEventsTable} (occurred_at);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS serialized_component_maintenance_events_occurred_at_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS serialized_component_maintenance_events_recorded_by_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS serialized_component_maintenance_events_component_id_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS aircraft_component_installations_serialized_installed_at_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS aircraft_component_installations_aircraft_removed_at_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS aircraft_component_installations_serialized_component_id_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS aircraft_component_installations_aircraft_id_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS serialized_component_life_states_serialized_component_id_unique;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS component_life_limits_is_active_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS component_life_limits_component_model_id_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS serialized_components_serial_number_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS serialized_components_status_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS serialized_components_component_model_id_index;
    `);

    await queryInterface.dropTable('aircraft_component_installations').catch(() => undefined);
    await queryInterface.dropTable('serialized_component_maintenance_events').catch(() => undefined);
    await queryInterface.dropTable('serialized_component_life_states').catch(() => undefined);
    await queryInterface.dropTable('component_life_limits').catch(() => undefined);
    await queryInterface.dropTable('serialized_components').catch(() => undefined);
  },
};
