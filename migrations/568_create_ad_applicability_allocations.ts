'use strict';

async function getTableDefinition(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
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
    const table = 'ad_applicability_allocations';

    if (!(await getTableDefinition(queryInterface, table))) {
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
        ad_number_snapshot: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        ad_revision_snapshot: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        source_make: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        source_model: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        source_product_type: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        source_product_subtype: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        source_key: {
          type: Sequelize.STRING(128),
          allowNull: false,
        },
        target_type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        target_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        matched_manufacturer_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'manufacturers',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },
        matched_component_model_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'component_models',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        classification: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        match_confidence: {
          type: Sequelize.SMALLINT,
          allowNull: true,
        },
        match_reason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        reviewed_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },
        reviewed_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        review_reason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        created_by: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
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
    }

    await ensureConstraint(
      queryInterface,
      table,
      'ad_applicability_allocations_target_type_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT ad_applicability_allocations_target_type_check
       CHECK (target_type IN ('MANUFACTURER', 'MODEL', 'BROAD_RULE', 'MANUAL_LINK', 'IGNORED', 'UNRESOLVED'))`
    );

    await ensureConstraint(
      queryInterface,
      table,
      'ad_applicability_allocations_status_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT ad_applicability_allocations_status_check
       CHECK (status IN ('SUGGESTED', 'ACCEPTED', 'NEEDS_REVIEW', 'IGNORED', 'RESTORED'))`
    );

    await ensureConstraint(
      queryInterface,
      table,
      'ad_applicability_allocations_classification_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT ad_applicability_allocations_classification_check
       CHECK (classification IN (
         'EXACT_MODEL_CODE',
         'EXACT_MODEL_NAME',
         'MANUFACTURER_MATCH',
         'BROAD_SERIES',
         'BROAD_ALL',
         'MULTI_MODEL_REVIEW',
         'MANUAL_MODEL_LINK',
         'MANUAL_MANUFACTURER_LINK',
         'UNRESOLVED_MAKE',
         'UNRESOLVED_MODEL',
         'IGNORED_BY_USER'
       ))`
    );

    await ensureConstraint(
      queryInterface,
      table,
      'ad_applicability_allocations_source_key_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT ad_applicability_allocations_source_key_check
       CHECK (length(trim(source_key)) > 0)`
    );

    await ensureConstraint(
      queryInterface,
      table,
      'ad_applicability_allocations_match_confidence_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT ad_applicability_allocations_match_confidence_check
       CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 100))`
    );

    await ensureConstraint(
      queryInterface,
      table,
      'ad_applicability_allocations_target_presence_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT ad_applicability_allocations_target_presence_check
       CHECK (
         (target_type = 'MODEL' AND (target_id IS NOT NULL OR matched_component_model_id IS NOT NULL))
         OR
         (target_type = 'MANUFACTURER' AND (target_id IS NOT NULL OR matched_manufacturer_id IS NOT NULL))
         OR
         (target_type NOT IN ('MODEL', 'MANUFACTURER'))
       )`
    );

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ad_applicability_allocations_source_unique
      ON ${table} (airworthiness_directive_id, source_key);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_applicability_allocations_ad_idx
      ON ${table} (airworthiness_directive_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_applicability_allocations_ad_number_idx
      ON ${table} (ad_number_snapshot);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_applicability_allocations_source_key_idx
      ON ${table} (source_key);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_applicability_allocations_target_type_idx
      ON ${table} (target_type);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_applicability_allocations_target_id_idx
      ON ${table} (target_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_applicability_allocations_status_idx
      ON ${table} (status);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_applicability_allocations_classification_idx
      ON ${table} (classification);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_applicability_allocations_manufacturer_idx
      ON ${table} (matched_manufacturer_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_applicability_allocations_component_model_idx
      ON ${table} (matched_component_model_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_applicability_allocations_reviewed_by_idx
      ON ${table} (reviewed_by);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_applicability_allocations_reviewed_at_idx
      ON ${table} (reviewed_at);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ad_applicability_allocations').catch(() => {});
  },
};
