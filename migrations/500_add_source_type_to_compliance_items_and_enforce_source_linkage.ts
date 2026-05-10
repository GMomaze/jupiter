'use strict';

async function getTableDefinition(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

async function getComplianceItemRowCount(queryInterface) {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT COUNT(*)::int AS count FROM compliance_items'
  );

  return Number(rows?.[0]?.count || 0);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'compliance_items';
    const definition = await getTableDefinition(queryInterface, table);

    if (!definition) {
      throw new Error('compliance_items table does not exist.');
    }

    const rowCount = await getComplianceItemRowCount(queryInterface);
    const hasSourceType = Boolean(definition.source_type);
    const hasSourceId = Boolean(definition.source_id);

    if (!hasSourceType) {
      await queryInterface.addColumn(table, 'source_type', {
        type: Sequelize.STRING,
        allowNull: rowCount > 0,
      });
    }

    if (!hasSourceId) {
      await queryInterface.addColumn(table, 'source_id', {
        type: Sequelize.UUID,
        allowNull: rowCount > 0,
      });
    } else if (rowCount === 0 && definition.source_id.allowNull) {
      await queryInterface.changeColumn(table, 'source_id', {
        type: Sequelize.UUID,
        allowNull: false,
      });
    }

    if (rowCount === 0) {
      await queryInterface.changeColumn(table, 'source_type', {
        type: Sequelize.STRING,
        allowNull: false,
      });
    }

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'compliance_items_source_type_check'
        ) THEN
          ALTER TABLE compliance_items
          ADD CONSTRAINT compliance_items_source_type_check
          CHECK (source_type IN ('AD', 'SB'));
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'compliance_items_source_type_source_id_unique'
        ) THEN
          ALTER TABLE compliance_items
          ADD CONSTRAINT compliance_items_source_type_source_id_unique
          UNIQUE (source_type, source_id);
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_items_source_type_index
      ON compliance_items (source_type);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_items_source_id_index
      ON compliance_items (source_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS compliance_items_source_type_source_id_index
      ON compliance_items (source_type, source_id);
    `);
  },

  async down(queryInterface, Sequelize) {
    const table = 'compliance_items';
    const definition = await getTableDefinition(queryInterface, table);

    if (!definition) {
      return;
    }

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS compliance_items_source_type_source_id_index;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS compliance_items_source_id_index;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS compliance_items_source_type_index;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE compliance_items
      DROP CONSTRAINT IF EXISTS compliance_items_source_type_source_id_unique;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE compliance_items
      DROP CONSTRAINT IF EXISTS compliance_items_source_type_check;
    `);

    if (definition.source_type) {
      await queryInterface.removeColumn(table, 'source_type');
    }

    if (definition.source_id) {
      await queryInterface.changeColumn(table, 'source_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
  },
};
