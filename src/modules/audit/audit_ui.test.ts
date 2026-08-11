import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { User, Role } from '../../models/index.js';
import { v4 as uuid } from 'uuid';
import { pool } from '../../config/database.js';
import { hashPassword } from '../auth/password.util.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';

describe('Phase 3.5: Audit UI Integration Tests', () => {
  let agent: request.SuperAgentTest;
  let userId: string;

  beforeEach(async () => {
    await assertTestDatabaseSafety(pool);
    userId = '';

    agent = request.agent(app);

    const role = await Role.findOne({ where: { code: 'ADMIN' } });

    if (!role) {
      throw new Error('Seeded ADMIN role is required.');
    }

    userId = uuid();

    const password = 'password123';
    const hash = await hashPassword(password);
    const email = `audit-admin-${userId}@test.com`;

    await User.create({
      id: userId,
      email,
      password_hash: hash,
      full_name: 'Audit Admin',
      is_active: true
    });

    await pool.query(
      'INSERT INTO user_roles (id, user_id, role_id) VALUES ($1, $2, $3)',
      [uuid(), userId, role.id]
    );

    const loginRes = await agent
      .post('/auth/login')
      .set('Accept', 'application/json')
      .send({ email, password });

    expect(loginRes.status).toBe(200);
  });

  afterEach(async () => {
    if (!userId) return;

    await pool.query(
      "DELETE FROM sessions WHERE sess -> 'passport' ->> 'user' = $1",
      [userId]
    );
    await pool.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  });

  it('should render the audit log page', async () => {
    const res = await agent.get('/audit');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Audit Log');
  });
});
