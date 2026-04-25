import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import { TaskService } from '../src/modules/tasks/task.service';
import { pool } from '../src/config/database.js';

describe('Phase 6: Task Card Immutability', () => {
  let taskId: string;
  let aircraftId: string;
  const userId = '00000000-0000-0000-0000-000000000000';

  beforeEach(async () => {
    // 1. CLEANUP: Delete in order of dependencies (Children first, then Parents)
    await pool.query("SET app.is_test_mode = 'true'");
    await pool.query('DELETE FROM audit_log');
    await pool.query('DELETE FROM task_cards');      // Depends on aircraft
    await pool.query('DELETE FROM aircraft');        // Depends on models/categories
    await pool.query('DELETE FROM component_models'); // Depends on manufacturers/asset_types
    await pool.query('DELETE FROM manufacturers');
    await pool.query('DELETE FROM rf_asset_type');
    await pool.query('DELETE FROM rf_aircraft_category');
    await pool.query("SET app.is_test_mode = 'false'");

    // 2. SETUP: Build references
    const categoryId = (
      await pool.query(
        `INSERT INTO rf_aircraft_category (id, code, label)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [uuid(), `TESTCAT-${uuid().slice(0, 8)}`, 'Test Category']
      )
    ).rows[0].id;

    const assetTypeId = (
      await pool.query(
        `INSERT INTO rf_asset_type (id, code, label, is_installable_on_aircraft, is_required_for_aircraft, required_quantity)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [uuid(), `TESTASSET-${uuid().slice(0, 8)}`, 'Test Asset', true, false, 0]
      )
    ).rows[0].id;

    const manufacturerId = (
      await pool.query(
        `INSERT INTO manufacturers (id, name, code, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [uuid(), 'Task Test OEM', `OEM-${uuid().slice(0, 8)}`, true]
      )
    ).rows[0].id;

    const modelId = (
      await pool.query(
        `INSERT INTO component_models (id, manufacturer_id, model_name, asset_type_id, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [uuid(), manufacturerId, `MODEL-${uuid().slice(0, 8)}`, assetTypeId, true]
      )
    ).rows[0].id;

    // 3. Create Aircraft
    const aircraftRes = await pool.query(
      `INSERT INTO aircraft (id, registration, serial_number, category_id, model_id, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id`,
      [uuid(), `REG-${uuid().slice(0, 4).toUpperCase()}`, `SN-${Date.now()}`, categoryId, modelId, 'REGISTERED']
    );
    aircraftId = aircraftRes.rows[0].id;

    // 4. Create Task Card (Fixed column/value mismatch)
    const taskCardNo = `TC-${uuid().slice(0, 8)}`;
    const res = await pool.query(
      `INSERT INTO task_cards (id, task_card_number, title, description, status, aircraft_id) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id`,
      [uuid(), taskCardNo, 'Immutability Test', 'Initial test description', 'OPEN', aircraftId]
    );
    taskId = res.rows[0].id;
  });

  it('Requirement: SIGNED tasks become uneditable', async () => {
    // Transition task to SIGNED state
    await pool.query("UPDATE task_cards SET status = 'SIGNED' WHERE id = $1", [taskId]);

    // Expect service to reject updates
    await expect(
      TaskService.updateDescription(taskId, 'Attempted New Description', userId)
    ).rejects.toThrow('TASK_LOCKED');
  });

  it('Requirement: LOCKED tasks are immutable forever', async () => {
    // Manually transition to LOCKED
    const updateRes = await pool.query(
      "UPDATE task_cards SET status = 'LOCKED' WHERE id = $1", 
      [taskId]
    );

    expect(updateRes.rowCount).toBe(1);

    // Expect service to reject sign-off on already locked task
    await expect(
      TaskService.signOff(taskId, userId)
    ).rejects.toThrow(/SIGN_OFF_FAILED/);
  });
});