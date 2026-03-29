import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
    RETURNS trigger AS $$
    BEGIN
      -- Only set updated_at if the column exists
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = TG_TABLE_NAME
          AND column_name = 'updated_at'
      ) THEN
        NEW.updated_at = NOW();
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP FUNCTION IF EXISTS public.fn_audit_trigger CASCADE;
  `);
}