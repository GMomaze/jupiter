import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import app from '../../app.js';
import {
  AssetType,
  ComponentModel,
  Manufacturer,
  ServiceBulletinSyncRun,
  User,
} from '../../models/index.js';
import { pool } from '../../config/database.js';
import { hashPassword } from '../auth/password.util.js';

describe('Phase 8: Service bulletin sync UI', () => {
  let agent: request.SuperAgentTest;

  beforeEach(async () => {
    agent = request.agent(app);

    await pool.query("SET app.is_test_mode = 'true'");
    await pool.query(
      `
      TRUNCATE TABLE
        service_bulletin_sync_runs,
        service_bulletins,
        component_models,
        manufacturers,
        rf_asset_type,
        user_roles,
        sessions,
        users
      RESTART IDENTITY CASCADE
      `
    );
    await pool.query("SET app.is_test_mode = 'false'");

    const assetType = await AssetType.create({
      id: uuid(),
      code: 'ENGINE',
      label: 'Engine',
      is_installable_on_aircraft: true,
      is_required_for_aircraft: false,
      required_quantity: 0,
    });

    const manufacturer = await Manufacturer.create({
      id: uuid(),
      code: 'OEM-1',
      name: 'Omega Engines',
      is_active: true,
    });

    await ComponentModel.create({
      id: uuid(),
      model_name: 'OE-900',
      manufacturer_id: manufacturer.id,
      asset_type_id: assetType.id,
      is_active: true,
    });

    await ServiceBulletinSyncRun.create({
      id: uuid(),
      trigger_type: 'CRON',
      status: 'SUCCESS',
      synced_count: 7,
      created_count: 5,
      updated_count: 2,
      started_at: new Date('2026-03-29T07:00:00.000Z'),
      finished_at: new Date('2026-03-29T07:05:00.000Z'),
    });

    const password = 'password123';
    const passwordHash = await hashPassword(password);

    await User.create({
      id: uuid(),
      email: 'sb-ui@test.com',
      password_hash: passwordHash,
      full_name: 'SB UI Tester',
      is_active: true,
    });

    const loginResponse = await agent
      .post('/auth/login')
      .set('Accept', 'application/json')
      .send({ email: 'sb-ui@test.com', password });

    expect(loginResponse.status).toBe(200);
  });

  it('renders the latest sync state on the service bulletin page', async () => {
    const response = await agent.get('/service-bulletins');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Last Sync Time');
    expect(response.text).toContain('Sync Status');
    expect(response.text).toContain('Import Format');
    expect(response.text).toContain('Veryon CSV File');
    expect(response.text).toContain('Piper PDF File');
    expect(response.text).toContain('PIPER_PDF');
    expect(response.text).toContain('Load Piper PDF');
    expect(response.text).toContain('Veryon CSV');
    expect(response.text).toContain('ATP');
    expect(response.text).toContain('SUCCESS');
    expect(response.text).toContain('Trigger: CRON');
    expect(response.text).toContain('7 synced, 5 created, 2 updated');
    expect(response.text).toContain('/service-bulletins/sync-status');
  });

  it('returns the latest sync state from the sync status endpoint', async () => {
    const response = await agent
      .get('/service-bulletins/sync-status')
      .set('Accept', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body.syncStatus).toBe('SUCCESS');
    expect(response.body.lastRun.trigger_type).toBe('CRON');
    expect(response.body.lastRun.synced_count).toBe(7);
    expect(response.body.lastRun.created_count).toBe(5);
    expect(response.body.lastRun.updated_count).toBe(2);
    expect(response.body.lastSyncTime).toBeTruthy();
  });
});
