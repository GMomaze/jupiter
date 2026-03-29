import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {

  const exists = await knex.schema.hasTable('manufacturers');

  if (!exists) {
    await knex.schema.createTable('manufacturers', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

      table.string('name').notNullable();
      table.string('code').unique();
      table.text('description');
      table.boolean('is_active').notNullable().defaultTo(true);

      table.text('website');
      table.text('logo_url');

      table.text('address_line_1');
      table.text('address_line_2');
      table.text('city');
      table.text('state');
      table.text('country');
      table.text('postal_code');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('manufacturers');
}
