import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_sessions', (table) => {
    table.string('sid').primary();
    table.json('sess').notNullable(); // ✅ must be jsonb
    table.timestamp('expire').notNullable();
    table.index('expire');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_sessions');
}