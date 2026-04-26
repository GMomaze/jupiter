'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'compliance_items';
    const exists = await tableExists(queryInterface, table);

    if (exists) {
      return;
    }

    await queryInterface.createTable(table, {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },

      item_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      code: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      authority: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      revision: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      issued_on: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      effective_on: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      source_table: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      source_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      compliance_basis: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'MANUAL',
      },

      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'ACTIVE',
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'compliance_items_item_type_code_unique'
        ) THEN
          ALTER TABLE compliance_items
          ADD CONSTRAINT compliance_items_item_type_code_unique
          UNIQUE (item_type, code);
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'compliance_items_item_type_check'
        ) THEN
          ALTER TABLE compliance_items
          ADD CONSTRAINT compliance_items_item_type_check
          CHECK (item_type IN ('AD', 'SB'));
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'compliance_items_compliance_basis_check'
        ) THEN
          ALTER TABLE compliance_items
          ADD CONSTRAINT compliance_items_compliance_basis_check
          CHECK (compliance_basis IN ('MANDATORY', 'RECOMMENDED', 'MANUAL'));
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'compliance_items_status_check'
        ) THEN
          ALTER TABLE compliance_items
          ADD CONSTRAINT compliance_items_status_check
          CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'CANCELLED', 'INACTIVE'));
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_items_item_type_index
      ON compliance_items (item_type);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_items_code_index
      ON compliance_items (code);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_items_status_index
      ON compliance_items (status);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_items_source_lookup_index
      ON compliance_items (source_table, source_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('compliance_items').catch(() => {});
  },
};
