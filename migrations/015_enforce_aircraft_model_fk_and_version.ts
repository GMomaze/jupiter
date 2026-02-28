import type { Knex } from 'knex';

/**
 * JUPITER – Migration 014
 * Purpose: Enforce Aircraft model_id foreign key, remove legacy string field, and add versioning.
 * Ref: 09_DOMAIN_MODEL_REFACTOR_STATE.md, 10_ASSET_MODELING_RULES.md
 */

export async function up(knex: Knex): Promise<void> {
  // Check column existence outside of the synchronous table builder
  const hasVersion = await knex.schema.hasColumn('aircraft', 'version');
  const hasModelId = await knex.schema.hasColumn('aircraft', 'model_id');

  await knex.schema.alterTable('aircraft', (table) => {
    // 1. Add version column if it doesn't exist (Protocol 08 Optimistic Locking)
    if (!hasVersion) {
      table.integer('version').defaultTo(0).notNullable();
    }

    // 2. Handle model_id promotion (Protocol 10 Asset Hierarchy)
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

    // 3. Drop legacy string column
    table.dropColumn('model');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('aircraft', (table) => {
    // Revert to legacy structure
    table.string('model').nullable();
    table.uuid('model_id').nullable().alter();
    table.dropColumn('version');
  });
}