import type { Knex } from 'knex';

/**
 * Phase 4: Create Aircraft Table
 * Corrected to match application expectations
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('aircraft', (table: Knex.CreateTableBuilder) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.string('registration').unique().notNullable();
    table.string('serial_number').unique().notNullable();

    // TEMP (will be normalized later via model_id migrations)
    table.string('model').notNullable();

    // Reference
    table
      .uuid('category_id')
      .references('id')
      .inTable('rf_aircraft_category')
      .notNullable();

    // Lifecycle
    table.string('status').notNullable().defaultTo('REGISTERED');

    // Match application expectations
    table.decimal('total_time_hours', 10, 2).notNullable().defaultTo(0);
    table.integer('total_time_cycles').notNullable().defaultTo(0);

    table.timestamps(true, true);
  });

  // Audit trigger (function already created earlier)
  await knex.raw(`
    CREATE TRIGGER tr_audit_aircraft
    AFTER INSERT OR UPDATE ON aircraft
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {

  // --------------------------------------------------
  // 🔥 DEFENSIVE CLEANUP (HANDLE DEPENDENCIES)
  // --------------------------------------------------

  // 1️⃣ Drop FK from aircraft_components → aircraft (if exists)
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'aircraft_components_aircraft_id_foreign'
      ) THEN
        ALTER TABLE aircraft_components
        DROP CONSTRAINT aircraft_components_aircraft_id_foreign;
      END IF;
    END
    $$;
  `);

  // 2️⃣ Drop trigger safely
  await knex.raw(`
    DROP TRIGGER IF EXISTS tr_audit_aircraft ON aircraft;
  `);

  // 3️⃣ Drop table safely
  await knex.schema.dropTableIfExists('aircraft');
}