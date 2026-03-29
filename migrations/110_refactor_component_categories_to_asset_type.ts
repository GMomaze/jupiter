import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {

  const hasAssetType = await knex.schema.hasTable('rf_asset_type');
  const hasOldTable = await knex.schema.hasTable('rf_component_categories');

  // 🔥 ONLY run rename if old system exists and new one does not
  if (!hasAssetType && hasOldTable) {

    await knex.schema.renameTable(
      'rf_component_categories',
      'rf_asset_type'
    );

    // Rename indexes safely
    await knex.raw(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'rf_component_categories_pkey'
        ) THEN
          ALTER INDEX rf_component_categories_pkey RENAME TO rf_asset_type_pkey;
        END IF;
      END
      $$;
    `);

    await knex.raw(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'rf_component_categories_code_key'
        ) THEN
          ALTER INDEX rf_component_categories_code_key RENAME TO rf_asset_type_code_key;
        END IF;
      END
      $$;
    `);

    // Fix FK only if column still exists
    await knex.raw(`
      ALTER TABLE component_models
      DROP CONSTRAINT IF EXISTS component_models_category_id_fkey;
    `);

    await knex.raw(`
      ALTER TABLE component_models
      ADD CONSTRAINT component_models_asset_type_id_fkey
      FOREIGN KEY (category_id)
      REFERENCES rf_asset_type(id);
    `);
  }

  // 🔥 If rf_asset_type already exists → DO NOTHING (your case)
}

export async function down(knex: Knex): Promise<void> {

  const hasAssetType = await knex.schema.hasTable('rf_asset_type');
  const hasOldTable = await knex.schema.hasTable('rf_component_categories');

  // 🔥 ONLY rollback if rename actually happened
  if (hasAssetType && !hasOldTable) {

    await knex.raw(`
      ALTER TABLE component_models
      DROP CONSTRAINT IF EXISTS component_models_asset_type_id_fkey;
    `);

    await knex.schema.renameTable(
      'rf_asset_type',
      'rf_component_categories'
    );

    await knex.raw(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'rf_asset_type_pkey'
        ) THEN
          ALTER INDEX rf_asset_type_pkey RENAME TO rf_component_categories_pkey;
        END IF;
      END
      $$;
    `);

    await knex.raw(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_class WHERE relname = 'rf_asset_type_code_key'
        ) THEN
          ALTER INDEX rf_asset_type_code_key RENAME TO rf_component_categories_code_key;
        END IF;
      END
      $$;
    `);

    await knex.raw(`
      ALTER TABLE component_models
      ADD CONSTRAINT component_models_category_id_fkey
      FOREIGN KEY (category_id)
      REFERENCES rf_component_categories(id);
    `);
  }
}