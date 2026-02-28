import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {

  // 1️⃣ Drop FK safely (if exists)
  await knex.raw(`
    ALTER TABLE rf_manufacturers
    DROP CONSTRAINT IF EXISTS rf_manufacturers_asset_type_id_fkey;
  `);

  // 2️⃣ Drop category_id if exists
  await knex.raw(`
    ALTER TABLE rf_manufacturers
    DROP COLUMN IF EXISTS category_id;
  `);

  // 3️⃣ Drop system_locked if exists
  await knex.raw(`
    ALTER TABLE rf_manufacturers
    DROP COLUMN IF EXISTS system_locked;
  `);

  // 4️⃣ Rename table
  await knex.schema.renameTable(
    'rf_manufacturers',
    'manufacturers'
  );

  // 5️⃣ Add new domain columns safely
  await knex.raw(`
    ALTER TABLE manufacturers
    ADD COLUMN IF NOT EXISTS website text,
    ADD COLUMN IF NOT EXISTS logo_url text,
    ADD COLUMN IF NOT EXISTS address_line_1 text,
    ADD COLUMN IF NOT EXISTS address_line_2 text,
    ADD COLUMN IF NOT EXISTS city text,
    ADD COLUMN IF NOT EXISTS state text,
    ADD COLUMN IF NOT EXISTS country text,
    ADD COLUMN IF NOT EXISTS postal_code text,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT CURRENT_TIMESTAMP;
  `);

  // 6️⃣ Rename primary key index safely
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'rf_manufacturers_pkey'
      ) THEN
        ALTER INDEX rf_manufacturers_pkey
        RENAME TO manufacturers_pkey;
      END IF;
    END
    $$;
  `);

  // 7️⃣ Rename code index safely
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_class WHERE relname = 'rf_manufacturers_code_key'
      ) THEN
        ALTER INDEX rf_manufacturers_code_key
        RENAME TO manufacturers_code_key;
      END IF;
    END
    $$;
  `);
}

export async function down(knex: Knex): Promise<void> {

  await knex.schema.renameTable(
    'manufacturers',
    'rf_manufacturers'
  );

  await knex.raw(`
    ALTER TABLE rf_manufacturers
    ADD COLUMN IF NOT EXISTS category_id uuid;
  `);

  await knex.raw(`
    ALTER TABLE rf_manufacturers
    ADD COLUMN IF NOT EXISTS system_locked boolean DEFAULT false;
  `);

  await knex.raw(`
    ALTER TABLE rf_manufacturers
    ADD CONSTRAINT rf_manufacturers_asset_type_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES rf_asset_type(id)
    ON DELETE CASCADE;
  `);
}
