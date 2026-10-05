import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { Op } from 'sequelize';
import app from '../../app.js';
import {
  ServiceBulletinSyncRun,
  User,
} from '../../models/index.js';
import { pool } from '../../config/database.js';
import { hashPassword } from '../auth/password.util.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';

describe('Phase 8: Service bulletin sync UI', () => {
  const testCategory = 'INTEGRATION SAFE-FIXTURE';
  let agent: request.SuperAgentTest;
  let ownedUserId: string | undefined;
  let ownedSyncRunIds: string[] = [];

  beforeEach(async () => {
    await assertTestDatabaseSafety(pool);
    ownedUserId = undefined;
    ownedSyncRunIds = [];
    void testCategory;
    agent = request.agent(app);

    const olderRunId = uuid();
    const newerRunId = uuid();
    const olderRun = await ServiceBulletinSyncRun.create({
      id: olderRunId,
      trigger_type: 'MANUAL',
      status: 'FAILED',
      synced_count: 1,
      created_count: 0,
      updated_count: 0,
      error_message: `Owned older run ${olderRunId}`,
      started_at: new Date('9999-12-30T07:00:00.000Z'),
      finished_at: new Date('9999-12-30T07:01:00.000Z'),
    });
    ownedSyncRunIds.push(olderRun.id);

    const newerRun = await ServiceBulletinSyncRun.create({
      id: newerRunId,
      trigger_type: 'CRON',
      status: 'SUCCESS',
      synced_count: 7,
      created_count: 5,
      updated_count: 2,
      started_at: new Date('9999-12-31T07:00:00.000Z'),
      finished_at: new Date('9999-12-31T07:05:00.000Z'),
    });
    ownedSyncRunIds.push(newerRun.id);

    const password = 'password123';
    const passwordHash = await hashPassword(password);
    const userFixtureId = uuid();
    const email = `sb-ui+${userFixtureId}@tests.jupiter.invalid`;
    const user = await User.create({
      id: userFixtureId,
      email,
      password_hash: passwordHash,
      full_name: 'SB UI Tester',
      is_active: true,
    });
    ownedUserId = user.id;

    const loginResponse = await agent
      .post('/auth/login')
      .set('Accept', 'application/json')
      .send({ email, password });

    expect(loginResponse.status).toBe(200);
  });

  afterEach(async () => {
    const userId = ownedUserId;
    const syncRunIds = [...ownedSyncRunIds];
    ownedUserId = undefined;
    ownedSyncRunIds = [];

    try {
      if (userId) {
        await pool.query(
          "DELETE FROM sessions WHERE sess -> 'passport' ->> 'user' = $1",
          [userId]
        );
      }
    } finally {
      try {
        if (userId) await User.destroy({ where: { id: userId } });
      } finally {
        if (syncRunIds.length > 0) {
          await ServiceBulletinSyncRun.destroy({
            where: { id: { [Op.in]: syncRunIds } },
          });
        }
      }
    }
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
