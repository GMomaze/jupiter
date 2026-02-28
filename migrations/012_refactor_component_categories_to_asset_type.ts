import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1️⃣ Rename table
  await knex.schema.renameTable(
    'rf_component_categories',
    'rf_asset_type'
  );

  // 2️⃣ Rename constraint indexes (optional but clean)
  await knex.raw(`
    ALTER INDEX rf_component_categories_pkey
    RENAME TO rf_asset_type_pkey;
  `);

  await knex.raw(`
    ALTER INDEX rf_component_categories_code_key
    RENAME TO rf_asset_type_code_key;
  `);

  // 3️⃣ Update FK constraints referencing the old table

  // component_models FK
  await knex.raw(`
    ALTER TABLE component_models
    DROP CONSTRAINT component_models_category_id_fkey;
  `);

  await knex.raw(`
    ALTER TABLE component_models
    ADD CONSTRAINT component_models_asset_type_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES rf_asset_type(id);
  `);

  // rf_manufacturers FK (if still present)
  await knex.raw(`
    ALTER TABLE rf_manufacturers
    DROP CONSTRAINT IF EXISTS rf_manufacturers_category_id_fkey;
  `);

  await knex.raw(`
    ALTER TABLE rf_manufacturers
    ADD CONSTRAINT rf_manufacturers_asset_type_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES rf_asset_type(id)
    ON DELETE CASCADE;
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Reverse FK changes

  await knex.raw(`
    ALTER TABLE component_models
    DROP CONSTRAINT component_models_asset_type_id_fkey;
  `);

  await knex.raw(`
    ALTER TABLE component_models
    ADD CONSTRAINT component_models_category_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES rf_component_categories(id);
  `);

  await knex.raw(`
    ALTER TABLE rf_manufacturers
    DROP CONSTRAINT IF EXISTS rf_manufacturers_asset_type_id_fkey;
  `);

  await knex.raw(`
    ALTER TABLE rf_manufacturers
    ADD CONSTRAINT rf_manufacturers_category_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES rf_component_categories(id)
    ON DELETE CASCADE;
  `);

  // Rename indexes back
  await knex.raw(`
    ALTER INDEX rf_asset_type_pkey
    RENAME TO rf_component_categories_pkey;
  `);

  await knex.raw(`
    ALTER INDEX rf_asset_type_code_key
    RENAME TO rf_component_categories_code_key;
  `);

  // Rename table back
  await knex.schema.renameTable(
    'rf_asset_type',
    'rf_component_categories'
  );
}
