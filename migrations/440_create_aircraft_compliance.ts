'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'aircraft_compliance';
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

      aircraft_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'aircraft',
          key: 'id',
        },
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },

      compliance_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'compliance_items',
          key: 'id',
        },
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      },

      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'DUE',
      },

      last_complied_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      next_due_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      last_complied_hours: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },

      next_due_hours: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },

      compliance_method: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      complied_workpack_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'workpacks',
          key: 'id',
        },
        onUpdate: 'NO ACTION',
        onDelete: 'SET NULL',
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
          WHERE constraint_name = 'aircraft_compliance_aircraft_item_unique'
        ) THEN
          ALTER TABLE aircraft_compliance
          ADD CONSTRAINT aircraft_compliance_aircraft_item_unique
          UNIQUE (aircraft_id, compliance_item_id);
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'aircraft_compliance_status_check'
        ) THEN
          ALTER TABLE aircraft_compliance
          ADD CONSTRAINT aircraft_compliance_status_check
          CHECK (status IN ('DUE', 'IN_PROGRESS', 'COMPLIANT', 'NOT_APPLICABLE'));
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS aircraft_compliance_aircraft_id_index
      ON aircraft_compliance (aircraft_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS aircraft_compliance_compliance_item_id_index
      ON aircraft_compliance (compliance_item_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS aircraft_compliance_status_index
      ON aircraft_compliance (status);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS aircraft_compliance_complied_workpack_id_index
      ON aircraft_compliance (complied_workpack_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('aircraft_compliance').catch(() => {});
  },
};
