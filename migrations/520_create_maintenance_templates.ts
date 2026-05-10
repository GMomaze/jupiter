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

async function ensureForeignKey(queryInterface, table, constraintName, sql) {
  await ensureConstraint(queryInterface, table, constraintName, sql);
}

export default {
  async up(queryInterface, Sequelize) {
    const templateTable = 'maintenance_templates';
    const itemTable = 'maintenance_template_items';

    if (!(await getTableDefinition(queryInterface, templateTable))) {
      await queryInterface.createTable(templateTable, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        template_type: {
          type: Sequelize.STRING,
          allowNull: false,
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
        interval_hours: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        interval_months: {
          type: Sequelize.INTEGER,
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
      await ensureColumn(queryInterface, templateTable, 'name', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, templateTable, 'description', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      await ensureColumn(queryInterface, templateTable, 'template_type', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, templateTable, 'model_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
      await ensureColumn(queryInterface, templateTable, 'interval_hours', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await ensureColumn(queryInterface, templateTable, 'interval_months', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await ensureColumn(queryInterface, templateTable, 'is_active', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
      await ensureColumn(queryInterface, templateTable, 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
      await ensureColumn(queryInterface, templateTable, 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }

    await queryInterface.changeColumn(templateTable, 'name', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn(templateTable, 'template_type', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn(templateTable, 'model_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
    await queryInterface.changeColumn(templateTable, 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await ensureConstraint(
      queryInterface,
      templateTable,
      'maintenance_templates_template_type_check',
      `ALTER TABLE ${templateTable}
       ADD CONSTRAINT maintenance_templates_template_type_check
       CHECK (template_type IN ('MPI', 'ANNUAL', 'CUSTOM'))`
    );

    await ensureConstraint(
      queryInterface,
      templateTable,
      'maintenance_templates_model_id_name_unique',
      `ALTER TABLE ${templateTable}
       ADD CONSTRAINT maintenance_templates_model_id_name_unique
       UNIQUE (model_id, name)`
    );

    await ensureForeignKey(
      queryInterface,
      templateTable,
      'maintenance_templates_model_id_fkey',
      `ALTER TABLE ${templateTable}
       ADD CONSTRAINT maintenance_templates_model_id_fkey
       FOREIGN KEY (model_id)
       REFERENCES component_models(id)
       ON UPDATE NO ACTION
       ON DELETE CASCADE`
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS maintenance_templates_model_id_index
      ON ${templateTable} (model_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS maintenance_templates_template_type_index
      ON ${templateTable} (template_type);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS maintenance_templates_is_active_index
      ON ${templateTable} (is_active);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS maintenance_templates_interval_hours_index
      ON ${templateTable} (interval_hours);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS maintenance_templates_interval_months_index
      ON ${templateTable} (interval_months);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS maintenance_templates_model_active_index
      ON ${templateTable} (model_id, is_active);
    `);

    if (!(await getTableDefinition(queryInterface, itemTable))) {
      await queryInterface.createTable(itemTable, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        template_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: templateTable,
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        item_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        item_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        sequence_no: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        is_required: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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
    } else {
      await ensureColumn(queryInterface, itemTable, 'template_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
      await ensureColumn(queryInterface, itemTable, 'item_type', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, itemTable, 'item_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
      await ensureColumn(queryInterface, itemTable, 'sequence_no', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await ensureColumn(queryInterface, itemTable, 'is_required', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
      await ensureColumn(queryInterface, itemTable, 'notes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      await ensureColumn(queryInterface, itemTable, 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
      await ensureColumn(queryInterface, itemTable, 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }

    await queryInterface.changeColumn(itemTable, 'template_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
    await queryInterface.changeColumn(itemTable, 'item_type', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn(itemTable, 'item_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
    await queryInterface.changeColumn(itemTable, 'sequence_no', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
    await queryInterface.changeColumn(itemTable, 'is_required', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await ensureConstraint(
      queryInterface,
      itemTable,
      'maintenance_template_items_item_type_check',
      `ALTER TABLE ${itemTable}
       ADD CONSTRAINT maintenance_template_items_item_type_check
       CHECK (item_type IN ('STANDARD_TASK', 'COMPLIANCE_ITEM', 'SID'))`
    );

    await ensureConstraint(
      queryInterface,
      itemTable,
      'maintenance_template_items_template_id_sequence_no_unique',
      `ALTER TABLE ${itemTable}
       ADD CONSTRAINT maintenance_template_items_template_id_sequence_no_unique
       UNIQUE (template_id, sequence_no)`
    );

    await ensureConstraint(
      queryInterface,
      itemTable,
      'maintenance_template_items_template_item_unique',
      `ALTER TABLE ${itemTable}
       ADD CONSTRAINT maintenance_template_items_template_item_unique
       UNIQUE (template_id, item_type, item_id)`
    );

    await ensureForeignKey(
      queryInterface,
      itemTable,
      'maintenance_template_items_template_id_fkey',
      `ALTER TABLE ${itemTable}
       ADD CONSTRAINT maintenance_template_items_template_id_fkey
       FOREIGN KEY (template_id)
       REFERENCES ${templateTable}(id)
       ON UPDATE NO ACTION
       ON DELETE CASCADE`
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS maintenance_template_items_template_id_index
      ON ${itemTable} (template_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS maintenance_template_items_item_type_index
      ON ${itemTable} (item_type);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS maintenance_template_items_item_id_index
      ON ${itemTable} (item_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS maintenance_template_items_sequence_no_index
      ON ${itemTable} (sequence_no);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS maintenance_template_items_is_required_index
      ON ${itemTable} (is_required);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS maintenance_template_items_item_lookup_index
      ON ${itemTable} (item_type, item_id);
    `);
  },

  async down() {
    return;
  },
};
