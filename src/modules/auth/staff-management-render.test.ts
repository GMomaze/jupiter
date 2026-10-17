import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

vi.mock('../../config/database.js', () => ({
  pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  ensureAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { createStaffRouter } from './staff.routes.js';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import type { StaffTenantRepository } from './staff-tenant.repository.js';

function buildApp(repository: StaffTenantRepository) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.resolve(__dirname, '../../views'));
  app.use(express.urlencoded({ extended: true }));

  // Mirror the res.locals populated by app.ts global middleware.
  app.use((req: express.Request, res: express.Response, next) => {
    (req as { user?: unknown }).user = {
      id: 'u1',
      email: 'graeme@waa.example',
      full_name: 'Graeme Mocke',
      roles: [{ code: 'ADMIN', permissions: [] }],
    };
    (req as { tenantAuthority?: unknown }).tenantAuthority = createTenantQueryAuthority({
      state: 'VALID_ACTIVE_TENANT',
      validatedAt: Date.now(),
      tenant: { id: 't1', publicId: 'p1', code: 'WAA', displayName: 'Whip-Air Aviation', status: 'ACTIVE' },
      membership: { id: 'm1', tenantId: 't1', userId: 'u1', status: 'ACTIVE' },
    });
    res.locals.user = (req as { user?: unknown }).user;
    res.locals.messages = {};
    res.locals.csrfToken = 'test-token';
    res.locals.remoteTestMode = false;
    res.locals.canPlatformAdmin = false;
    res.locals.activeOrganisationUi = {
      current: { tenantCode: 'WAA', tenantDisplayName: 'Whip-Air Aviation (WAA)' },
      alternatives: [],
    };
    next();
  });

  const requireValidActiveTenantContext = (req: express.Request, _res: express.Response, next: () => void) => {
    next();
  };

  app.use('/auth/staff', createStaffRouter(requireValidActiveTenantContext as never, {
    repository,
    hydrateActiveTenantRbac: (req: express.Request, _res: express.Response, next: () => void) => {
      (req as { user?: { roles?: unknown } }).user!.roles = [{ code: 'ADMIN', permissions: [] }];
      next();
    },
  }));

  return app;
}

describe('GET /auth/staff runtime rendering', () => {
  it('renders staff names and assigned roles for an authorised tenant admin', async () => {
    const repository: StaffTenantRepository = {
      listStaff: vi.fn().mockResolvedValue([
        { id: 'u1', email: 'graeme@waa.example', full_name: 'Graeme Mocke', is_active: true, roles: ['ADMIN'] },
        { id: 'u2', email: 'engineer@waa.example', full_name: 'Engineer One', is_active: true, roles: ['ENGINEER'] },
      ]),
      listAssignableRoles: vi.fn().mockResolvedValue([
        { id: 'r1', code: 'ADMIN', label: 'Administrator' },
        { id: 'r2', code: 'ENGINEER', label: 'Engineer' },
      ]),
      toggleRole: vi.fn().mockResolvedValue('ASSIGNED'),
    };

    const res = await request(buildApp(repository)).get('/auth/staff');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Staff Management');
    expect(res.text).toContain('Graeme Mocke');
    expect(res.text).toContain('Engineer One');
    expect(res.text).toContain('Administrator');
    expect(res.text).toContain('Engineer');
    expect(res.text).toContain('Whip-Air Aviation');
  });
});
