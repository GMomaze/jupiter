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
    const table = 'sb_model_applicability_allocations';

    if (!(await getTableDefinition(queryInterface, table))) {
      await queryInterface.createTable(table, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        service_bulletin_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'service_bulletins',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        raw_models_affected_text: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        parsed_token: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        normalized_token: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        classification: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        matched_model_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'component_models',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },
        allocated_model_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'component_models',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },
        created_model_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'component_models',
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'SET NULL',
        },
        source_row: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        source_column: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        source_adapter: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        source_hash: {
          type: Sequelize.STRING(64),
          allowNull: false,
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
        review_notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        ignored_reason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        parsed_tokens: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        matched_models: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        unmatched_tokens: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        shorthand_expansions: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
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
      'sb_model_applicability_allocations_status_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT sb_model_applicability_allocations_status_check
       CHECK (status IN ('MATCHED', 'NEEDS_REVIEW', 'LINKED_MANUALLY', 'MODEL_CREATED_INCOMPLETE', 'BROAD_RULE_MARKED', 'IGNORED'))`
    );

    await ensureConstraint(
      queryInterface,
      table,
      'sb_model_applicability_allocations_classification_check',
      `ALTER TABLE ${table}
       ADD CONSTRAINT sb_model_applicability_allocations_classification_check
       CHECK (classification IN ('EXACT_MODEL_CODE', 'SHORTHAND_GROUP', 'BROAD_APPLICABILITY', 'AMBIGUOUS_PHRASE', 'UNPARSED_TEXT'))`
    );

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sb_model_applicability_allocations_source_unique
      ON ${table} (service_bulletin_id, source_hash);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS sb_model_applicability_allocations_sb_idx
      ON ${table} (service_bulletin_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS sb_model_applicability_allocations_status_idx
      ON ${table} (status);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS sb_model_applicability_allocations_classification_idx
      ON ${table} (classification);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS sb_model_applicability_allocations_matched_model_idx
      ON ${table} (matched_model_id);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS sb_model_applicability_allocations_allocated_model_idx
      ON ${table} (allocated_model_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sb_model_applicability_allocations').catch(() => {});
  },
};
