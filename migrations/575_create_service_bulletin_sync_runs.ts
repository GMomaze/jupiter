'use strict';

async function tableExists(queryInterface, table) {
  return Boolean(await queryInterface.describeTable(table).catch(() => null));
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'service_bulletin_sync_runs';

    if (!(await tableExists(queryInterface, table))) {
      await queryInterface.createTable(table, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        trigger_type: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'MANUAL',
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'RUNNING',
        },
        synced_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        created_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        updated_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        error_message: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        started_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        finished_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });
    }

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'service_bulletin_sync_runs_trigger_type_check'
        ) THEN
          ALTER TABLE service_bulletin_sync_runs
          ADD CONSTRAINT service_bulletin_sync_runs_trigger_type_check
          CHECK (trigger_type IN ('MANUAL', 'CRON'));
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'service_bulletin_sync_runs_status_check'
        ) THEN
          ALTER TABLE service_bulletin_sync_runs
          ADD CONSTRAINT service_bulletin_sync_runs_status_check
          CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED'));
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS service_bulletin_sync_runs_status_index
      ON service_bulletin_sync_runs (status);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS service_bulletin_sync_runs_started_at_index
      ON service_bulletin_sync_runs (started_at DESC);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('service_bulletin_sync_runs').catch(() => undefined);
  },
};
