import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import type { StaffTenantRepository } from './staff-tenant.repository.js';

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  membership: '20000000-0000-4000-8000-000000000001',
  actor: '30000000-0000-4000-8000-000000000001',
  target: '40000000-0000-4000-8000-000000000001',
  role: '50000000-0000-4000-8000-000000000001',
};
const controls = vi.hoisted(() => ({ authenticated: false, admin: false, order: [] as string[] }));
vi.mock('../../config/database.js', () => ({ pool: {} }));
vi.mock('../../middleware/auth.middleware.js', () => ({
  ensureAuthenticated: (_req: unknown, res: any, next: () => void) => {
    controls.order.push('authentication');
    return controls.authenticated ? next() : res.status(401).send();
  },
}));
vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireRole: () => (_req: unknown, res: any, next: () => void) => {
    controls.order.push('ADMIN');
    return controls.admin ? next() : res.status(403).send();
  },
}));
import { createStaffRouter } from './staff.routes.js';

function authority() {
  return createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT', validatedAt: Date.now(),
    tenant: { id: ids.tenant, publicId: 'tenant-a', code: 'A', displayName: 'A', status: 'ACTIVE' },
    membership: { id: ids.membership, tenantId: ids.tenant, userId: ids.actor, status: 'ACTIVE' },
  });
}
function harness(repository: StaffTenantRepository) {
  const instance = express();
  instance.use(express.urlencoded({ extended: true }));
  instance.use((req: any, _res, next) => { req.user = { id: ids.actor }; next(); });
  instance.use('/auth/staff', createStaffRouter(
    (req: any, _res, next) => { controls.order.push('tenantGate'); req.tenantAuthority = authority(); next(); },
    { repository, hydrateActiveTenantRbac: (_req, _res, next) => { controls.order.push('tenantRbac'); next(); } },
  ));
  instance.response.render = function (_view: string, data: unknown) { return this.status(200).json(data); };
  return instance;
}
function repository(): StaffTenantRepository {
  return {
    listStaff: vi.fn().mockResolvedValue([]),
    listAssignableRoles: vi.fn().mockResolvedValue([]),
    toggleRole: vi.fn().mockResolvedValue('ASSIGNED'),
  };
}

describe('/auth/staff tenant boundary', () => {
  beforeEach(() => { controls.authenticated = false; controls.admin = false; controls.order.length = 0; });
  it('blocks unauthenticated and non-ADMIN requests before tenant persistence', async () => {
    const repo = repository();
    expect((await request(harness(repo)).get('/auth/staff')).status).toBe(401);
    controls.authenticated = true;
    expect((await request(harness(repo)).get('/auth/staff')).status).toBe(403);
    expect(repo.listStaff).not.toHaveBeenCalled();
  });
  it('orders authentication, tenant RBAC, ADMIN, tenant gate, then authority repository', async () => {
    controls.authenticated = controls.admin = true;
    const repo = repository();
    expect((await request(harness(repo)).get('/auth/staff')).status).toBe(200);
    expect(controls.order).toEqual(['authentication', 'tenantRbac', 'ADMIN', 'tenantGate']);
    expect(repo.listStaff).toHaveBeenCalledWith(expect.objectContaining({ tenantId: ids.tenant }));
  });
  it('passes user and role IDs only behind authentic tenant authority', async () => {
    controls.authenticated = controls.admin = true;
    const repo = repository();
    expect((await request(harness(repo)).post('/auth/staff/toggle-role').type('form')
      .send({ userId: ids.target, roleId: ids.role, tenantId: 'foreign' })).status).toBe(200);
    expect(repo.toggleRole).toHaveBeenCalledWith(expect.objectContaining({ tenantId: ids.tenant }), ids.target, ids.role, ids.actor,
      'Tenant staff role administration', expect.any(String));
  });
});
