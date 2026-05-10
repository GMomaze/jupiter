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
    const table = 'planning_sessions';
    const definition = await getTableDefinition(queryInterface, table);

    if (!definition) {
      return;
    }

    await ensureColumn(queryInterface, table, 'created_by', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    await ensureColumn(queryInterface, table, 'finalized_by', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    await ensureColumn(queryInterface, table, 'finalized_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE ${table}
      SET created_by = user_id
      WHERE created_by IS NULL;
    `);

    await ensureConstraint(
      queryInterface,
      table,
      'planning_sessions_created_by_fkey',
      `ALTER TABLE ${table}
       ADD CONSTRAINT planning_sessions_created_by_fkey
       FOREIGN KEY (created_by)
       REFERENCES users(id)
       ON UPDATE NO ACTION
       ON DELETE SET NULL`
    );

    await ensureConstraint(
      queryInterface,
      table,
      'planning_sessions_finalized_by_fkey',
      `ALTER TABLE ${table}
       ADD CONSTRAINT planning_sessions_finalized_by_fkey
       FOREIGN KEY (finalized_by)
       REFERENCES users(id)
       ON UPDATE NO ACTION
       ON DELETE SET NULL`
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS planning_sessions_created_by_index
      ON ${table} (created_by);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS planning_sessions_finalized_by_index
      ON ${table} (finalized_by);
    `);
  },

  async down() {
    return;
  },
};
