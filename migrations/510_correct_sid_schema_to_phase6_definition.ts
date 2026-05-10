'use strict';

async function getTableDefinition(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

async function ensureColumn(queryInterface, Sequelize, table, column, definition) {
  const tableDefinition = await getTableDefinition(queryInterface, table);

  if (!tableDefinition) {
    throw new Error(`Table ${table} does not exist.`);
  }

  if (!tableDefinition[column]) {
    await queryInterface.addColumn(table, column, definition);
  }
}

export default {
  async up(queryInterface, Sequelize) {
    const sidTable = 'supplemental_inspection_documents';
    const applicabilityTable = 'sid_model_applicability';
    const legacySidTable = 'cessna_sids';
    const legacyApplicabilityTable = 'model_sids';

    if (!(await getTableDefinition(queryInterface, sidTable))) {
      await queryInterface.createTable(sidTable, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        manufacturer: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        reference: {
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
        category: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        section_reference: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        ata_chapter: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        initial_interval_hours: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        initial_interval_months: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        repeat_interval_hours: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        repeat_interval_months: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        inspection_operation: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        source_document: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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
      await ensureColumn(queryInterface, Sequelize, sidTable, 'manufacturer', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'reference', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'title', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'description', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'category', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'section_reference', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'ata_chapter', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'initial_interval_hours', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'initial_interval_months', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'repeat_interval_hours', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'repeat_interval_months', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'inspection_operation', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'notes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'source_document', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
      await ensureColumn(queryInterface, Sequelize, sidTable, 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }

    await queryInterface.changeColumn(sidTable, 'manufacturer', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn(sidTable, 'reference', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn(sidTable, 'title', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'supplemental_inspection_documents_manufacturer_reference_unique'
        ) THEN
          ALTER TABLE supplemental_inspection_documents
          ADD CONSTRAINT supplemental_inspection_documents_manufacturer_reference_unique
          UNIQUE (manufacturer, reference);
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS supplemental_inspection_documents_manufacturer_index
      ON supplemental_inspection_documents (manufacturer);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS supplemental_inspection_documents_reference_index
      ON supplemental_inspection_documents (reference);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS supplemental_inspection_documents_category_index
      ON supplemental_inspection_documents (category);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS supplemental_inspection_documents_is_active_index
      ON supplemental_inspection_documents (is_active);
    `);

    if (!(await getTableDefinition(queryInterface, applicabilityTable))) {
      await queryInterface.createTable(applicabilityTable, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        sid_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: sidTable,
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        model_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'component_models',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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
      await ensureColumn(queryInterface, Sequelize, applicabilityTable, 'sid_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, applicabilityTable, 'model_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
      await ensureColumn(queryInterface, Sequelize, applicabilityTable, 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
      await ensureColumn(queryInterface, Sequelize, applicabilityTable, 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
      await ensureColumn(queryInterface, Sequelize, applicabilityTable, 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }

    await queryInterface.changeColumn(applicabilityTable, 'sid_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: sidTable,
        key: 'id',
      },
      onUpdate: 'NO ACTION',
      onDelete: 'CASCADE',
    });
    await queryInterface.changeColumn(applicabilityTable, 'model_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'component_models',
        key: 'id',
      },
      onUpdate: 'NO ACTION',
      onDelete: 'CASCADE',
    });

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'sid_model_applicability_sid_id_model_id_unique'
        ) THEN
          ALTER TABLE sid_model_applicability
          ADD CONSTRAINT sid_model_applicability_sid_id_model_id_unique
          UNIQUE (sid_id, model_id);
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS sid_model_applicability_sid_id_index
      ON sid_model_applicability (sid_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS sid_model_applicability_model_id_index
      ON sid_model_applicability (model_id);
    `);

    const legacySidDefinition = await getTableDefinition(queryInterface, legacySidTable);
    const legacyApplicabilityDefinition = await getTableDefinition(queryInterface, legacyApplicabilityTable);

    if (legacySidDefinition) {
      await queryInterface.sequelize.query(`
        INSERT INTO supplemental_inspection_documents (
          id,
          manufacturer,
          reference,
          title,
          description,
          category,
          section_reference,
          ata_chapter,
          initial_interval_hours,
          initial_interval_months,
          repeat_interval_hours,
          repeat_interval_months,
          inspection_operation,
          notes,
          source_document,
          is_active,
          created_at,
          updated_at
        )
        SELECT
          id,
          'Cessna',
          sid_number,
          title,
          NULL,
          NULL,
          section_reference,
          ata_chapter,
          initial_interval_hours,
          initial_interval_months,
          repeat_interval_hours,
          repeat_interval_months,
          inspection_operation,
          NULL,
          source_pdf,
          TRUE,
          COALESCE(created_at, CURRENT_TIMESTAMP),
          COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
        FROM cessna_sids
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    if (legacyApplicabilityDefinition) {
      await queryInterface.sequelize.query(`
        INSERT INTO sid_model_applicability (
          id,
          sid_id,
          model_id,
          is_active,
          created_at,
          updated_at
        )
        SELECT
          ms.id,
          ms.sid_id,
          ms.model_id,
          COALESCE(ms.is_active, TRUE),
          COALESCE(ms.created_at, CURRENT_TIMESTAMP),
          COALESCE(ms.created_at, CURRENT_TIMESTAMP)
        FROM model_sids ms
        INNER JOIN supplemental_inspection_documents sid
          ON sid.id = ms.sid_id
        ON CONFLICT (sid_id, model_id) DO NOTHING;
      `);
    }
  },

  async down() {
    return;
  },
};
