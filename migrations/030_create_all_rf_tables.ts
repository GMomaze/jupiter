import type { Knex } from 'knex';

const tables = [
  "rf_role",
  "rf_task_state",
  "rf_workpack_status",
  "rf_component_condition",
  "rf_signoff_role",
  "rf_aircraft_category",
  "rf_component_categories",
  "rf_asset_type"
];

export async function up(knex: Knex): Promise<void> {
  for (const tableName of tables) {
    const exists = await knex.schema.hasTable(tableName);

    if (!exists) {
      await knex.schema.createTable(tableName, (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
        table.string("code").unique().notNullable();
        table.string("label").notNullable();
        table.text("description");
        table.boolean("is_active").defaultTo(true);
        table.boolean("system_locked").defaultTo(false);

        // Asset-type specific domain rules
        if (tableName === 'rf_asset_type') {
          table.boolean('is_installable_on_aircraft').notNullable().defaultTo(false);
          table.boolean('is_required_for_aircraft').notNullable().defaultTo(false);
          table.integer('required_quantity').notNullable().defaultTo(0);
        }

        table.timestamp("created_at").defaultTo(knex.fn.now());
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {

  // --------------------------------------------------
  // 🔥 DROP FK CONSTRAINTS FIRST (DEFENSIVE)
  // --------------------------------------------------

  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'component_models_category_id_foreign'
      ) THEN
        ALTER TABLE component_models
        DROP CONSTRAINT component_models_category_id_foreign;
      END IF;
    END
    $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'component_models_asset_type_id_foreign'
      ) THEN
        ALTER TABLE component_models
        DROP CONSTRAINT component_models_asset_type_id_foreign;
      END IF;
    END
    $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'aircraft_category_id_foreign'
      ) THEN
        ALTER TABLE aircraft
        DROP CONSTRAINT aircraft_category_id_foreign;
      END IF;
    END
    $$;
  `);

  // --------------------------------------------------
  // 🔥 DROP TABLES IN SAFE ORDER
  // --------------------------------------------------

  for (const tableName of [...tables].reverse()) {
    await knex.schema.dropTableIfExists(tableName);
  }
}