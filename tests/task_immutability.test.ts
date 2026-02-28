import { describe, it, expect, beforeEach } from 'vitest';
import { TaskService } from '../src/modules/tasks/task.service';
import { pool } from '../src/config/database.js';

describe('Phase 6: Task Card Immutability', () => {
  let taskId: string;
  let aircraftId: string;
  const userId = '00000000-0000-0000-0000-000000000000';

  beforeEach(async () => {
    // 1. Ensure Reference Data exists or create it
    // Fetching existing IDs to satisfy strict DDL constraints
    let categoryRes = await pool.query('SELECT id FROM rf_aircraft_category LIMIT 1');
    let categoryId = categoryRes.rows[0]?.id;

    if (!categoryId) {
      const newCat = await pool.query(
        "INSERT INTO rf_aircraft_category (code, label) VALUES ('TEST', 'Test Category') RETURNING id"
      );
      categoryId = newCat.rows[0].id;
    }

    let modelRes = await pool.query('SELECT id FROM component_models LIMIT 1');
    let modelId = modelRes.rows[0]?.id;

    if (!modelId) {
       // Note: component_models itself has foreign keys (asset_type_id, manufacturer_id)
       // This assumes your test environment has seeded reference data as per project protocol.
       throw new Error('Prerequisite: component_models must have at least one record seeded for this test.');
    }

    // 2. Create Aircraft
    const aircraftRes = await pool.query(
      `INSERT INTO aircraft (registration, serial_number, category_id, model_id, status) 
       VALUES ($1, $2, $3, $4, 'REGISTERED') 
       RETURNING id`,
      [`REG-${Math.random().toString(36).substring(7).toUpperCase()}`, `SN-${Date.now()}`, categoryId, modelId]
    );
    aircraftId = aircraftRes.rows[0].id;

    // 3. Create Task Card
    const res = await pool.query(
      `INSERT INTO task_cards (title, description, status, aircraft_id) 
       VALUES ('Immutability Test', 'Initial test description', 'OPEN', $1) 
       RETURNING id`,
      [aircraftId]
    );
    taskId = res.rows[0].id;
  });

  it('Requirement: SIGNED tasks become uneditable', async () => {
    // Transition task to SIGNED state
    await pool.query("UPDATE task_cards SET status = 'SIGNED' WHERE id = $1", [taskId]);

    // TaskService.updateDescription throws 'TASK_LOCKED' for SIGNED/LOCKED status
    await expect(
      TaskService.updateDescription(taskId, 'Attempted New Description', userId)
    ).rejects.toThrow('TASK_LOCKED');
  });

  it('Requirement: LOCKED tasks are immutable forever', async () => {
    // Manually transition to LOCKED in the database
    const updateRes = await pool.query(
      "UPDATE task_cards SET status = 'LOCKED' WHERE id = $1", 
      [taskId]
    );

    expect(updateRes.rowCount).toBe(1);

    // TaskService.signOff throws 'SIGN_OFF_FAILED: Task must be OPEN...'
    await expect(
      TaskService.signOff(taskId, userId)
    ).rejects.toThrow(/SIGN_OFF_FAILED/);
  });
});