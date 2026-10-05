import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import { WorkpackService } from '../../src/modules/workpacks/workpack.service.js';
import { pool } from '../../src/config/database.js';
import { createTenantQueryAuthority, type TenantQueryAuthority } from '../../src/modules/tenancy/tenant-query-authority.js';
import { 
  createAircraft, 
  createWorkpackStatus 
} from '../helpers/domain.factory.js';

describe('Phase 7 Work Pack Integrity', () => {
  let userId: string;
  let aircraftId: string;
  let draftStatusId: string;
  let tenantId: string;
  let authority: TenantQueryAuthority;

  beforeEach(async () => {
    userId = uuid();

    // ✅ FIX: create valid user
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, `test-${userId}@test.com`, 'hash', 'Workpack Tester', true]
    );

    tenantId = uuid();
    await pool.query(
      `INSERT INTO tenants (id, public_id, code, display_name, status, created_by_user_id, updated_by_user_id)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $5)`,
      [tenantId, uuid(), `WP_${tenantId.replace(/-/g, '').slice(0, 12).toUpperCase()}`, 'Workpack test tenant', userId]
    );
    authority = createTenantQueryAuthority({
      state: 'VALID_ACTIVE_TENANT',
      tenant: { id: tenantId, publicId: uuid(), code: 'WP_TEST', displayName: 'Workpack test tenant', status: 'ACTIVE' },
      membership: { id: uuid(), tenantId, userId, status: 'ACTIVE' },
      validatedAt: Date.now(),
    });

    const aircraft = await createAircraft(undefined, undefined, tenantId);
    aircraftId = aircraft.id;

    const draftStatus = await createWorkpackStatus('DRAFT');
    draftStatusId = draftStatus.id;

    await createWorkpackStatus('ISSUED');
    await createWorkpackStatus('IN_PROGRESS');
    await createWorkpackStatus('CLOSED');
  });

  it('Should successfully ISSUE a pack with tasks', async () => {
    const wp = await pool.query(
      `INSERT INTO workpacks (id, tenant_id, work_order_number, aircraft_id, status_id, version)
       VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
      [uuid(), tenantId, `WO-${uuid().slice(0,8)}`, aircraftId, draftStatusId]
    );

    const task = await pool.query(
      `INSERT INTO task_cards (id, task_card_number, title, description, status, aircraft_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [uuid(), 'TC-1', 'Task', 'Desc', 'OPEN', aircraftId]
    );

    await WorkpackService.addTask(authority, wp.rows[0].id, task.rows[0].id, userId);
    await WorkpackService.issue(authority, wp.rows[0].id, userId);

    const { rows } = await pool.query(
      `SELECT s.code FROM workpacks w 
       JOIN rf_workpack_status s ON w.status_id = s.id 
       WHERE w.id = $1`,
      [wp.rows[0].id]
    );

    expect(rows[0].code).toBe('ISSUED');
  });

  it('Should add aircraft-relevant service bulletins to a draft workpack', async () => {
    const wp = await pool.query(
      `INSERT INTO workpacks (id, tenant_id, work_order_number, aircraft_id, status_id, version)
       VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
      [uuid(), tenantId, `WO-${uuid().slice(0,8)}`, aircraftId, draftStatusId]
    );

    const aircraftRow = await pool.query(
      `SELECT model_id FROM aircraft WHERE id = $1`,
      [aircraftId]
    );
    const modelId = aircraftRow.rows[0].model_id;

    const bulletinId = uuid();

    // ✅ FIX: no model_id column
    const bulletinReference = `SB-TEST-${uuid().slice(0, 8)}`;
    await pool.query(
      `INSERT INTO service_bulletins (
        id, sb_number, reference, manufacturer, title, compliance_type,
        compliance_requirement, source_primary, source_format, source_refs, status, is_active
      )
      VALUES ($1, $2, $2, 'TEST', $3, 'MANDATORY', 'MANDATORY', 'MANUAL', 'MANUAL', '[]', 'ACTIVE', true)`,
      [bulletinId, bulletinReference, 'Wing Spar Inspection']
    );

    // ✅ link table
    await pool.query(
      `INSERT INTO service_bulletin_models (service_bulletin_id, model_id)
       VALUES ($1, $2)`,
      [bulletinId, modelId]
    );

    await WorkpackService.addServiceBulletins(authority, wp.rows[0].id, [bulletinId], userId);

    const addedTasks = await pool.query(
      `SELECT tc.title
       FROM task_cards tc
       JOIN workpack_tasks wt ON wt.task_id = tc.id
       WHERE wt.workpack_id = $1`,
      [wp.rows[0].id]
    );

    expect(addedTasks.rows).toHaveLength(1);
  });
});
