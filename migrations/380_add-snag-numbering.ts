'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'workpack_snags';

    const exists = await tableExists(queryInterface, table);
    if (!exists) return;

    // =========================================
    // 1. ADD COLUMN (SAFE)
    // =========================================
    const def = await queryInterface.describeTable(table);

    if (!def.snag_no) {
      await queryInterface.addColumn(table, 'snag_no', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    // =========================================
    // 2. BACKFILL (SET-BASED, FAST)
    // =========================================
    await queryInterface.sequelize.query(`
      WITH numbered AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY workpack_id
            ORDER BY created_at ASC, id ASC
          ) AS rn
        FROM ${table}
      )
      UPDATE ${table} t
      SET snag_no = n.rn
      FROM numbered n
      WHERE t.id = n.id;
    `);

    // =========================================
    // 3. SET NOT NULL (SAFE)
    // =========================================
    await queryInterface.changeColumn(table, 'snag_no', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    // =========================================
    // 4. UNIQUE CONSTRAINT (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_snags_workpack_id_snag_no_unique'
        ) THEN
          ALTER TABLE ${table}
          ADD CONSTRAINT workpack_snags_workpack_id_snag_no_unique
          UNIQUE (workpack_id, snag_no);
        END IF;
      END
      $$;
    `);
  },

  async down(queryInterface) {
    const table = 'workpack_snags';

    await queryInterface.sequelize.query(`
      ALTER TABLE ${table}
      DROP CONSTRAINT IF EXISTS workpack_snags_workpack_id_snag_no_unique;
    `);

    await queryInterface.removeColumn(table, 'snag_no').catch(() => {});
  },
};