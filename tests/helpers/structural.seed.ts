import { pool } from '../../src/config/database';
import { v4 as uuid } from 'uuid';

export async function seedStructuralParents() {
  const runId = uuid().slice(0, 8);

  const mfg = await pool.query(
    `INSERT INTO manufacturers (id, name, code)
     VALUES (gen_random_uuid(), $1, $2)
     RETURNING id`,
    [`MFG_${runId}`, `MFG_${runId}`]
  );

  const asset = await pool.query(
    `INSERT INTO rf_asset_type (id, code, label)
     VALUES (gen_random_uuid(), $1, $2)
     RETURNING id`,
    [`ASSET_${runId}`, `Asset ${runId}`]
  );

  const model = await pool.query(
    `INSERT INTO component_models (id, model_name, manufacturer_id, asset_type_id)
     VALUES (gen_random_uuid(), $1, $2, $3)
     RETURNING id`,
    [`MODEL_${runId}`, mfg.rows[0].id, asset.rows[0].id]
  );

  const aircraft = await pool.query(
    `INSERT INTO aircraft (id, serial_number, model_id)
     VALUES (gen_random_uuid(), $1, $2)
     RETURNING id`,
    [`SN_${runId}`, model.rows[0].id]
  );

  return {
    manufacturerId: mfg.rows[0].id,
    assetTypeId: asset.rows[0].id,
    modelId: model.rows[0].id,
    aircraftId: aircraft.rows[0].id
  };
}