import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('workpacks'))) {
    await knex.schema.createTable('workpacks', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('work_order_number').unique().notNullable();
      table
        .uuid('status_id')
        .notNullable()
        .references('id')
        .inTable('rf_workpack_status')
        .onDelete('RESTRICT');
      table
        .uuid('aircraft_id')
        .notNullable()
        .references('id')
        .inTable('aircraft')
        .onDelete('RESTRICT');
      table.integer('version').notNullable().defaultTo(0);
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('workpack_tasks'))) {
    await knex.schema.createTable('workpack_tasks', (table) => {
      table
        .uuid('workpack_id')
        .notNullable()
        .references('id')
        .inTable('workpacks')
        .onDelete('CASCADE');
      table
        .uuid('task_id')
        .notNullable()
        .references('id')
        .inTable('task_cards')
        .onDelete('RESTRICT');
      table.primary(['workpack_id', 'task_id']);
    });
  }

  if (!(await knex.schema.hasTable('workpack_requirements'))) {
    await knex.schema.createTable('workpack_requirements', (table) => {
      table
        .uuid('workpack_id')
        .notNullable()
        .references('id')
        .inTable('workpacks')
        .onDelete('CASCADE');
      table.uuid('maintenance_requirement_id').notNullable();
      table.string('status').notNullable().defaultTo('OPEN');
      table.timestamps(true, true);
      table.primary(['workpack_id', 'maintenance_requirement_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('workpack_requirements');
  await knex.schema.dropTableIfExists('workpack_tasks');
  await knex.schema.dropTableIfExists('workpacks');
}
