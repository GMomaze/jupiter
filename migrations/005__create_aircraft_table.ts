import type { Knex } from 'knex';

/**
 * Phase 4: Create Aircraft Table
 * Enforces registration uniqueness and links to Phase 1 Reference Categories.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('aircraft', (table: Knex.CreateTableBuilder) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('registration').unique().notNullable();
    table.string('serial_number').unique().notNullable();
    table.string('model').notNullable();

    // Phase 1 Linkage
    table
      .uuid('category_id')
      .references('id')
      .inTable('rf_aircraft_category')
      .notNullable();

    // Lifecycle (Controlled)
    table.string('status').notNullable().defaultTo('REGISTERED');
    table.decimal('total_airframe_hours', 10, 2).defaultTo(0.0);

    table.timestamps(true, true);
  });

  // Attach Audit Trigger (Phase 3)
  await knex.raw(`
    CREATE TRIGGER tr_audit_aircraft
    AFTER INSERT OR UPDATE ON aircraft
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('aircraft');
}