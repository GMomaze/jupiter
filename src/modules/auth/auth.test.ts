import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { User, Role } from '../../models/index.js';
import { v4 as uuid } from 'uuid';
import { hashPassword } from './password.util.js';

describe('Phase 2.5: Authentication & Authorization Tests', () => {
  const email = 'test@example.com';
  const password = 'password123';

  beforeEach(async () => {
    await User.destroy({ where: {}, cascade: true });
  });

  it('should login successfully with valid credentials', async () => {
    // Use Argon2 instead of bcrypt
    const hash = await hashPassword(password);

    // 1. Create User
    const user = await User.create({
      id: uuid(),
      email,
      password_hash: hash,
      full_name: 'Test User',
      is_active: true
    });

    // 2. Seed Role
    const [role] = await Role.findOrCreate({
      where: { code: 'ADMIN' },   // Use consistent uppercase
      defaults: {
        id: uuid(),
        label: 'Admin'
      }
    });

    await user.addRole(role);

    // 3. Test Authentication
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password });

    expect([200, 302]).toContain(res.status);

    if (res.status === 302) {
      expect(res.headers.location).toBeDefined();
    } else {
      expect(res.body.success ?? true).toBeTruthy();
    }

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
  });
});