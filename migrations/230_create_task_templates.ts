import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('task_templates');

  if (exists) {
    return;
  }

  await knex.schema.createTable('task_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('scope').notNullable();
    table.string('title').notNullable();
    table.text('description').notNullable();
    table
      .uuid('aircraft_model_id')
      .references('id')
      .inTable('component_models')
      .onDelete('CASCADE');
    table
      .uuid('aircraft_id')
      .references('id')
      .inTable('aircraft')
      .onDelete('CASCADE');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.index(['scope']);
    table.index(['aircraft_model_id']);
    table.index(['aircraft_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('task_templates');
}
