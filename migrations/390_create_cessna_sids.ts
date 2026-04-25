'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'cessna_sids';
    const exists = await tableExists(queryInterface, table);

    if (!exists) {
      await queryInterface.createTable(table, {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        // ✅ Correct mapping
        sid_number: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        section_reference: {
          type: Sequelize.STRING,
        },

        // OPTIONAL: true ATA (future use)
        ata_chapter: {
          type: Sequelize.STRING,
        },

        title: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        // ✅ HOURS + MONTHS (NOT YEARS)
        initial_interval_hours: Sequelize.INTEGER,
        initial_interval_months: Sequelize.INTEGER,
        repeat_interval_hours: Sequelize.INTEGER,
        repeat_interval_months: Sequelize.INTEGER,

        inspection_operation: Sequelize.STRING,
        source_pdf: Sequelize.STRING,

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
    }

    // =========================================
    // NORMALIZE
    // =========================================
    await queryInterface.sequelize.query(`
      UPDATE ${table}
      SET sid_number = UPPER(sid_number),
          section_reference = UPPER(section_reference)
      WHERE sid_number IS NOT NULL;
    `);

    // =========================================
    // UNIQUE (IMPORTANT)
    // =========================================
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'unique_sid_number'
        ) THEN
          ALTER TABLE ${table}
          ADD CONSTRAINT unique_sid_number
          UNIQUE (sid_number);
        END IF;
      END
      $$;
    `);

    // =========================================
    // INDEXES
    // =========================================
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS cessna_sids_sid_number_idx
      ON ${table} (sid_number);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS cessna_sids_section_idx
      ON ${table} (section_reference);
    `);
  },

  async down(queryInterface) {
    const table = 'cessna_sids';

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS cessna_sids_sid_number_idx;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS cessna_sids_section_idx;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ${table}
      DROP CONSTRAINT IF EXISTS unique_sid_number;
    `);

    await queryInterface.dropTable(table).catch(() => {});
  },
};