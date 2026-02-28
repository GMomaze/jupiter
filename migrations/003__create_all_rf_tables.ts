// migrations/[timestamp]_create_all_rf_tables.ts
import { Knex } from "knex";

const tables = [
  "rf_role",
  "rf_task_state",
  "rf_workpack_status",
  "rf_component_condition",
  "rf_signoff_role",
  "rf_aircraft_category",
  "rf_component_type",
];

export async function up(knex: Knex): Promise<void> {
  for (const tableName of tables) {
    const exists = await knex.schema.hasTable(tableName);
    if (!exists) {
      await knex.schema.createTable(tableName, (table) => {
        table
          .uuid("id")
          .primary()
          .defaultTo(knex.raw("gen_random_uuid()")); // PostgreSQL UUID default
        table.string("code").unique().notNullable();
        table.string("label").notNullable();
        table.text("description");
        table.boolean("is_active").defaultTo(true);
        table.boolean("system_locked").defaultTo(false);
        table.timestamp("created_at").defaultTo(knex.fn.now());
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop in reverse order to avoid dependency issues
  for (const tableName of [...tables].reverse()) {
    await knex.schema.dropTableIfExists(tableName);
  }
}