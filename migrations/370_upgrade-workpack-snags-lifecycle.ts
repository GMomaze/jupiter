'use strict';

export default {
  async up(queryInterface, Sequelize) {
    const table = 'workpack_snags';

    // =========================================
    // 1. BACKFILL DATA (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      UPDATE ${table}
      SET resolved_at = COALESCE(resolved_at, updated_at)
      WHERE status = 'RESOLVED' AND resolved_at IS NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE ${table}
      SET closed_at = COALESCE(closed_at, updated_at)
      WHERE status = 'CLOSED' AND closed_at IS NULL;
    `);

    // =========================================
    // 2. REPLACE CONSTRAINT SAFELY
    // =========================================
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        -- Drop old constraint if exists
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_snags_status_check'
        ) THEN
          ALTER TABLE ${table}
          DROP CONSTRAINT workpack_snags_status_check;
        END IF;

        -- Add new constraint
        ALTER TABLE ${table}
        ADD CONSTRAINT workpack_snags_status_check
        CHECK (
          status = 'OPEN'
          OR (
            status = 'IN_PROGRESS'
            AND started_at IS NOT NULL
          )
          OR (
            status = 'RESOLVED'
            AND started_at IS NOT NULL
            AND resolved_at IS NOT NULL
          )
          OR (
            status = 'CLOSED'
            AND started_at IS NOT NULL
            AND resolved_at IS NOT NULL
            AND closed_at IS NOT NULL
          )
        );
      END
      $$;
    `);

    // =========================================
    // 3. INDEX (SAFE)
    // =========================================
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS workpack_snags_status_workpack_idx
      ON ${table} (status, workpack_id);
    `);
  },

  async down(queryInterface) {
    const table = 'workpack_snags';

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS workpack_snags_status_workpack_idx;
    `);

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'workpack_snags_status_check'
        ) THEN
          ALTER TABLE ${table}
          DROP CONSTRAINT workpack_snags_status_check;
        END IF;

        ALTER TABLE ${table}
        ADD CONSTRAINT workpack_snags_status_check
        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'));
      END
      $$;
    `);
  },
};