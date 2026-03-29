import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('task_cards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title').notNullable();
    table.text('description').notNullable();
    
    // Status: OPEN -> SIGNED -> LOCKED
    table.string('status').notNullable().defaultTo('OPEN');
    
    // Links to the Asset
    table.uuid('aircraft_id').references('id').inTable('aircraft').notNullable();
    table.uuid('assigned_to').references('id').inTable('users');
    table.uuid('component_id');
    
    // Sign-off tracking
    table.uuid('signed_by').references('id').inTable('users');
    table.timestamp('signed_at');
    table.text('signature_snapshot_url'); // Path to Puppeteer PDF/PNG
    table.text('work_performed');
    table.integer('version').notNullable().defaultTo(0);

    table.timestamps(true, true);
  });

  // Attach Audit (Phase 3)
  await knex.raw(`
    CREATE TRIGGER tr_audit_tasks 
    AFTER INSERT OR UPDATE ON task_cards 
    FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('task_cards');
}
