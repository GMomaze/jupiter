import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { StaffTenantService } from './staff-tenant.service.js';
import type { StaffTenantRepository } from './staff-tenant.repository.js';

const id = (digit: string) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const context = { state: 'VALID_ACTIVE_TENANT' as const, validatedAt: 1,
  tenant: { id: id('1'), publicId: 'a', code: 'A', displayName: 'A', status: 'ACTIVE' as const },
  membership: { id: id('2'), tenantId: id('1'), userId: id('3'), status: 'ACTIVE' as const } };
function repo(): StaffTenantRepository { return { listStaff: vi.fn().mockResolvedValue([]), listAssignableRoles: vi.fn().mockResolvedValue([]), toggleRole: vi.fn().mockResolvedValue('ASSIGNED') }; }

describe('tenant-local staff service and query boundary', () => {
  it('accepts authentic authority and rejects structural substitutes', async () => {
    const repository = repo(); const service = new StaffTenantService(repository);
    await service.list(createTenantQueryAuthority(context));
    await expect(service.list({ tenantId: id('1') } as any)).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
  });
  it('rejects malformed target IDs before persistence', async () => {
    const repository = repo(); const service = new StaffTenantService(repository);
    await expect(service.toggleRole(createTenantQueryAuthority(context), { targetUserId: 'foreign', roleId: id('5'), actorUserId: id('3') }))
      .rejects.toThrow('STAFF_TENANT_REQUEST_INVALID');
    expect(repository.toggleRole).not.toHaveBeenCalled();
  });
  it('tenant-roots listing and append/revoke writes without global user_roles mutation', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/modules/auth/staff-tenant.repository.ts'), 'utf8');
    expect(source).toMatch(/FROM tenant_memberships tm/);
    expect(source).toMatch(/tm\.tenant_id = \$1/);
    expect(source).toContain("tm.status = 'ACTIVE'");
    expect(source).toContain('INSERT INTO tenant_membership_roles');
    expect(source).toContain('revoked_by_user_id');
    expect(source).not.toMatch(/(?:INSERT INTO|DELETE FROM|UPDATE)\s+user_roles/i);
    expect(source).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+rf_(?:role|permission|role_permissions)/i);
  });
});
