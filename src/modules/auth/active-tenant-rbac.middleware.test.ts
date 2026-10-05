import { describe, expect, it, vi } from 'vitest';
import { createActiveTenantRbacHydration } from './active-tenant-rbac.middleware.js';

const context: any = { state: 'VALID_ACTIVE_TENANT', tenant: { id: 'tenant-a' }, membership: { id: 'member-a', userId: 'user-a' } };
describe('active tenant RBAC hydration', () => {
  it('loads only the authenticated active membership roles and permissions', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ code: 'ADMIN', permissions: [{ code: 'LIBRARY_EDIT' }] }] });
    const req: any = { user: { id: 'user-a', roles: [{ code: 'GLOBAL' }] }, tenantContext: context };
    const next = vi.fn();
    await createActiveTenantRbacHydration({ query } as any)(req, {} as any, next);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('tenant_membership_roles'), ['member-a', 'tenant-a', 'user-a']);
    expect(req.user.roles).toEqual([{ code: 'ADMIN', permissions: [{ code: 'LIBRARY_EDIT' }] }]);
    expect(next).toHaveBeenCalledWith();
  });
  it('fails closed instead of retaining global roles without matching active context', async () => {
    const query = vi.fn(); const req: any = { user: { id: 'user-b', roles: [{ code: 'ADMIN' }] }, tenantContext: context };
    await createActiveTenantRbacHydration({ query } as any)(req, {} as any, vi.fn());
    expect(req.user.roles).toEqual([]); expect(query).not.toHaveBeenCalled();
  });
});
