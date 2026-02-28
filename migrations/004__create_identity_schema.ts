import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Users Table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').unique().notNullable();
    table.string('password_hash').notNullable();
    table.string('full_name').notNullable();
    table.boolean('is_active').defaultTo(true).index(); // 2.1 Enforcement index
    table.timestamps(true, true);
  });

  // 2. User Roles Join Table (Many-to-Many)
  await knex.schema.createTable('user_roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.uuid('role_id').references('id').inTable('rf_role').onDelete('CASCADE').notNullable();
    table.unique(['user_id', 'role_id']); // Rule: Prevent duplicate role assignments
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('users');
}