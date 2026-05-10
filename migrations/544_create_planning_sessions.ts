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

async function ensureForeignKey(queryInterface, table, constraintName, sql) {
  await ensureConstraint(queryInterface, table, constraintName, sql);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'planning_sessions';

    if (!(await getTableDefinition(queryInterface, table))) {
      await queryInterface.createTable(table, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        aircraft_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'aircraft', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        template_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'maintenance_templates', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        maintenance_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        candidate_content: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        selected_item_ids: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'OPEN',
        },
        generated_workpack_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'workpacks', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
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
      await ensureColumn(queryInterface, table, 'user_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
      await ensureColumn(queryInterface, table, 'aircraft_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
      await ensureColumn(queryInterface, table, 'template_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
      await ensureColumn(queryInterface, table, 'maintenance_type', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, table, 'candidate_content', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      });
      await ensureColumn(queryInterface, table, 'selected_item_ids', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      });
      await ensureColumn(queryInterface, table, 'status', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'OPEN',
      });
      await ensureColumn(queryInterface, table, 'generated_workpack_id', {
        type: Sequelize.UUID,
        allowNull: true,
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

    await queryInterface.changeColumn(table, 'user_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
    await queryInterface.changeColumn(table, 'aircraft_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
    await queryInterface.changeColumn(table, 'template_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
    await queryInterface.changeColumn(table, 'maintenance_type', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn(table, 'candidate_content', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });
    await queryInterface.changeColumn(table, 'selected_item_ids', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
    await queryInterface.changeColumn(table, 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'OPEN',
    });

    await ensureConstraint(
      queryInterface,
      table,
      'planning_sessions_status_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT planning_sessions_status_check
       CHECK (status IN ('OPEN', 'CLOSED'))`
    );

    await ensureForeignKey(
      queryInterface,
      table,
      'planning_sessions_user_id_fkey',
      `ALTER TABLE ${table}
       ADD CONSTRAINT planning_sessions_user_id_fkey
       FOREIGN KEY (user_id)
       REFERENCES users(id)
       ON UPDATE NO ACTION
       ON DELETE CASCADE`
    );

    await ensureForeignKey(
      queryInterface,
      table,
      'planning_sessions_aircraft_id_fkey',
      `ALTER TABLE ${table}
       ADD CONSTRAINT planning_sessions_aircraft_id_fkey
       FOREIGN KEY (aircraft_id)
       REFERENCES aircraft(id)
       ON UPDATE NO ACTION
       ON DELETE CASCADE`
    );

    await ensureForeignKey(
      queryInterface,
      table,
      'planning_sessions_template_id_fkey',
      `ALTER TABLE ${table}
       ADD CONSTRAINT planning_sessions_template_id_fkey
       FOREIGN KEY (template_id)
       REFERENCES maintenance_templates(id)
       ON UPDATE NO ACTION
       ON DELETE CASCADE`
    );

    await ensureForeignKey(
      queryInterface,
      table,
      'planning_sessions_generated_workpack_id_fkey',
      `ALTER TABLE ${table}
       ADD CONSTRAINT planning_sessions_generated_workpack_id_fkey
       FOREIGN KEY (generated_workpack_id)
       REFERENCES workpacks(id)
       ON UPDATE NO ACTION
       ON DELETE SET NULL`
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS planning_sessions_user_id_index
      ON ${table} (user_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS planning_sessions_aircraft_id_index
      ON ${table} (aircraft_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS planning_sessions_template_id_index
      ON ${table} (template_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS planning_sessions_status_index
      ON ${table} (status);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS planning_sessions_user_status_index
      ON ${table} (user_id, status, updated_at DESC);
    `);
  },

  async down() {
    return;
  },
};
