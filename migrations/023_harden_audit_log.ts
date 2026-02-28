import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {

  // Revoke mutation privileges
  await knex.raw(`
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM jupiter_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM jupiter_test;
  `);

  // Ensure only SELECT + INSERT remain
  await knex.raw(`
    GRANT SELECT, INSERT ON audit_log TO jupiter_app;
    GRANT SELECT, INSERT ON audit_log TO jupiter_test;
  `);

  // Create trigger function as SECURITY DEFINER
  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE';
    END;
    $$;
  `);

  // Attach triggers
  await knex.raw(`
    DROP TRIGGER IF EXISTS audit_block_update ON audit_log;
    CREATE TRIGGER audit_block_update
    BEFORE UPDATE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_mutation();
  `);

  await knex.raw(`
    DROP TRIGGER IF EXISTS audit_block_delete ON audit_log;
    CREATE TRIGGER audit_block_delete
    BEFORE DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_mutation();
  `);
}

export async function down(knex: Knex): Promise<void> {

  await knex.raw(`
    DROP TRIGGER IF EXISTS audit_block_update ON audit_log;
    DROP TRIGGER IF EXISTS audit_block_delete ON audit_log;
    DROP FUNCTION IF EXISTS public.prevent_audit_mutation();
  `);

  await knex.raw(`
    GRANT UPDATE, DELETE ON audit_log TO jupiter_app;
    GRANT UPDATE, DELETE ON audit_log TO jupiter_test;
  `);
}