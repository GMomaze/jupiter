import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {

  await knex.schema.alterTable('component_models', (table) => {
    table.unique(['asset_type_id', 'model_name'], 'component_models_asset_type_model_unique');
  });

}

export async function down(knex: Knex): Promise<void> {

  await knex.schema.alterTable('component_models', (table) => {
    table.dropUnique(['asset_type_id', 'model_name'], 'component_models_asset_type_model_unique');
  });

}