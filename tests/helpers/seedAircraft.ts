import { pool } from '../../src/config/database.js';

export async function seedAircraft() {
  const runId = Math.random().toString(36).slice(2, 8).toUpperCase();

  // 1️⃣ Aircraft Category
  const category = await pool.query(`
    INSERT INTO rf_aircraft_category (id, code, label, is_active)
    VALUES (gen_random_uuid(), 'CAT_${runId}', 'Test Category ${runId}', true)
    RETURNING id
  `);
  const categoryId = category.rows[0].id;

  // 2️⃣ Asset Type
  const assetType = await pool.query(`
    INSERT INTO rf_asset_type (id, code, label, system_locked)
    VALUES (gen_random_uuid(), 'TYPE_${runId}', 'Aircraft Type', false)
    RETURNING id
  `);
  const assetTypeId = assetType.rows[0].id;

  // 3️⃣ Manufacturer (Added 'code' column to satisfy DDL)
  const manufacturer = await pool.query(`
    INSERT INTO manufacturers (id, name, code, is_active)
    VALUES (gen_random_uuid(), 'MFG_${runId}', 'M${runId}', true)
    RETURNING id
  `);
  const manufacturerId = manufacturer.rows[0].id;

  // 4️⃣ Component Model
  const model = await pool.query(`
    INSERT INTO component_models (id, model_name, manufacturer_id, asset_type_id, is_active)
    VALUES (gen_random_uuid(), 'MODEL_${runId}', $1, $2, true)
    RETURNING id
  `, [manufacturerId, assetTypeId]);
  const modelId = model.rows[0].id;

  // 5️⃣ Aircraft (Standardized columns and added version)
  const aircraft = await pool.query(`
    INSERT INTO aircraft (
      id, 
      registration, 
      serial_number, 
      category_id, 
      model_id, 
      status, 
      version
    )
    VALUES (
      gen_random_uuid(),
      'ZS-${runId}',
      'SN-${runId}',
      $1,
      $2,
      'REGISTERED',
      0
    )
    RETURNING id
  `, [categoryId, modelId]);

  const aircraftId = aircraft.rows[0].id;

  return {
    aircraftId,
    modelId,
    manufacturerId,
    assetTypeId,
    categoryId
  };
}