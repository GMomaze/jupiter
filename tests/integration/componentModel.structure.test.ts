import { describe, it, expect } from 'vitest';
import { pool } from '../../src/config/database.js';
import { v4 as uuid } from 'uuid';

describe('Component Model Structure Integrity', () => {
  // Helper to satisfy NOT NULL asset_type_id
  const getAssetTypeId = async () => {
    const res = await pool.query("INSERT INTO rf_asset_type (id, code, label) VALUES ($1, 'TEST', 'Test Asset') ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code RETURNING id", [uuid()]);
    return res.rows[0].id;
  };

  const createManufacturer = async (name: string) => {
    const id = uuid();
    await pool.query('INSERT INTO manufacturers (id, name) VALUES ($1, $2)', [id, name]);
    return { id, name };
  };

  const createComponentModel = async (mfrId: string) => {
    const id = uuid();
    const assetTypeId = await getAssetTypeId();
    const modelName = `MODEL-${uuid().slice(0, 8)}`;
    // FIX: Changed model_code to model_name per DDL
    await pool.query(
      'INSERT INTO component_models (id, manufacturer_id, model_name, asset_type_id) VALUES ($1, $2, $3, $4)',
      [id, mfrId, modelName, assetTypeId]
    );
    return { id, modelName };
  };

  it('allows duplicate model names for the same manufacturer when no unique code constraint exists', async () => {
    const mfr = await createManufacturer('Boeing');
    const assetTypeId = await getAssetTypeId();
    const modelName = '737-MAX';
    
    await pool.query(
      'INSERT INTO component_models (id, manufacturer_id, model_name, asset_type_id) VALUES ($1, $2, $3, $4)',
      [uuid(), mfr.id, modelName, assetTypeId]
    );

    await expect(
      pool.query(
        'INSERT INTO component_models (id, manufacturer_id, model_name, asset_type_id) VALUES ($1, $2, $3, $4)',
        [uuid(), mfr.id, modelName, assetTypeId]
      )
    ).resolves.toBeDefined();
  });

  it('blocks deleting a manufacturer with associated models', async () => {
    const mfr = await createManufacturer('Airbus');
    await createComponentModel(mfr.id);

    await expect(
      pool.query('DELETE FROM manufacturers WHERE id = $1', [mfr.id])
    ).rejects.toThrow('update or delete on table "manufacturers" violates foreign key constraint "component_models_manufacturer_fk" on table "component_models"');
  });
});
