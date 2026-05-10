'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

async function columnExists(queryInterface, table, column) {
  const definition = await queryInterface.describeTable(table).catch(() => null);
  return !!definition && !!definition[column];
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'service_bulletins';
    const exists = await tableExists(queryInterface, table);

    if (!exists) {
      await queryInterface.createTable(table, {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        manufacturer: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'UNKNOWN',
        },
        reference: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        issue_date: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        revision: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'ACTIVE',
        },
        category: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        applicability_make: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        applicability_model: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        applicability_product_type: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        applicability_notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        summary: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        compliance_requirement: {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'MANUAL',
        },
        source_file: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        source_format: {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'MANUAL',
        },
        raw_source_text: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    } else {
      if (!(await columnExists(queryInterface, table, 'manufacturer'))) {
        await queryInterface.addColumn(table, 'manufacturer', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'UNKNOWN',
        });
      }

      if (!(await columnExists(queryInterface, table, 'reference'))) {
        await queryInterface.addColumn(table, 'reference', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }

      if (!(await columnExists(queryInterface, table, 'issue_date'))) {
        await queryInterface.addColumn(table, 'issue_date', {
          type: Sequelize.DATEONLY,
          allowNull: true,
        });
      }

      if (!(await columnExists(queryInterface, table, 'category'))) {
        await queryInterface.addColumn(table, 'category', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }

      if (!(await columnExists(queryInterface, table, 'applicability_make'))) {
        await queryInterface.addColumn(table, 'applicability_make', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }

      if (!(await columnExists(queryInterface, table, 'applicability_model'))) {
        await queryInterface.addColumn(table, 'applicability_model', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }

      if (!(await columnExists(queryInterface, table, 'applicability_product_type'))) {
        await queryInterface.addColumn(table, 'applicability_product_type', {
          type: Sequelize.STRING,
          allowNull: true,
        });
      }

      if (!(await columnExists(queryInterface, table, 'applicability_notes'))) {
        await queryInterface.addColumn(table, 'applicability_notes', {
          type: Sequelize.TEXT,
          allowNull: true,
        });
      }

      if (!(await columnExists(queryInterface, table, 'summary'))) {
        await queryInterface.addColumn(table, 'summary', {
          type: Sequelize.TEXT,
          allowNull: true,
        });
      }

      if (!(await columnExists(queryInterface, table, 'compliance_requirement'))) {
        await queryInterface.addColumn(table, 'compliance_requirement', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'MANUAL',
        });
      }

      if (!(await columnExists(queryInterface, table, 'source_file'))) {
        await queryInterface.addColumn(table, 'source_file', {
          type: Sequelize.TEXT,
          allowNull: true,
        });
      }

      if (!(await columnExists(queryInterface, table, 'source_format'))) {
        await queryInterface.addColumn(table, 'source_format', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'MANUAL',
        });
      }

      if (!(await columnExists(queryInterface, table, 'raw_source_text'))) {
        await queryInterface.addColumn(table, 'raw_source_text', {
          type: Sequelize.TEXT,
          allowNull: true,
        });
      }

      if (!(await columnExists(queryInterface, table, 'is_active'))) {
        await queryInterface.addColumn(table, 'is_active', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        });
      }
    }

    await queryInterface.sequelize.query(`
      UPDATE service_bulletins
      SET
        manufacturer = COALESCE(NULLIF(manufacturer, ''), NULLIF(source_primary, ''), 'UNKNOWN'),
        reference = COALESCE(NULLIF(reference, ''), NULLIF(sb_number, ''), 'UNSPECIFIED'),
        issue_date = COALESCE(issue_date, issued_on),
        summary = COALESCE(summary, description),
        compliance_requirement = COALESCE(NULLIF(compliance_requirement, ''), NULLIF(compliance_type, ''), 'MANUAL'),
        source_file = COALESCE(source_file, document_url),
        source_format = COALESCE(NULLIF(source_format, ''), NULLIF(source_primary, ''), 'MANUAL'),
        raw_source_text = COALESCE(raw_source_text, description),
        is_active = COALESCE(is_active, CASE WHEN status = 'ACTIVE' THEN true ELSE false END, true)
    `);

    await queryInterface.changeColumn(table, 'manufacturer', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'UNKNOWN',
    });

    await queryInterface.changeColumn(table, 'reference', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.changeColumn(table, 'title', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'service_bulletins_manufacturer_reference_revision_unique'
        ) THEN
          ALTER TABLE service_bulletins
          ADD CONSTRAINT service_bulletins_manufacturer_reference_revision_unique
          UNIQUE (manufacturer, reference, revision);
        END IF;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS service_bulletins_manufacturer_idx
      ON service_bulletins (manufacturer);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS service_bulletins_reference_idx
      ON service_bulletins (reference);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS service_bulletins_issue_date_idx
      ON service_bulletins (issue_date);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS service_bulletins_status_phase5_idx
      ON service_bulletins (status);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS service_bulletins_applicability_make_idx
      ON service_bulletins (applicability_make);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS service_bulletins_applicability_model_idx
      ON service_bulletins (applicability_model);
    `);
  },

  async down() {
    // Intentionally non-destructive for Phase 5.3 alignment work.
  },
};
