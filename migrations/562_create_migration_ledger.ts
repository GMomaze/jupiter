'use strict';

async function getTableDefinition(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

async function ensureConstraint(queryInterface, table, constraintName, sql) {
  await queryInterface.sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = '${table}'
          AND constraint_name = '${constraintName}'
      ) THEN
        ${sql};
      END IF;
    END
    $$;
  `);
}

export default {
  async up(queryInterface, Sequelize) {
    if (!(await getTableDefinition(queryInterface, 'migration_batches'))) {
      await queryInterface.createTable('migration_batches', {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        migration_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'DRAFT',
        },
        created_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },
        approved_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },
        executed_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },
        rolled_back_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },
        approved_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        executed_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        rolled_back_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        dry_run_summary: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        execution_summary: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        rollback_summary: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        report_reference: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
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

    if (!(await getTableDefinition(queryInterface, 'migration_batch_rows'))) {
      await queryInterface.createTable('migration_batch_rows', {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        batch_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'migration_batches', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        source_table: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        source_row_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        migration_category: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        decision: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'PENDING',
        },
        source_snapshot: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        planned_target_snapshot: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        actual_target_snapshot: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        warnings: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        conflicts: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        failure_reason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        rollback_status: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
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

    if (!(await getTableDefinition(queryInterface, 'migration_created_targets'))) {
      await queryInterface.createTable('migration_created_targets', {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        batch_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'migration_batches', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        batch_row_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'migration_batch_rows', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        target_table: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        target_row_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        created_snapshot: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        rollback_action: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        rollback_status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'PENDING',
        },
        rollback_timestamp: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
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

    await ensureConstraint(
      queryInterface,
      'migration_batches',
      'migration_batches_status_check',
      `ALTER TABLE migration_batches
       ADD CONSTRAINT migration_batches_status_check
       CHECK (status IN ('DRAFT', 'DRY_RUN', 'APPROVED', 'EXECUTING', 'COMPLETE', 'FAILED', 'ROLLED_BACK', 'PARTIALLY_ROLLED_BACK'))`
    );

    await ensureConstraint(
      queryInterface,
      'migration_batch_rows',
      'migration_batch_rows_status_check',
      `ALTER TABLE migration_batch_rows
       ADD CONSTRAINT migration_batch_rows_status_check
       CHECK (status IN ('PENDING', 'MIGRATED', 'FAILED', 'SKIPPED', 'ROLLED_BACK'))`
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS migration_batches_migration_type_idx
      ON migration_batches (migration_type);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS migration_batches_status_idx
      ON migration_batches (status);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS migration_batch_rows_batch_id_idx
      ON migration_batch_rows (batch_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS migration_batch_rows_status_idx
      ON migration_batch_rows (status);
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS migration_batch_rows_source_unique
      ON migration_batch_rows (batch_id, source_table, source_row_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS migration_created_targets_batch_id_idx
      ON migration_created_targets (batch_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS migration_created_targets_batch_row_id_idx
      ON migration_created_targets (batch_row_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS migration_created_targets_target_unique
      ON migration_created_targets (batch_row_id, target_table, target_row_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('migration_created_targets').catch(() => {});
    await queryInterface.dropTable('migration_batch_rows').catch(() => {});
    await queryInterface.dropTable('migration_batches').catch(() => {});
  },
};
