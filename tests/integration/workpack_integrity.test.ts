import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import { WorkpackService } from '../../src/modules/workpacks/workpack.service.js';
import { pool } from '../../src/config/database.js';
import { 
  createAircraft, 
  createWorkpackStatus 
} from '../helpers/domain.factory.js';

describe('Phase 7 Work Pack Integrity', () => {
  const userId = '00000000-0000-0000-0000-000000000001';
  let aircraftId: string;
  let draftStatusId: string;

  beforeEach(async () => {
    // Ensure clean state and required reference data for every test
    const aircraft = await createAircraft();
    aircraftId = aircraft.id;

    const draftStatus = await createWorkpackStatus('DRAFT');
    draftStatusId = draftStatus.id;
    
    // Ensure other statuses exist for transitions
    await createWorkpackStatus('ISSUED');
    await createWorkpackStatus('IN_PROGRESS');
    await createWorkpackStatus('CLOSED');
  });

  it('Should successfully ISSUE a pack with tasks', async () => {
    const workOrderNumber = `WO-TEST-${uuid().slice(0, 8)}`;
    const wp = await pool.query(
      `INSERT INTO workpacks (id, work_order_number, aircraft_id, status_id, version)
       VALUES ($1, $2, $3, $4, 0) RETURNING id`,
      [uuid(), workOrderNumber, aircraftId, draftStatusId]
    );
    const testPackId = wp.rows[0].id;

    const task = await pool.query(
      `INSERT INTO task_cards (id, title, description, status, aircraft_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [uuid(), 'Critical Inspection', 'Required', 'OPEN', aircraftId]
    );
    const testTaskId = task.rows[0].id;

    await WorkpackService.addTask(testPackId, testTaskId, userId);
    await WorkpackService.issue(testPackId, userId);

    const { rows } = await pool.query(
      `SELECT s.code FROM workpacks w 
       JOIN rf_workpack_status s ON w.status_id = s.id 
       WHERE w.id = $1`, [testPackId]
    );
    expect(rows[0].code).toBe('ISSUED');
  });

  it('Should reject ISSUE if no tasks assigned', async () => {
    const workOrderNumber = `WO-EMPTY-${uuid().slice(0, 8)}`;
    const wp = await pool.query(
      `INSERT INTO workpacks (id, work_order_number, aircraft_id, status_id, version)
       VALUES ($1, $2, $3, $4, 0) RETURNING id`,
      [uuid(), workOrderNumber, aircraftId, draftStatusId]
    );
    const testPackId = wp.rows[0].id;

    await expect(WorkpackService.issue(testPackId, userId))
      .rejects.toThrow('Cannot issue an empty workpack');
  });

  it('Should block CLOSE if task is only SIGNED but not LOCKED', async () => {
    const workOrderNumber = `WO-LOCK-TEST-${uuid().slice(0, 8)}`;
    const wp = await pool.query(
      `INSERT INTO workpacks (id, work_order_number, aircraft_id, status_id, version)
       VALUES ($1, $2, $3, $4, 0) RETURNING id`,
      [uuid(), workOrderNumber, aircraftId, draftStatusId]
    );
    const testPackId = wp.rows[0].id;

    const task = await pool.query(
      `INSERT INTO task_cards (id, title, description, status, aircraft_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [uuid(), 'Locking Test Task', 'Required', 'OPEN', aircraftId]
    );
    const testTaskId = task.rows[0].id;

    await WorkpackService.addTask(testPackId, testTaskId, userId);
    await WorkpackService.issue(testPackId, userId);
    await WorkpackService.startWork(testPackId, userId);

    // Manually force status to SIGNED to test the service block
    await pool.query(`UPDATE task_cards SET status = 'SIGNED' WHERE id = $1`, [testTaskId]);

    await expect(WorkpackService.close(testPackId, userId))
      .rejects.toThrow(/Tasks not LOCKED/);
  });

  it('Should verify audit row creation on status change', async () => {
    const workOrderNumber = `WO-AUDIT-${uuid().slice(0, 8)}`;
    const wp = await pool.query(
      `INSERT INTO workpacks (id, work_order_number, aircraft_id, status_id, version)
       VALUES ($1, $2, $3, $4, 0) RETURNING id`,
      [uuid(), workOrderNumber, aircraftId, draftStatusId]
    );
    const testPackId = wp.rows[0].id;

    const task = await pool.query(
      `INSERT INTO task_cards (id, title, description, status, aircraft_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [uuid(), 'Audit Test Task', 'Required', 'OPEN', aircraftId]
    );
    const testTaskId = task.rows[0].id;

    await WorkpackService.addTask(testPackId, testTaskId, userId);
    await WorkpackService.issue(testPackId, userId);

    const { rows } = await pool.query(
      `SELECT action FROM audit_log 
       WHERE row_id = $1 
       ORDER BY created_at DESC LIMIT 1`,
      [testPackId]
    );
    
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].action).toBe('STATUS_CHANGE');
  });
});