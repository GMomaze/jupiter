import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const controls = vi.hoisted(() => ({
  strategy: undefined as any,
  serializer: undefined as any,
  deserializer: undefined as any,
  verifyPassword: vi.fn(),
  findOne: vi.fn(),
  findByPk: vi.fn(),
  use: vi.fn(),
  serializeUser: vi.fn(),
  deserializeUser: vi.fn(),
}));

vi.mock('passport-local', () => ({
  Strategy: class LocalStrategy {
    readonly options: unknown;
    readonly verify: unknown;

    constructor(options: unknown, verify: unknown) {
      this.options = options;
      this.verify = verify;
      controls.strategy = this;
    }
  },
}));

vi.mock('passport', () => ({
  default: {
    use: controls.use,
    serializeUser: controls.serializeUser.mockImplementation((callback) => {
      controls.serializer = callback;
    }),
    deserializeUser: controls.deserializeUser.mockImplementation((callback) => {
      controls.deserializer = callback;
    }),
  },
}));

vi.mock('./password.util.js', () => ({
  verifyPassword: controls.verifyPassword,
}));

vi.mock('../../models/index.js', () => ({
  User: { findOne: controls.findOne, findByPk: controls.findByPk },
  Role: class Role {},
  Permission: class Permission {},
}));

import { setupAuth } from './auth.config.js';

const read = (relative: string) => fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');

function productionTypeScriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionTypeScriptFiles(resolved);
    return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
      ? [resolved]
      : [];
  });
}

describe('single active Passport authority', () => {
  beforeEach(() => {
    controls.strategy = undefined;
    controls.serializer = undefined;
    controls.deserializer = undefined;
    controls.verifyPassword.mockReset();
    controls.findOne.mockReset();
    controls.findByPk.mockReset();
    controls.use.mockClear();
    controls.serializeUser.mockClear();
    controls.deserializeUser.mockClear();
    setupAuth();
  });

  it('keeps app startup wired only to setupAuth from auth.config', () => {
    const app = read('src/app.ts');
    expect(app).toContain("import { setupAuth } from './modules/auth/auth.config.js'");
    expect(app).toContain('setupAuth();');
    expect(app).not.toMatch(/configurePassport|passport\.config/);
  });

  it('has one Passport source authority and no configurePassport production caller', () => {
    const authDirectory = path.resolve(process.cwd(), 'src/modules/auth');
    expect(fs.existsSync(path.join(authDirectory, 'passport.config.ts'))).toBe(false);
    const productionSource = productionTypeScriptFiles(path.resolve(process.cwd(), 'src'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    expect(productionSource).not.toMatch(/\bconfigurePassport\b|passport\.config/);
  });

  it('preserves the email LocalStrategy and global user lookup', async () => {
    expect(controls.strategy.options).toEqual({ usernameField: 'email' });
    controls.findOne.mockResolvedValue(null);
    const done = vi.fn();
    await controls.strategy.verify(' Staff@Example.COM ', 'password', done);
    expect(controls.findOne).toHaveBeenCalledWith({ where: { email: 'staff@example.com' } });
  });

  it.each([
    ['missing user', null],
    ['inactive user', { id: 'user-1', is_active: false, password_hash: 'hash' }],
  ])('preserves generic rejection for %s', async (_label, user) => {
    controls.findOne.mockResolvedValue(user);
    const done = vi.fn();
    await controls.strategy.verify('staff@example.com', 'password', done);
    expect(done).toHaveBeenCalledWith(null, false, { message: 'Invalid credentials.' });
    expect(controls.verifyPassword).not.toHaveBeenCalled();
  });

  it('preserves shared password verification and generic invalid-password rejection', async () => {
    const user = { id: 'user-1', is_active: true, password_hash: 'hash' };
    controls.findOne.mockResolvedValue(user);
    controls.verifyPassword.mockResolvedValue(false);
    const done = vi.fn();
    await controls.strategy.verify('staff@example.com', 'password', done);
    expect(controls.verifyPassword).toHaveBeenCalledWith('hash', 'password');
    expect(done).toHaveBeenCalledWith(null, false, { message: 'Invalid credentials.' });
  });

  it('serializes the global user ID', () => {
    const done = vi.fn();
    controls.serializer({ id: 'user-1' }, done);
    expect(done).toHaveBeenCalledWith(null, 'user-1');
  });

  it('deserializes only active users with role and permission hydration', async () => {
    const user = {
      id: 'user-1', email: 'staff@example.com', full_name: 'Staff User', is_active: true,
      Roles: [{ code: 'ADMIN', Permissions: [{ code: 'AUDIT_VIEW' }] }],
    };
    controls.findByPk.mockResolvedValue(user);
    const done = vi.fn();
    await controls.deserializer('user-1', done);
    expect(controls.findByPk).toHaveBeenCalledWith('user-1', expect.objectContaining({
      include: [expect.objectContaining({ through: { attributes: [] }, include: [expect.any(Object)] })],
    }));
    expect(done).toHaveBeenCalledWith(null, {
      id: 'user-1', email: 'staff@example.com', full_name: 'Staff User',
      roles: [{ code: 'ADMIN', permissions: [{ code: 'AUDIT_VIEW' }] }],
    });
  });

  it('rejects an inactive deserialized user without returning an RBAC identity', async () => {
    controls.findByPk.mockResolvedValue({ id: 'user-1', is_active: false });
    const done = vi.fn();
    await controls.deserializer('user-1', done);
    expect(done).toHaveBeenCalledWith(null, false);
  });

  it('leaves customer authentication Passport-independent and introduces no tenant authority', () => {
    const customerAuth = read('src/modules/customer-auth/customer-auth.routes.ts');
    const activeAuth = read('src/modules/auth/auth.config.ts');
    expect(customerAuth).not.toMatch(/passport|setupAuth|configurePassport|UserService/);
    expect(activeAuth).not.toMatch(/Tenant|tenant_membership|activeTenant|platform|ROW LEVEL SECURITY/i);
  });
});
