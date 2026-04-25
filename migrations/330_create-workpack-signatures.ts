'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'workpack_signatures';
    const exists = await tableExists(queryInterface, table);

    // =========================================
    // CREATE TABLE (SAFE)
    // =========================================
    if (!exists) {
      await queryInterface.createTable(table, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },

        execution_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'workpack_executions',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },

        role: {
          type: Sequelize.STRING,
          allowNull: false,
        },

        signature_type: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'APPROVAL',
        },

        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },

        signed_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    // =========================================
    // UNIQUE CONSTRAINT (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_signatures_execution_id_role_signature_type_user_id_un'
        ) THEN
          ALTER TABLE workpack_signatures
          ADD CONSTRAINT workpack_signatures_execution_id_role_signature_type_user_id_un
          UNIQUE (execution_id, role, signature_type, user_id);
        END IF;
      END
      $$;
    `);

    // =========================================
    // CHECK CONSTRAINTS (SAFE + CORRECT)
    // =========================================
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_signatures_role_check'
        ) THEN
          ALTER TABLE workpack_signatures
          ADD CONSTRAINT workpack_signatures_role_check
          CHECK (role IN ('MECHANIC', 'ENGINEER'));
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_signatures_type_check'
        ) THEN
          ALTER TABLE workpack_signatures
          ADD CONSTRAINT workpack_signatures_type_check
          CHECK (signature_type IN ('WORK', 'REVIEW', 'APPROVAL'));
        END IF;
      END
      $$;
    `);

    // =========================================
    // INDEXES (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_signatures_execution_id_index
      ON workpack_signatures (execution_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_signatures_role_index
      ON workpack_signatures (role);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_signatures_signature_type_index
      ON workpack_signatures (signature_type);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_signatures_user_id_index
      ON workpack_signatures (user_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('workpack_signatures').catch(() => {});
  },
};