import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import { TaskService } from '../src/modules/tasks/task.service';
import { pool } from '../src/config/database.js';
import { assertTestDatabaseSafety } from '../src/config/testDatabaseSafety.js';

describe('Phase 6: Task Card Immutability', () => {
  let taskId: string;
  let aircraftId: string;
  let categoryId: string;
  let assetTypeId: string;
  let manufacturerId: string;
  let modelId: string;

  beforeEach(async () => {
    await assertTestDatabaseSafety(pool);
    taskId = '';
    aircraftId = '';
    categoryId = '';
    assetTypeId = '';
    manufacturerId = '';
    modelId = '';

    // Build uniquely identified, test-owned references.
    categoryId = (
      await pool.query(
        `INSERT INTO rf_aircraft_category (id, code, label)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [uuid(), `TESTCAT-${uuid().slice(0, 8)}`, 'Test Category']
      )
    ).rows[0].id;

    assetTypeId = (
      await pool.query(
        `INSERT INTO rf_asset_type (id, code, label, is_installable_on_aircraft, is_required_for_aircraft, required_quantity)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [uuid(), `TESTASSET-${uuid().slice(0, 8)}`, 'Test Asset', true, false, 0]
      )
    ).rows[0].id;

    manufacturerId = (
      await pool.query(
        `INSERT INTO manufacturers (id, name, code, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [uuid(), 'Task Test OEM', `OEM-${uuid().slice(0, 8)}`, true]
      )
    ).rows[0].id;

    modelId = (
      await pool.query(
        `INSERT INTO component_models (id, manufacturer_id, model_name, asset_type_id, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [uuid(), manufacturerId, `MODEL-${uuid().slice(0, 8)}`, assetTypeId, true]
      )
    ).rows[0].id;

    const aircraftRes = await pool.query(
      `INSERT INTO aircraft (id, registration, serial_number, category_id, model_id, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id`,
      [uuid(), `REG-${uuid().slice(0, 4).toUpperCase()}`, `SN-${Date.now()}`, categoryId, modelId, 'REGISTERED']
    );
    aircraftId = aircraftRes.rows[0].id;

    const taskCardNo = `TC-${uuid().slice(0, 8)}`;
    const res = await pool.query(
      `INSERT INTO task_cards (id, task_card_number, title, description, status, aircraft_id) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id`,
      [uuid(), taskCardNo, 'Immutability Test', 'Initial test description', 'OPEN', aircraftId]
    );
    taskId = res.rows[0].id;
  });

  afterEach(async () => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL app.is_test_mode = 'true'");

      if (taskId) {
        await client.query('DELETE FROM audit_log WHERE row_id = $1', [taskId]);
        await client.query('DELETE FROM task_cards WHERE id = $1', [taskId]);
      }
      if (aircraftId) {
        await client.query('DELETE FROM aircraft WHERE id = $1', [aircraftId]);
      }
      if (modelId) {
        await client.query('DELETE FROM component_models WHERE id = $1', [modelId]);
      }
      if (manufacturerId) {
        await client.query('DELETE FROM manufacturers WHERE id = $1', [manufacturerId]);
      }
      if (assetTypeId) {
        await client.query('DELETE FROM rf_asset_type WHERE id = $1', [assetTypeId]);
      }
      if (categoryId) {
        await client.query('DELETE FROM rf_aircraft_category WHERE id = $1', [categoryId]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  it('Requirement: CERTIFIED_BY_ENGINEER tasks become uneditable', async () => {
    // Transition task to the current certified lifecycle state.
    await pool.query(
      "UPDATE task_cards SET status = 'CERTIFIED_BY_ENGINEER' WHERE id = $1",
      [taskId]
    );

    // Expect service to reject updates
    await expect(
      TaskService.updateDescription(taskId, 'Attempted New Description')
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
      TaskService.signOff(taskId)
    ).rejects.toThrow(/SIGN_OFF_FAILED/);
  });
});
