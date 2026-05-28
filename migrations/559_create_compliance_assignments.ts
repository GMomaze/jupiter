'use strict';

async function getTableDefinition(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

async function ensureColumn(queryInterface, table, column, definition) {
  const tableDefinition = await getTableDefinition(queryInterface, table);

  if (!tableDefinition) {
    throw new Error(`Table ${table} does not exist.`);
  }

  if (!tableDefinition[column]) {
    await queryInterface.addColumn(table, column, definition);
  }
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
    const table = 'compliance_assignments';

    if (!(await getTableDefinition(queryInterface, table))) {
      await queryInterface.createTable(table, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        compliance_item_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'compliance_items',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        assignment_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        model_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'component_models',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        aircraft_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'aircraft',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        assignment_source: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'MANUAL',
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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
    } else {
      await ensureColumn(queryInterface, table, 'compliance_item_id', {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'compliance_items', key: 'id' },
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      });
      await ensureColumn(queryInterface, table, 'assignment_type', {
        type: Sequelize.STRING,
        allowNull: false,
      });
      await ensureColumn(queryInterface, table, 'model_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'component_models', key: 'id' },
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      });
      await ensureColumn(queryInterface, table, 'aircraft_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'aircraft', key: 'id' },
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      });
      await ensureColumn(queryInterface, table, 'assignment_source', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'MANUAL',
      });
      await ensureColumn(queryInterface, table, 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
      await ensureColumn(queryInterface, table, 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
      await ensureColumn(queryInterface, table, 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }

    await ensureConstraint(
      queryInterface,
      table,
      'compliance_assignments_assignment_type_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT compliance_assignments_assignment_type_check
       CHECK (assignment_type IN ('MODEL', 'AIRCRAFT'))`
    );

    await ensureConstraint(
      queryInterface,
      table,
      'compliance_assignments_assignment_source_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT compliance_assignments_assignment_source_check
       CHECK (assignment_source IN ('AUTO', 'MANUAL'))`
    );

    await ensureConstraint(
      queryInterface,
      table,
      'compliance_assignments_target_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT compliance_assignments_target_check
       CHECK (
         (assignment_type = 'MODEL' AND model_id IS NOT NULL AND aircraft_id IS NULL)
         OR
         (assignment_type = 'AIRCRAFT' AND aircraft_id IS NOT NULL)
       )`
    );

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS compliance_assignments_active_model_unique
      ON ${table} (compliance_item_id, model_id)
      WHERE is_active = TRUE AND assignment_type = 'MODEL';
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS compliance_assignments_active_aircraft_unique
      ON ${table} (compliance_item_id, aircraft_id)
      WHERE is_active = TRUE AND assignment_type = 'AIRCRAFT';
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_assignments_compliance_item_id_index
      ON ${table} (compliance_item_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_assignments_assignment_type_index
      ON ${table} (assignment_type);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_assignments_model_id_index
      ON ${table} (model_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_assignments_aircraft_id_index
      ON ${table} (aircraft_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_assignments_assignment_source_index
      ON ${table} (assignment_source);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_assignments_is_active_index
      ON ${table} (is_active);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('compliance_assignments').catch(() => {});
  },
};
