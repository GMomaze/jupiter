/**
 * PATH: C:\GMO\Projects\jupiter\migrations\017_create_maintenance_requirements.ts
 * PURPOSE: Idempotent migration for maintenance requirements.
 */

import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('maintenance_requirements');

  if (!exists) {
    await knex.schema.createTable('maintenance_requirements', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

      table
        .uuid('model_id')
        .notNullable()
        .references('id')
        .inTable('component_models')
        .onDelete('CASCADE');

      table.string('title').notNullable();
      table.integer('interval_hours').nullable();
      table.integer('interval_months').nullable();
      table.text('description').nullable();

      table.index(['model_id']);
    });

    console.log('✅ Table "maintenance_requirements" created.');
  } else {
    console.log('⚠️ Table "maintenance_requirements" already exists. Skipping creation.');
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('maintenance_requirements');
}