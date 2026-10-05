import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createActiveTenantRbacHydration } from './active-tenant-rbac.middleware.js';
import { requirePermission, requireRole } from '../../middleware/rbac.middleware.js';

const read = (relative: string) => fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');

const VALID_CONTEXT: any = {
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a' },
  membership: { id: 'member-a', userId: 'user-a' },
};

const mockRes = (status: number) => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
  render: vi.fn(),
});

describe('active tenant RBAC hydration — global mounting', () => {
  it('mounts on the common tenant boundary after resolveTenantContext and before operational routes', () => {
    const app = read('src/app.ts');
    const resolve = app.indexOf('app.use(resolveTenantContext)');
    const hydrate = app.indexOf('app.use(createActiveTenantRbacHydration(pool))');
    const healthRoute = app.indexOf("app.use('/health'");

    expect(app).toContain('createActiveTenantRbacHydration');
    expect(resolve).toBeGreaterThanOrEqual(0);
    expect(hydrate).toBeGreaterThanOrEqual(0);
    // after tenant context resolution ...
    expect(hydrate).toBeGreaterThan(resolve);
    // ... and before the route registrations begin.
    expect(healthRoute).toBeGreaterThan(hydrate);
  });
});

describe('active tenant RBAC hydration — operational authority chain', () => {
  it('hydrates tenant-local ADMIN so requireRole and requirePermission pass on operational routes', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ code: 'ADMIN', permissions: [{ code: 'AD_AIRCRAFT_EDIT' }, { code: 'LIBRARY_EDIT' }] }],
    });
    const req: any = { user: { id: 'user-a' }, tenantContext: VALID_CONTEXT, headers: {} };

    await createActiveTenantRbacHydration({ query } as any)(req, {} as any, vi.fn());

    const roleNext = vi.fn();
    requireRole('ADMIN')(req, {} as any, roleNext);
    expect(roleNext).toHaveBeenCalledWith();

    const permNext = vi.fn();
    requirePermission('LIBRARY_EDIT')(req, {} as any, permNext);
    expect(permNext).toHaveBeenCalledWith();
  });

  it('discards non-active-tenant roles and hydrates only the active membership authority', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ code: 'ADMIN', permissions: [] }] });
    const req: any = { user: { id: 'user-a', roles: [{ code: 'VIEWER' }] }, tenantContext: VALID_CONTEXT };

    await createActiveTenantRbacHydration({ query } as any)(req, {} as any, vi.fn());

    expect(query).toHaveBeenCalledWith(expect.stringContaining('tenant_memberships'), ['member-a', 'tenant-a', 'user-a']);
    expect(req.user.roles).toEqual([{ code: 'ADMIN', permissions: [] }]);
    expect(req.user.roles.map((r: any) => r.code)).not.toContain('VIEWER');
  });

  it('filters to ACTIVE memberships in the authority query', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const req: any = { user: { id: 'user-a' }, tenantContext: VALID_CONTEXT };

    await createActiveTenantRbacHydration({ query } as any)(req, {} as any, vi.fn());

    expect(query).toHaveBeenCalledWith(expect.stringContaining("tm.status = 'ACTIVE'"), expect.any(Array));
  });

  it('fails closed with no active tenant context (no tenant-local authority)', async () => {
    const req: any = { user: { id: 'user-a', roles: [{ code: 'ADMIN' }] }, tenantContext: undefined, headers: {} };

    await createActiveTenantRbacHydration({ query: vi.fn() } as any)(req, {} as any, vi.fn());
    expect(req.user.roles).toEqual([]);

    const res = mockRes(403);
    requireRole('ADMIN')(req, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
