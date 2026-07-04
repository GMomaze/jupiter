'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const table = 'ad_service_bulletin_references';

    if (!(await tableExists(queryInterface, table))) {
      await queryInterface.createTable(table, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        airworthiness_directive_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'airworthiness_directives',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        raw_reference_text: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        normalized_reference_text: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        matched_service_bulletin_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'service_bulletins',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },
        match_status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'UNRESOLVED',
        },
        match_reason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        source_context: {
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
    }

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'ad_sb_references_status_check'
        ) THEN
          ALTER TABLE ad_service_bulletin_references
          ADD CONSTRAINT ad_sb_references_status_check
          CHECK (match_status IN ('UNRESOLVED', 'MATCHED', 'IGNORED'));
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'ad_sb_references_ad_normalized_unique'
        ) THEN
          ALTER TABLE ad_service_bulletin_references
          ADD CONSTRAINT ad_sb_references_ad_normalized_unique
          UNIQUE (airworthiness_directive_id, normalized_reference_text);
        END IF;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_sb_references_ad_id_index
      ON ad_service_bulletin_references (airworthiness_directive_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_sb_references_matched_sb_id_index
      ON ad_service_bulletin_references (matched_service_bulletin_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_sb_references_match_status_index
      ON ad_service_bulletin_references (match_status);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_sb_references_normalized_text_index
      ON ad_service_bulletin_references (normalized_reference_text);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ad_service_bulletin_references').catch(() => {});
  },
};
