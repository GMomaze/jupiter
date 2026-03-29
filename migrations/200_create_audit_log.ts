import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('audit_log');

  if (exists) return;

  await knex.schema.createTable('audit_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('table_name').notNullable();
    table.uuid('row_id').notNullable();
    table.string('action').notNullable();
    table
      .uuid('actor_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.jsonb('old_values');
    table.jsonb('new_values');
    table.text('reason');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());

    table.index(['table_name']);
    table.index(['row_id']);
    table.index(['actor_id']);
    table.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_log');
}
