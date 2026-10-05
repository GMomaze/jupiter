import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { createCustomerPortalAuthorityMiddleware } from './customer-portal-authority.middleware.js';
import { assertCustomerPortalQueryAuthority, createCustomerPortalQueryAuthority } from './customer-portal-query-authority.js';
import { CustomerPortalService } from './customer-portal.service.js';

const authority = createCustomerPortalQueryAuthority({
  customerUserId: 'user-a', customerId: 'customer-a', tenantId: 'tenant-a',
});
const validCustomerUserId = '11111111-1111-4111-8111-111111111111';
const missingCustomerUserId = '22222222-2222-4222-8222-222222222222';

function repository() {
  return {
    resolveIdentity: vi.fn().mockResolvedValue({
      customerUserId: validCustomerUserId, customerId: 'persisted-customer', tenantId: 'tenant-a',
      email: 'a@example.test', displayName: 'A', customerName: 'Customer A',
    }),
    getIdentity: vi.fn().mockResolvedValue(undefined),
    listAircraft: vi.fn().mockResolvedValue([]),
    listWorkpacks: vi.fn().mockResolvedValue([]),
    listReleasedDocuments: vi.fn().mockResolvedValue([]),
    listCompletedCompliance: vi.fn().mockResolvedValue([]),
  };
}

describe('MT-4C7C Customer Portal authority boundary', () => {
  it('rejects plain objects and staff TenantQueryAuthority', () => {
    expect(() => assertCustomerPortalQueryAuthority({
      customerUserId: 'user-a', customerId: 'customer-a', tenantId: 'tenant-a',
    })).toThrow('CUSTOMER_PORTAL_AUTHORITY_REQUIRED');
    const staff = createTenantQueryAuthority({
      state: 'VALID_ACTIVE_TENANT',
      tenant: { id: 'tenant-a', publicId: 'public-a', code: 'A', displayName: 'A', status: 'ACTIVE' },
      membership: { id: 'member-a', tenantId: 'tenant-a', userId: 'staff-a', status: 'ACTIVE' },
      validatedAt: 1,
    });
    expect(() => assertCustomerPortalQueryAuthority(staff)).toThrow('CUSTOMER_PORTAL_AUTHORITY_REQUIRED');
  });

  it('uses only session CustomerUser ID and ignores the session Customer snapshot', async () => {
    const port = repository();
    const middleware = createCustomerPortalAuthorityMiddleware(port);
    const req = {
      session: { customerUser: { id: validCustomerUserId, customer_id: 'foreign-client-snapshot' } }, headers: {},
    } as never;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), redirect: vi.fn() } as never;
    const next = vi.fn();
    await middleware(req, res, next);
    expect(port.resolveIdentity).toHaveBeenCalledWith(validCustomerUserId);
    expect((req as { customerPortalAuthority?: unknown }).customerPortalAuthority).toMatchObject({
      customerUserId: validCustomerUserId, customerId: 'persisted-customer', tenantId: 'tenant-a',
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it('fails closed when persisted identity is unavailable', async () => {
    const port = repository();
    port.resolveIdentity.mockResolvedValue(undefined);
    const middleware = createCustomerPortalAuthorityMiddleware(port);
    const req = { session: { customerUser: { id: missingCustomerUserId } }, headers: { accept: 'application/json' } } as never;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), redirect: vi.fn() } as never;
    await middleware(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Customer authentication required' });
    expect(port.resolveIdentity).toHaveBeenCalledWith(missingCustomerUserId);
  });

  it.each([undefined, null, '', 'not-a-uuid', 123])(
    'rejects unusable session CustomerUser ID %j before repository lookup',
    async (customerUserId) => {
      const port = repository();
      const middleware = createCustomerPortalAuthorityMiddleware(port);
      const req = {
        session: { customerUser: { id: customerUserId, customer_id: 'foreign-client-snapshot' } },
        headers: { accept: 'application/json' },
      } as never;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), redirect: vi.fn() } as never;
      const next = vi.fn();
      await middleware(req, res, next);
      expect(port.resolveIdentity).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Customer authentication required' });
      expect((req as { customerPortalAuthority?: unknown }).customerPortalAuthority).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    },
  );

  it('requires authentic authority across every service projection', async () => {
    const port = repository();
    const service = new CustomerPortalService(port);
    const forged = { customerUserId: 'user-a', customerId: 'customer-a', tenantId: 'tenant-a' } as never;
    for (const call of [
      () => service.getIdentity(forged), () => service.listAircraft(forged),
      () => service.listWorkpacks(forged), () => service.listReleasedDocuments(forged),
      () => service.listCompletedCompliance(forged),
    ]) await expect(call()).rejects.toThrow('CUSTOMER_PORTAL_AUTHORITY_REQUIRED');
    await service.listAircraft(authority);
    expect(port.listAircraft).toHaveBeenCalledWith(authority);
  });

  it('places all five mounted reads behind authentication and authority without route queries', () => {
    const root = path.resolve(process.cwd(), 'src/modules/customer-portal');
    const routes = fs.readFileSync(path.join(root, 'customer-portal.routes.ts'), 'utf8');
    const live = fs.readFileSync(path.join(root, 'customer-portal.repository.live.ts'), 'utf8');
    expect(routes.indexOf('router.use(ensureCustomerAuthenticated)')).toBeLessThan(
      routes.indexOf('router.use(resolveCustomerPortalAuthority)'),
    );
    for (const route of ["'/'", "'/aircraft'", "'/workpacks'", "'/documents'", "'/compliance'"]) {
      expect(routes).toContain(`router.get(${route}`);
    }
    expect(routes).not.toMatch(/sequelize|Customer\.find|Aircraft\.find|CustomerAircraftLink/);
    expect(routes).not.toMatch(/req\.(?:query|params|body).*tenant|req\.(?:query|params|body).*customer_id/);
    expect(live).toMatch(/c\.tenant_id = :tenantId[\s\S]*a\.tenant_id = :tenantId/);
    expect(live).toMatch(/a\.tenant_id = :tenantId AND w\.tenant_id = :tenantId/);
    expect(live).toMatch(/cal\.is_current = true[\s\S]*cal\.relationship_type IN/);
    expect(live).toMatch(/w\.released_at IS NOT NULL/);
    expect(live).toMatch(/wc\.status = 'COMPLETED'/);
    expect(routes + live).not.toContain('TenantQueryAuthority');
  });
});
