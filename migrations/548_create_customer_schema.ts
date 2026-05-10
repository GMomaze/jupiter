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

export default {
  async up(queryInterface, Sequelize) {
    const customersTable = 'customers';
    const linksTable = 'customer_aircraft_links';

    if (!(await getTableDefinition(queryInterface, customersTable))) {
      await queryInterface.createTable(customersTable, {
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
        contact_person: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        phone: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        alternate_phone: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        billing_address_line_1: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        billing_address_line_2: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        billing_city: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        billing_state_or_province: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        billing_postal_code: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        billing_country: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        physical_address_line_1: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        physical_address_line_2: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        physical_city: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        physical_state_or_province: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        physical_postal_code: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        physical_country: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        vat_number: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        tax_number: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        account_reference: {
          type: Sequelize.STRING,
          allowNull: true,
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
    } else {
      await ensureColumn(queryInterface, customersTable, 'name', {
        type: Sequelize.STRING,
        allowNull: false,
      });
      await ensureColumn(queryInterface, customersTable, 'contact_person', {
        type: Sequelize.STRING,
        allowNull: false,
      });
      await ensureColumn(queryInterface, customersTable, 'email', {
        type: Sequelize.STRING,
        allowNull: false,
      });
      await ensureColumn(queryInterface, customersTable, 'phone', {
        type: Sequelize.STRING,
        allowNull: false,
      });
      await ensureColumn(queryInterface, customersTable, 'alternate_phone', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'billing_address_line_1', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'billing_address_line_2', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'billing_city', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'billing_state_or_province', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'billing_postal_code', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'billing_country', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'physical_address_line_1', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'physical_address_line_2', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'physical_city', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'physical_state_or_province', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'physical_postal_code', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'physical_country', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'vat_number', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'tax_number', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'account_reference', {
        type: Sequelize.STRING,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'status', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'ACTIVE',
      });
      await ensureColumn(queryInterface, customersTable, 'notes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      await ensureColumn(queryInterface, customersTable, 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
      await ensureColumn(queryInterface, customersTable, 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }

    await queryInterface.changeColumn(customersTable, 'name', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn(customersTable, 'contact_person', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn(customersTable, 'email', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn(customersTable, 'phone', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn(customersTable, 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'ACTIVE',
    });

    await ensureConstraint(
      queryInterface,
      customersTable,
      'customers_status_check',
      `ALTER TABLE ${customersTable}
       ADD CONSTRAINT customers_status_check
       CHECK (status IN ('ACTIVE', 'INACTIVE'))`
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customers_status_index
      ON ${customersTable} (status);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customers_name_index
      ON ${customersTable} (name);
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS customers_account_reference_unique
      ON ${customersTable} (account_reference)
      WHERE account_reference IS NOT NULL;
    `);

    if (!(await getTableDefinition(queryInterface, linksTable))) {
      await queryInterface.createTable(linksTable, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        customer_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: customersTable, key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        aircraft_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'aircraft', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        relationship_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        is_current: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        start_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        end_date: {
          type: Sequelize.DATEONLY,
          allowNull: true,
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
      await ensureColumn(queryInterface, linksTable, 'customer_id', {
        type: Sequelize.UUID,
        allowNull: false,
      });
      await ensureColumn(queryInterface, linksTable, 'aircraft_id', {
        type: Sequelize.UUID,
        allowNull: false,
      });
      await ensureColumn(queryInterface, linksTable, 'relationship_type', {
        type: Sequelize.STRING,
        allowNull: false,
      });
      await ensureColumn(queryInterface, linksTable, 'is_current', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
      await ensureColumn(queryInterface, linksTable, 'start_date', {
        type: Sequelize.DATEONLY,
        allowNull: false,
      });
      await ensureColumn(queryInterface, linksTable, 'end_date', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
      await ensureColumn(queryInterface, linksTable, 'notes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
      await ensureColumn(queryInterface, linksTable, 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
      await ensureColumn(queryInterface, linksTable, 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }

    await queryInterface.changeColumn(linksTable, 'customer_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: customersTable, key: 'id' },
      onUpdate: 'NO ACTION',
      onDelete: 'RESTRICT',
    });
    await queryInterface.changeColumn(linksTable, 'aircraft_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'aircraft', key: 'id' },
      onUpdate: 'NO ACTION',
      onDelete: 'RESTRICT',
    });
    await queryInterface.changeColumn(linksTable, 'relationship_type', {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn(linksTable, 'is_current', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.changeColumn(linksTable, 'start_date', {
      type: Sequelize.DATEONLY,
      allowNull: false,
    });

    await ensureConstraint(
      queryInterface,
      linksTable,
      'customer_aircraft_links_date_range_check',
      `ALTER TABLE ${linksTable}
       ADD CONSTRAINT customer_aircraft_links_date_range_check
       CHECK (end_date IS NULL OR end_date >= start_date)`
    );

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_aircraft_links_customer_id_index
      ON ${linksTable} (customer_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_aircraft_links_aircraft_id_index
      ON ${linksTable} (aircraft_id);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_aircraft_links_aircraft_current_index
      ON ${linksTable} (aircraft_id, is_current);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_aircraft_links_customer_current_index
      ON ${linksTable} (customer_id, is_current);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_aircraft_links_start_date_index
      ON ${linksTable} (start_date);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_aircraft_links_end_date_index
      ON ${linksTable} (end_date);
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS customer_aircraft_links_one_current_per_aircraft
      ON ${linksTable} (aircraft_id)
      WHERE is_current = true;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_aircraft_links_one_current_per_aircraft;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_aircraft_links_end_date_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_aircraft_links_start_date_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_aircraft_links_customer_current_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_aircraft_links_aircraft_current_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_aircraft_links_aircraft_id_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_aircraft_links_customer_id_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customers_account_reference_unique;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customers_name_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customers_status_index;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS customer_aircraft_links
      DROP CONSTRAINT IF EXISTS customer_aircraft_links_date_range_check;
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS customers
      DROP CONSTRAINT IF EXISTS customers_status_check;
    `);

    await queryInterface.dropTable('customer_aircraft_links').catch(() => undefined);
    await queryInterface.dropTable('customers').catch(() => undefined);
  },
};
