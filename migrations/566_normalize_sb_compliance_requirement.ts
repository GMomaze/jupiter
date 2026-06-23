async function tableExists(queryInterface: any, tableName: string) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function columnExists(queryInterface: any, tableName: string, columnName: string) {
  try {
    const table = await queryInterface.describeTable(tableName);
    return Boolean(table[columnName]);
  } catch {
    return false;
  }
}

export default {
  async up(queryInterface: any, Sequelize: any) {
    if (await tableExists(queryInterface, 'service_bulletins')) {
      if (await columnExists(queryInterface, 'service_bulletins', 'compliance_requirement')) {
        await queryInterface.sequelize.query(`
          UPDATE service_bulletins
          SET compliance_requirement = 'REQUIRED'
          WHERE compliance_requirement IS NULL
             OR BTRIM(compliance_requirement) = ''
             OR UPPER(BTRIM(compliance_requirement)) = 'MANUAL'
        `);

        await queryInterface.changeColumn('service_bulletins', 'compliance_requirement', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'REQUIRED',
        });
      }

      if (await columnExists(queryInterface, 'service_bulletins', 'compliance_type')) {
        await queryInterface.sequelize.query(`
          UPDATE service_bulletins
          SET compliance_type = 'REQUIRED'
          WHERE compliance_type IS NULL
             OR BTRIM(compliance_type) = ''
             OR UPPER(BTRIM(compliance_type)) = 'MANUAL'
        `);

        await queryInterface.changeColumn('service_bulletins', 'compliance_type', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'REQUIRED',
        });
      }
    }

    if (
      (await tableExists(queryInterface, 'compliance_items')) &&
      (await columnExists(queryInterface, 'compliance_items', 'compliance_basis'))
    ) {
      await queryInterface.sequelize.query(`
        DO $$
        DECLARE constraint_record RECORD;
        BEGIN
          FOR constraint_record IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'compliance_items'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%compliance_basis%'
          LOOP
            EXECUTE format('ALTER TABLE compliance_items DROP CONSTRAINT %I', constraint_record.conname);
          END LOOP;
        END $$;
      `);

      await queryInterface.sequelize.query(`
        ALTER TABLE compliance_items
        ADD CONSTRAINT compliance_items_compliance_basis_check
        CHECK (compliance_basis IN ('MANDATORY', 'RECOMMENDED', 'MANUAL', 'REQUIRED'))
      `);
    }
  },

  async down(queryInterface: any, Sequelize: any) {
    if (await tableExists(queryInterface, 'service_bulletins')) {
      if (await columnExists(queryInterface, 'service_bulletins', 'compliance_requirement')) {
        await queryInterface.changeColumn('service_bulletins', 'compliance_requirement', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'MANUAL',
        });
      }

      if (await columnExists(queryInterface, 'service_bulletins', 'compliance_type')) {
        await queryInterface.changeColumn('service_bulletins', 'compliance_type', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'MANUAL',
        });
      }
    }
  },
};
