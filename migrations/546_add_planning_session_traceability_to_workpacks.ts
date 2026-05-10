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
    const table = 'workpacks';

    await ensureColumn(queryInterface, table, 'planning_session_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    await ensureConstraint(
      queryInterface,
      table,
      'workpacks_planning_session_id_fkey',
      `ALTER TABLE ${table}
       ADD CONSTRAINT workpacks_planning_session_id_fkey
       FOREIGN KEY (planning_session_id)
       REFERENCES planning_sessions(id)
       ON UPDATE NO ACTION
       ON DELETE SET NULL`
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpacks_planning_session_id_index
      ON ${table} (planning_session_id);
    `);
  },

  async down() {
    return;
  },
};
