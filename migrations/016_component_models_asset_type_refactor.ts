import type { Knex } from 'knex';

/**
 * 016_component_models_asset_type_refactor
 *
 * Finalizes transition from category_id → asset_type_id.
 * Also updates dependent view vw_component_status.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {

    // 1️⃣ Add asset_type_id if missing
    const hasAssetType = await trx.schema.hasColumn(
      'component_models',
      'asset_type_id'
    );

    if (!hasAssetType) {
      await trx.schema.alterTable('component_models', (table) => {
        table.uuid('asset_type_id');
      });

      await trx.raw(`
        UPDATE component_models
        SET asset_type_id = category_id
        WHERE asset_type_id IS NULL;
      `);

      await trx.schema.alterTable('component_models', (table) => {
        table.uuid('asset_type_id').notNullable().alter();
      });
    }

    // 2️⃣ Ensure FK exists (idempotent)
    await trx.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'component_models_asset_type_id_fkey'
        ) THEN
          ALTER TABLE component_models
          ADD CONSTRAINT component_models_asset_type_id_fkey
          FOREIGN KEY (asset_type_id)
          REFERENCES rf_asset_type(id)
          ON DELETE RESTRICT;
        END IF;
      END
      $$;
    `);

    // 3️⃣ Drop and recreate dependent view using asset_type_id
    await trx.raw(`
      DROP VIEW IF EXISTS vw_component_status;
    `);

    await trx.raw(`
      CREATE VIEW vw_component_status AS
      SELECT c.id,
             c.serial_number,
             COALESCE(m.model_name, 'UNKNOWN MODEL') AS model_name,
             COALESCE(cat.label, 'UNCATEGORIZED') AS category_name,
             a.registration AS tail_number,
             c.install_hours_airframe,
             a.total_time_hours AS current_airframe_hours,
             (COALESCE(a.total_time_hours, 0) - COALESCE(c.install_hours_airframe, 0)) AS current_actual_tso,
             COALESCE(m.default_tbo_hours, 0) AS tbo_hours,
             (COALESCE(m.default_tbo_hours, 0) -
              (COALESCE(a.total_time_hours, 0) - COALESCE(c.install_hours_airframe, 0))) AS hours_remaining,
             CASE
               WHEN (COALESCE(m.default_tbo_hours, 0) -
                    (COALESCE(a.total_time_hours, 0) - COALESCE(c.install_hours_airframe, 0))) <= 0
                 THEN 'EXPIRED'
               WHEN (COALESCE(m.default_tbo_hours, 0) -
                    (COALESCE(a.total_time_hours, 0) - COALESCE(c.install_hours_airframe, 0))) <= 50
                 THEN 'CRITICAL'
               ELSE 'NORMAL'
             END AS maintenance_status,
             c.status AS component_status,
             c.aircraft_id
      FROM components c
      LEFT JOIN component_models m ON c.model_id = m.id
      LEFT JOIN rf_asset_type cat ON m.asset_type_id = cat.id
      LEFT JOIN aircraft a ON c.aircraft_id = a.id;
    `);

    // 4️⃣ Drop old category_id column if exists
    const hasCategory = await trx.schema.hasColumn(
      'component_models',
      'category_id'
    );

    if (hasCategory) {
      await trx.schema.alterTable('component_models', (table) => {
        table.dropColumn('category_id');
      });
    }

  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {

    // Re-add category_id
    const hasCategory = await trx.schema.hasColumn(
      'component_models',
      'category_id'
    );

    if (!hasCategory) {
      await trx.schema.alterTable('component_models', (table) => {
        table.uuid('category_id');
      });

      await trx.raw(`
        UPDATE component_models
        SET category_id = asset_type_id
        WHERE category_id IS NULL;
      `);
    }

    // Restore original view definition
    await trx.raw(`
      DROP VIEW IF EXISTS vw_component_status;
    `);

    await trx.raw(`
      CREATE VIEW vw_component_status AS
      SELECT c.id,
             c.serial_number,
             COALESCE(m.model_name, 'UNKNOWN MODEL') AS model_name,
             COALESCE(cat.label, 'UNCATEGORIZED') AS category_name,
             a.registration AS tail_number,
             c.install_hours_airframe,
             a.total_time_hours AS current_airframe_hours,
             (COALESCE(a.total_time_hours, 0) - COALESCE(c.install_hours_airframe, 0)) AS current_actual_tso,
             COALESCE(m.default_tbo_hours, 0) AS tbo_hours,
             (COALESCE(m.default_tbo_hours, 0) -
              (COALESCE(a.total_time_hours, 0) - COALESCE(c.install_hours_airframe, 0))) AS hours_remaining,
             CASE
               WHEN (COALESCE(m.default_tbo_hours, 0) -
                    (COALESCE(a.total_time_hours, 0) - COALESCE(c.install_hours_airframe, 0))) <= 0
                 THEN 'EXPIRED'
               WHEN (COALESCE(m.default_tbo_hours, 0) -
                    (COALESCE(a.total_time_hours, 0) - COALESCE(c.install_hours_airframe, 0))) <= 50
                 THEN 'CRITICAL'
               ELSE 'NORMAL'
             END AS maintenance_status,
             c.status AS component_status,
             c.aircraft_id
      FROM components c
      LEFT JOIN component_models m ON c.model_id = m.id
      LEFT JOIN rf_asset_type cat ON m.category_id = cat.id
      LEFT JOIN aircraft a ON c.aircraft_id = a.id;
    `);

    await trx.raw(`
      ALTER TABLE component_models
      DROP CONSTRAINT IF EXISTS component_models_asset_type_id_fkey;
    `);

  });
}
