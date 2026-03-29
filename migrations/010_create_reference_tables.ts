import type { Knex } from 'knex';

async function createReferenceTable(knex: Knex, tableName: string) {
  await knex.schema.createTable(tableName, (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid()); // UUID PK
    table.string('code').unique().notNullable();         // Unique, Immutable
    table.string('label').notNullable();                 // Display Name
    table.text('description');                           // Long form info
    table.boolean('is_active').defaultTo(true);          // Soft-delete toggle
    table.boolean('system_locked').defaultTo(false);     // Safety Lock
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Rule 1.1: No FK pointing from rf table (References are leaf nodes)
  });
}

export async function up(knex: Knex): Promise<void> {
  // Initial batch of reference tables for the foundation
  const tables = [
    'rf_role',
    'rf_task_state',
    'rf_workpack_status',
    'rf_component_condition'
  ];

  for (const table of tables) {
    await createReferenceTable(knex, table);
  }
}

export async function down(knex: Knex): Promise<void> {
  const tables = ['rf_component_condition', 'rf_workpack_status', 'rf_task_state', 'rf_role'];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}