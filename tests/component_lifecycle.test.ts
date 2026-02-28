import { describe, it, expect } from 'vitest';
import { pool } from '../src/config/database.js';
import { createAircraft } from './helpers/domain.factory.js';

describe('Component Lifecycle', () => {
  let aircraftId: string;
  let modelId: string;
  let componentId: string;

  it('creates component', async () => {
    const seeded = await createAircraft();
    modelId = seeded.modelId;
    // Corrected column: model_id (NOT component_model_id)
    const res = await pool.query(`
      INSERT INTO aircraft_components (id, serial_number, model_id, current_status, install_af_hours)
      VALUES (gen_random_uuid(), 'SN-001', $1, 'INSTALLED', 0)
      RETURNING id
    `, [modelId]);

    componentId = res.rows[0].id;
    expect(componentId).toBeDefined();
  });

  it('installs component on aircraft', async () => {
    const seeded = await createAircraft();
    aircraftId = seeded.id;
    modelId = seeded.modelId;
    // Corrected column: current_status (NOT status)
    const res = await pool.query(`
      INSERT INTO aircraft_components (id, serial_number, model_id, aircraft_id, current_status, install_af_hours)
      VALUES (gen_random_uuid(), 'SN-INST-01', $1, $2, 'INSTALLED', 0)
      RETURNING current_status
    `, [modelId, aircraftId]);

    expect(res.rows[0].current_status).toBe('INSTALLED');
  });

  it('removes component from aircraft', async () => {
    const seeded = await createAircraft();
    aircraftId = seeded.id;
    modelId = seeded.modelId;
    const setup = await pool.query(`
      INSERT INTO aircraft_components (id, serial_number, model_id, aircraft_id, current_status, install_af_hours)
      VALUES (gen_random_uuid(), 'SN-REM-01', $1, $2, 'INSTALLED', 0)
      RETURNING id
    `, [modelId, aircraftId]);
    
    const id = setup.rows[0].id;

    await pool.query(`
      UPDATE aircraft_components
      SET aircraft_id = NULL,
          current_status = 'REMOVED',
          removed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    const res = await pool.query(`SELECT current_status FROM aircraft_components WHERE id = $1`, [id]);
    expect(res.rows[0].current_status).toBe('REMOVED');
  });

  it('quarantines component', async () => {
    const seeded = await createAircraft();
    modelId = seeded.modelId;
    const setup = await pool.query(`
      INSERT INTO aircraft_components (id, serial_number, model_id, current_status, install_af_hours, is_quarantined)
      VALUES (gen_random_uuid(), 'SN-QUAR-01', $1, 'INSTALLED', 0, false)
      RETURNING id
    `, [modelId]);
    
    const id = setup.rows[0].id;

    await pool.query(`
      UPDATE aircraft_components
      SET is_quarantined = true,
          current_status = 'QUARANTINED'
      WHERE id = $1
    `, [id]);

    const res = await pool.query(`SELECT is_quarantined FROM aircraft_components WHERE id = $1`, [id]);
    expect(res.rows[0].is_quarantined).toBe(true);
  });
});