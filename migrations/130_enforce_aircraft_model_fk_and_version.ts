import type { Knex } from 'knex';

/**
 * JUPITER – Migration 014
 * Purpose: Enforce Aircraft model_id foreign key, remove legacy string field, and add versioning.
 */

export async function up(knex: Knex): Promise<void> {
  const hasVersion = await knex.schema.hasColumn('aircraft', 'version');
  const hasModelId = await knex.schema.hasColumn('aircraft', 'model_id');
  const hasModel = await knex.schema.hasColumn('aircraft', 'model');

  await knex.schema.alterTable('aircraft', (table) => {
    if (!hasVersion) {
      table.integer('version').defaultTo(0).notNullable();
    }

    if (hasModelId) {
      table.uuid('model_id')
        .notNullable()
        .references('id')
        .inTable('component_models')
        .onDelete('RESTRICT')
        .alter();
    } else {
      table.uuid('model_id')
        .notNullable()
        .references('id')
        .inTable('component_models')
        .onDelete('RESTRICT');
    }
  });

  if (hasModel) {
    await knex.schema.alterTable('aircraft', (table) => {
      table.dropColumn('model');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('aircraft', (table) => {
    table.string('model').nullable();
    table.uuid('model_id').nullable().alter();
    table.dropColumn('version');
  });
}