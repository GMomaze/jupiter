import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createActiveTenantContextMiddleware } from './active-tenant-context.middleware.js';
import { TenantSuspensionAccessCoordinator } from './tenant-suspension-access-coordinator.js';
import { createCustomerPortalSuspensionMiddleware } from '../customer-portal/customer-portal-suspension.middleware.js';

const tenantId = '60300000-0000-4000-8000-000000000001';
const membershipId = '60300000-0000-4000-8000-000000000002';
const userId = '60300000-0000-4000-8000-000000000003';
const stored = { tenantId, membershipId, contextVersion: 1 as const, selectedAt: 1, validatedAt: 2 };
const valid = {
  state: 'VALID_ACTIVE_TENANT' as const,
  tenant: { id: tenantId, publicId: '60300000-0000-4000-8000-000000000004', code: 'L3', displayName: 'L3', status: 'ACTIVE' as const },
  membership: { id: membershipId, tenantId, userId, status: 'ACTIVE' as const },
  validatedAt: 3,
};

function response() {
  const listeners = new Map<string, () => void>();
  const res: any = {
    once: vi.fn((event: string, callback: () => void) => { listeners.set(event, callback); return res; }),
    set: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(), redirect: vi.fn().mockReturnThis(),
  };
  return { res, finish: () => listeners.get('finish')?.() };
}

describe('L3-3 tenant suspension enforcement', () => {
  it('uses the same tenant key for a held shared access lease and releases exactly once', async () => {
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes('unlock') ? [{ released: true }] : [{}] }));
    const release = vi.fn();
    const coordinator = new TenantSuspensionAccessCoordinator({ connect: vi.fn(async () => ({ query, release })) });
    const lease = await coordinator.acquire(tenantId);
    await lease.release();
    await lease.release();
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain('pg_advisory_lock_shared');
    expect(query.mock.calls[1]?.[0]).toContain('pg_advisory_unlock_shared');
    expect(query.mock.calls.every(call => call[0].includes('7290185754895614303'))).toBe(true);
    expect(query.mock.calls.every(call => call[1][0] === tenantId)).toBe(true);
    expect(release).toHaveBeenCalledOnce();
  });

  it('denies a stale staff/ADMIN context suspended while the shared lock is being acquired', async () => {
    const revalidateStoredContext = vi.fn()
      .mockResolvedValueOnce(valid)
      .mockResolvedValueOnce({ state: 'SUSPENDED_TENANT' });
    const lease = { release: vi.fn(async () => undefined) };
    const coordinator = { acquire: vi.fn(async () => lease) };
    const middleware = createActiveTenantContextMiddleware({ revalidateStoredContext } as any, coordinator as any);
    const req: any = { session: { activeTenantContext: stored, save: (done: Function) => done() }, user: { id: userId, roles: [{ code: 'ADMIN' }] }, isAuthenticated: () => true, get: () => undefined, accepts: () => false };
    const h = response();
    await middleware.resolveTenantContext(req, h.res, vi.fn());
    const next = vi.fn();
    await middleware.requireValidActiveTenantContext(req, h.res, next);
    expect(coordinator.acquire).toHaveBeenCalledWith(tenantId);
    expect(lease.release).toHaveBeenCalledOnce();
    expect(req.session.activeTenantContext).toBeUndefined();
    expect(req.tenantAuthority).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
    expect(h.res.redirect).toHaveBeenCalledWith(303, '/organisation/unavailable');
  });

  it('holds valid staff access through response completion and revalidates after locking', async () => {
    const revalidateStoredContext = vi.fn().mockResolvedValue(valid);
    const lease = { release: vi.fn(async () => undefined) };
    const middleware = createActiveTenantContextMiddleware({ revalidateStoredContext } as any, { acquire: vi.fn(async () => lease) } as any);
    const req: any = { session: { activeTenantContext: stored }, user: { id: userId }, isAuthenticated: () => true, get: () => undefined, accepts: () => false };
    const h = response();
    await middleware.resolveTenantContext(req, h.res, vi.fn());
    const next = vi.fn();
    await middleware.requireValidActiveTenantContext(req, h.res, next);
    expect(revalidateStoredContext).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledOnce();
    expect(req.tenantAuthority.tenantId).toBe(tenantId);
    expect(lease.release).not.toHaveBeenCalled();
    h.finish();
    await Promise.resolve();
    expect(lease.release).toHaveBeenCalledOnce();
  });

  it('denies Customer Portal when suspension wins the lock race and releases the lease', async () => {
    const resolveIdentity = vi.fn()
      .mockResolvedValueOnce({ customerUserId: userId, customerId: membershipId, tenantId })
      .mockResolvedValueOnce(undefined);
    const lease = { release: vi.fn(async () => undefined) };
    const middleware = createCustomerPortalSuspensionMiddleware({ acquire: vi.fn(async () => lease) } as any, { resolveIdentity });
    const req: any = { session: { customerUser: { id: userId } }, headers: {} };
    const h = response();
    const next = vi.fn();
    await middleware(req, h.res, next);
    expect(resolveIdentity).toHaveBeenCalledTimes(2);
    expect(lease.release).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
    expect(h.res.redirect).toHaveBeenCalledWith('/customer-auth/login');
  });

  it('holds active Customer Portal access and preserves tenant-owned file gating', async () => {
    const resolved = { customerUserId: userId, customerId: membershipId, tenantId };
    const lease = { release: vi.fn(async () => undefined) };
    const middleware = createCustomerPortalSuspensionMiddleware({ acquire: vi.fn(async () => lease) } as any, { resolveIdentity: vi.fn(async () => resolved) });
    const req: any = { session: { customerUser: { id: userId } }, headers: {} };
    const h = response();
    const next = vi.fn();
    await middleware(req, h.res, next);
    expect(next).toHaveBeenCalledOnce();
    h.finish();
    await Promise.resolve();
    expect(lease.release).toHaveBeenCalledOnce();
    const uploads = fs.readFileSync('src/modules/uploads/upload-delivery.routes.ts', 'utf8');
    expect(uploads).toMatch(/\/aircraft\/:filename', requireAuth, requireValidActiveTenantContext/);
    expect(uploads).not.toMatch(/\/manufacturers\/:filename', requireAuth, requireValidActiveTenantContext/);
  });

  it('mounts the portal suspension gate and leaves only global or dormant scheduled work', () => {
    const app = fs.readFileSync('src/app.ts', 'utf8');
    const server = fs.readFileSync('src/server.ts', 'utf8');
    const sb = fs.readFileSync('src/modules/service-bulletins/service-bulletin-sync.service.ts', 'utf8');
    const maintenance = fs.readFileSync('src/modules/maintenance/maintenance-trigger.service.ts', 'utf8');
    const projection = fs.readFileSync('src/modules/compliance/compliance-projection.service.ts', 'utf8');
    expect(app).toContain("app.use('/customer-portal', createCustomerPortalSuspensionMiddleware(tenantSuspensionAccessCoordinator), customerPortalRoutes)");
    expect(server).toContain('ServiceBulletinSyncService.startCronJob()');
    expect(sb).toContain("resolveService('SB_SYNC_SCHEDULER')");
    expect(sb).not.toMatch(/TenantQueryAuthority|tenantAuthority/);
    expect(maintenance).toContain('DORMANT_MAINTENANCE_SHARED_WRITER_DISABLED');
    expect(projection.match(/DORMANT_COMPLIANCE_PROJECTION_WRITER_DISABLED/g)).toHaveLength(3);
  });
});
