import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Use createTableIfNotExists to handle partial migrations
  if (!(await knex.schema.hasTable('rf_workpack_status'))) {
    await knex.schema.createTable('rf_workpack_status', (t) => {
      t.uuid('id').primary().defaultTo(knex.fn.uuid());
      t.text('code').unique().notNullable(); 
      t.text('label').notNullable();
    });
  }

  if (!(await knex.schema.hasTable('workpacks'))) {
    await knex.schema.createTable('workpacks', (t) => {
      t.uuid('id').primary().defaultTo(knex.fn.uuid());
      t.text('work_order_number').unique().notNullable();
      t.uuid('status_id').references('id').inTable('rf_workpack_status').notNullable();
      t.uuid('aircraft_id').references('id').inTable('aircraft').notNullable();
      t.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('workpack_tasks'))) {
    await knex.schema.createTable('workpack_tasks', (t) => {
      t.uuid('workpack_id').references('id').inTable('workpacks').onDelete('CASCADE');
      t.uuid('task_id').references('id').inTable('task_cards').onDelete('RESTRICT');
      t.primary(['workpack_id', 'task_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('workpack_tasks');
  await knex.schema.dropTableIfExists('workpacks');
  await knex.schema.dropTableIfExists('rf_workpack_status');
}