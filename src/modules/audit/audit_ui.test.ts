import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { User, Role, Permission } from '../../models/index.js';
import { v4 as uuid } from 'uuid';
import { pool } from '../../config/database.js';
import { hashPassword } from '../auth/password.util.js';

describe('Phase 3.5: Audit UI Integration Tests', () => {
  let agent: request.SuperAgentTest;

  beforeEach(async () => {
    agent = request.agent(app);

    // 1. Bypass Immutability & Clear Tables
    await pool.query("SET app.is_test_mode = 'true'");
    await pool.query(
      'TRUNCATE TABLE users, rf_role, rf_permission, user_roles, sessions RESTART IDENTITY CASCADE'
    );
    await pool.query("SET app.is_test_mode = 'false'");

    const roleId = uuid();
    const permId = uuid();
    const userId = uuid();

    // 2. Seed RBAC
    await Permission.create({
      id: permId,
      code: 'AUDIT_VIEW',
      label: 'View Audit Log',
      module: 'AUDIT'
    });

    await Role.create({
      id: roleId,
      code: 'ADMIN',
      label: 'Admin'
    });

    await pool.query(
      'INSERT INTO rf_role_permissions (id, role_id, permission_id) VALUES ($1, $2, $3)',
      [uuid(), roleId, permId]
    );

    // 3. Seed User (USING ARGON2)
    const password = 'password123';
    const hash = await hashPassword(password);

    await User.create({
      id: userId,
      email: 'audit-admin@test.com',
      password_hash: hash,
      full_name: 'Audit Admin',
      is_active: true
    });

    await pool.query(
      'INSERT INTO user_roles (id, user_id, role_id) VALUES ($1, $2, $3)',
      [uuid(), userId, roleId]
    );

    // 4. Login
    const loginRes = await agent
      .post('/auth/login')
      .set('Accept', 'application/json')
      .send({ email: 'audit-admin@test.com', password });

    expect(loginRes.status).toBe(200);
  });

  it('should render the audit log page', async () => {
    const res = await agent.get('/audit');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Audit Log');
  });
});