'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

async function constraintExists(queryInterface, tableName, constraintName) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_name = :tableName
        AND constraint_name = :constraintName
      LIMIT 1
    `,
    {
      replacements: { tableName, constraintName },
      raw: true,
    }
  );

  return Array.isArray(rows) && rows.length > 0;
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'workpack_snags';
    const exists = await tableExists(queryInterface, table);

    if (!exists) {
      return;
    }

    const definition = await queryInterface.describeTable(table);

    if (!definition.aircraft_id) {
      await queryInterface.addColumn(table, 'aircraft_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'aircraft',
          key: 'id',
        },
        onDelete: 'RESTRICT',
      });
    }

    if (!definition.component_id) {
      await queryInterface.addColumn(table, 'component_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'aircraft_components',
          key: 'id',
        },
        onDelete: 'SET NULL',
      });
    }

    if (!definition.defect_text) {
      await queryInterface.addColumn(table, 'defect_text', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE workpack_snags ws
      SET aircraft_id = w.aircraft_id
      FROM workpacks w
      WHERE ws.workpack_id = w.id
        AND ws.aircraft_id IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE workpack_snags
      SET defect_text = COALESCE(NULLIF(trim(defect_text), ''), description)
      WHERE defect_text IS NULL
         OR trim(defect_text) = '';
    `);

    await queryInterface.changeColumn(table, 'aircraft_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'aircraft',
        key: 'id',
      },
      onDelete: 'RESTRICT',
    });

    await queryInterface.changeColumn(table, 'defect_text', {
      type: Sequelize.TEXT,
      allowNull: false,
    });

    await queryInterface.changeColumn(table, 'workpack_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'workpacks',
        key: 'id',
      },
      onDelete: 'CASCADE',
    });

    if (!(await constraintExists(queryInterface, table, 'workpack_snags_aircraft_component_match_check'))) {
      await queryInterface.sequelize.query(`
        ALTER TABLE workpack_snags
        ADD CONSTRAINT workpack_snags_aircraft_component_match_check
        CHECK (
          component_id IS NULL
          OR aircraft_id IS NOT NULL
        );
      `);
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_snags_aircraft_id_index
      ON workpack_snags (aircraft_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_snags_component_id_index
      ON workpack_snags (component_id);
    `);
  },

  async down(queryInterface, Sequelize) {
    const table = 'workpack_snags';
    const exists = await tableExists(queryInterface, table);

    if (!exists) {
      return;
    }

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS workpack_snags_component_id_index;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS workpack_snags_aircraft_id_index;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE workpack_snags
      DROP CONSTRAINT IF EXISTS workpack_snags_aircraft_component_match_check;
    `);

    await queryInterface.changeColumn(table, 'workpack_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'workpacks',
        key: 'id',
      },
      onDelete: 'CASCADE',
    });

    if ((await queryInterface.describeTable(table)).defect_text) {
      await queryInterface.removeColumn(table, 'defect_text');
    }

    if ((await queryInterface.describeTable(table)).component_id) {
      await queryInterface.removeColumn(table, 'component_id');
    }

    if ((await queryInterface.describeTable(table)).aircraft_id) {
      await queryInterface.removeColumn(table, 'aircraft_id');
    }
  },
};
