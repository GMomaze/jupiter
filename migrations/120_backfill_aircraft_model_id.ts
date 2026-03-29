import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    DO $$
    BEGIN
        -- Ensure column exists before attempting update
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'aircraft'
              AND column_name = 'model_id'
        ) THEN

            -- Backfill model_id using component_models
            UPDATE aircraft a
            SET model_id = cm.id
            FROM component_models cm
            WHERE a.model = cm.model_name
              AND a.model_id IS NULL;

        END IF;
    END
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DO $$
    BEGIN
        -- Only run if column exists
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'aircraft'
              AND column_name = 'model_id'
        ) THEN

            -- Revert backfill (set back to NULL)
            UPDATE aircraft
            SET model_id = NULL;

        END IF;
    END
    $$;
  `);
}