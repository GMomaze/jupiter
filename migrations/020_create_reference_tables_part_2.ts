import type { Knex } from 'knex';

async function createReferenceTable(knex: Knex, tableName: string) {
  const exists = await knex.schema.hasTable(tableName);
  if (!exists) {
    await knex.schema.createTable(tableName, (table) => {
      // 1.1 Requirements
      table
        .uuid("id")
        .primary()
        .defaultTo(knex.raw("gen_random_uuid()")); // UUID PK
      table.string("code").unique().notNullable(); // Unique & Immutable
      table.string("label").notNullable(); // Display Name
      table.text("description");
      table.boolean("is_active").defaultTo(true); // Soft-delete only
      table.boolean("system_locked").defaultTo(false); // system_locked
      table.timestamp("created_at").defaultTo(knex.fn.now());

      // No FK pointing from rf table (verified by omission)
    });
  }
}

export async function up(knex: Knex): Promise<void> {
  const tables = [
    "rf_role",
    "rf_task_state",
    "rf_workpack_status",
    "rf_component_condition",
    "rf_signoff_role",
    "rf_aircraft_category",
    "rf_component_type",
  ];

  for (const table of tables) {
    await createReferenceTable(knex, table);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop in reverse to be safe
  const tables = [
    "rf_component_type",
    "rf_aircraft_category",
    "rf_signoff_role",
    "rf_component_condition",
    "rf_workpack_status",
    "rf_task_state",
    "rf_role",
  ];

  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}