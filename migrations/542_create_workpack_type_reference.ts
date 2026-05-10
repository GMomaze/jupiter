'use strict';

async function tableExists(queryInterface, tableName) {
  return await queryInterface.describeTable(tableName).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const hasTypeTable = await tableExists(queryInterface, 'rf_workpack_type');

    if (!hasTypeTable) {
      await queryInterface.createTable('rf_workpack_type', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        code: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },

        label: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        description: {
          type: Sequelize.TEXT,
        },

        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },

        system_locked: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },

        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS rf_workpack_type_code_idx
      ON rf_workpack_type (code);
    `);

    await queryInterface.sequelize.query(
      `
        INSERT INTO rf_workpack_type (
          id,
          code,
          label,
          description,
          is_active,
          system_locked,
          created_at
        )
        SELECT
          gen_random_uuid(),
          'SNAG',
          'Snag',
          'Manual, defect-driven workpack classification independent of templates',
          TRUE,
          FALSE,
          CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
          SELECT 1
          FROM rf_workpack_type
          WHERE code = 'SNAG'
        );
      `,
      { raw: true }
    );
  },

  async down() {
    // Intentionally no-op to avoid deleting reference data once introduced.
  },
};
