import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('sessions', (table) => {
    table.string('sid').primary();
    table.jsonb('sess').notNullable(); // MUST be jsonb for pg
    table.timestamp('expire').notNullable();
    table.index('expire');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('sessions');
}