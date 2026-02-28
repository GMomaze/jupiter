import { describe, it, expect, beforeEach } from 'vitest';
import { pool } from '../../src/config/database.js';
import { 
  createManufacturer, 
  createAssetType, 
  createComponentModel 
} from '../helpers/domain.factory.js';

describe('Library Integrity & Requirements', () => {

  beforeEach(async () => {
    /**
     * 🛡️ ROBUST CLEANUP
     * Using CASCADE ensures that even if new tables are added (like audit logs or snapshots),
     * the test suite won't break on Foreign Key violations.
     */
    await pool.query(`
      TRUNCATE TABLE 
        workpack_tasks, 
        workpacks, 
        task_cards, 
        maintenance_requirements, 
        aircraft_components, 
        aircraft, 
        component_models, 
        rf_asset_type, 
        manufacturers 
      RESTART IDENTITY CASCADE
    `);
  });

  it('should retrieve requirements for a specific model', async () => {
    // 1. Create dependencies via factory
    const mfr = await createManufacturer();
    const asset = await createAssetType();
    const model = await createComponentModel(mfr.id, asset.id);

    // 2. Insert requirement
    await pool.query(
      `INSERT INTO maintenance_requirements (model_id, title, description)
       VALUES ($1, $2, $3)`,
      [model.id, 'Standard Inspection', 'REQ-1']
    );

    // 3. Verify retrieval
    const result = await pool.query(
      `SELECT * FROM maintenance_requirements
       WHERE model_id = $1`,
      [model.id]
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].description).toBe('REQ-1');
    expect(result.rows[0].title).toBe('Standard Inspection');
  });
});