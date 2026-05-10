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
    const table = 'planning_sessions';
    const definition = await getTableDefinition(queryInterface, table);

    if (!definition) {
      return;
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE ${table}
      DROP CONSTRAINT IF EXISTS planning_sessions_status_check;
    `);

    await queryInterface.sequelize.query(`
      UPDATE ${table}
      SET status = CASE
        WHEN UPPER(TRIM(COALESCE(status, ''))) = 'CLOSED' THEN 'GENERATED'
        ELSE 'IN_PROGRESS'
      END
      WHERE UPPER(TRIM(COALESCE(status, ''))) IN ('OPEN', 'CLOSED');
    `);

    await queryInterface.changeColumn(table, 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'DRAFT',
    });

    await ensureConstraint(
      queryInterface,
      table,
      'planning_sessions_status_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT planning_sessions_status_check
       CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'READY_FOR_GENERATION', 'GENERATED'))`
    );
  },

  async down() {
    return;
  },
};
