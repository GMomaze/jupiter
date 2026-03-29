import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('component_models', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.uuid('manufacturer_id')
      .notNullable()
      .references('id')
      .inTable('manufacturers');

    table.string('model_name', 255).notNullable();

    table.uuid('category_id')
      .references('id')
      .inTable('rf_component_categories');

    table.decimal('default_tbo_hours', 10, 2);
    table.integer('default_tbo_months');
    table.boolean('is_life_limited').notNullable().defaultTo(false);

    table.uuid('asset_type_id')
      .notNullable()
      .references('id')
      .inTable('rf_asset_type');

    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('aircraft_components', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table.uuid('aircraft_id')
      .notNullable()
      .references('id')
      .inTable('aircraft')
      .onDelete('CASCADE');

    table.uuid('model_id')
      .notNullable()
      .references('id')
      .inTable('component_models');

    table.string('serial_number', 255).notNullable();
    table.string('position_code', 50);
    table.date('installation_date').notNullable();

    table.decimal('install_af_hours', 10, 2).notNullable().defaultTo(0);
    table.decimal('tso_at_install', 10, 2).notNullable().defaultTo(0);
    table.decimal('tsn_at_install', 10, 2).notNullable().defaultTo(0);

    table.string('current_status').notNullable().defaultTo('INSTALLED');
    table.boolean('is_quarantined').notNullable().defaultTo(false);
    table.timestamp('removed_at', { useTz: true });
    table.integer('version').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_component
    ON aircraft_components (aircraft_id, model_id)
    WHERE current_status = 'INSTALLED';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP VIEW IF EXISTS vw_component_status;`);
  await knex.raw(`DROP INDEX IF EXISTS idx_unique_active_component;`);

  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'aircraft_model_id_foreign'
      ) THEN
        ALTER TABLE aircraft
        DROP CONSTRAINT aircraft_model_id_foreign;
      END IF;
    END
    $$;
  `);

  await knex.schema.dropTableIfExists('aircraft_components');
  await knex.schema.dropTableIfExists('component_models');
}
