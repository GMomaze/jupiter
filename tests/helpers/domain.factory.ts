import { v4 as uuid } from 'uuid';
import { 
  Aircraft, 
  AircraftCategory, 
  ComponentModel, 
  Manufacturer, 
  AssetType, 
  WorkpackStatus,
  TaskCard,     // Added for cleanup
  Workpack      // Added for cleanup
} from '../../src/models/index.js';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Global Cleanup Utility
 * Deletes data in the correct order to avoid Foreign Key Constraint errors.
 */
export async function clearDatabase() {
  await pool.query('DELETE FROM task_cards');
  await pool.query('DELETE FROM workpacks');
  await pool.query('DELETE FROM aircraft_components');
  await pool.query('DELETE FROM aircraft');
  await pool.query('DELETE FROM component_models');
  await pool.query('DELETE FROM manufacturers');
  await pool.query('DELETE FROM rf_asset_type');
  await pool.query('DELETE FROM aircraft_categories');
}

export async function createManufacturer() {
  const id = uuid();
  const code = `MFR_${id.slice(0, 6).toUpperCase()}`;

  const manufacturer = await Manufacturer.create({
    id,
    name: code,
    code,
    is_active: true
  });

  return { id: manufacturer.id, code, manufacturerId: manufacturer.id };
}

export async function createAssetType() {
  const id = uuid();
  const code = `TYPE_${id.slice(0, 6).toUpperCase()}`;

  const assetType = await AssetType.create({
    id,
    code,
    label: code,
  });

  return { id: assetType.id, code, assetTypeId: assetType.id };
}

export async function createComponentModel(mfrId?: string, assetId?: string) {
  const finalMfrId = mfrId || (await createManufacturer()).id;
  const finalAssetId = assetId || (await createAssetType()).id;
  const id = uuid();

  const model = await ComponentModel.create({
    id,
    model_name: `MODEL_${id.slice(0, 4)}`,
    manufacturer_id: finalMfrId,
    asset_type_id: finalAssetId,
    is_active: true
  });

  return { id: model.id, modelId: model.id };
}

export async function createAircraftCategory() {
  const id = uuid();
  const code = `CAT_${id.slice(0, 6).toUpperCase()}`;
  
  const category = await AircraftCategory.create({
    id,
    code,
    label: code,
    is_active: true
  });

  return category.id;
}

export async function createWorkpackStatus(code: string) {
  const [status] = await WorkpackStatus.findOrCreate({
    where: { code },
    defaults: {
      id: uuid(),
      code,
      label: code
    }
  });
  return { id: status.id, code };
}

export async function createAircraft(catId?: string, modelId?: string) {
  const finalCatId = catId || (await createAircraftCategory());
  const finalModelId = modelId || (await createComponentModel()).id;
  const id = uuid();
  const reg = `ZS-${id.slice(0, 5).toUpperCase()}`;
  
  const aircraft = await Aircraft.create({
    id,
    registration: reg,
    serial_number: `SN-${id.slice(0, 8)}`,
    category_id: finalCatId,
    model_id: finalModelId,
    status: 'REGISTERED',
    version: 0
  });
  
  return { id: aircraft.id, aircraftId: aircraft.id, modelId: finalModelId };
}

/**
 * Specifically named export for maintenance_integrity.test.ts
 */
export async function seedAircraft() {
  return await createAircraft();
}