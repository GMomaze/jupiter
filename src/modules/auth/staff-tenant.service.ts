import { randomUUID } from 'node:crypto';
import { assertTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import type { StaffTenantRepository } from './staff-tenant.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const STAFF_TENANT_REQUEST_INVALID = 'STAFF_TENANT_REQUEST_INVALID';
export class StaffTenantService {
  constructor(private readonly repository: StaffTenantRepository) {}
  async list(authority: TenantQueryAuthority) {
    assertTenantQueryAuthority(authority);
    const [users, allRoles] = await Promise.all([this.repository.listStaff(authority), this.repository.listAssignableRoles(authority)]);
    return { users, allRoles };
  }
  async toggleRole(authority: TenantQueryAuthority, input: { targetUserId: unknown; roleId: unknown; actorUserId: unknown; reason?: unknown; correlationId?: unknown }) {
    assertTenantQueryAuthority(authority);
    if (typeof input.targetUserId !== 'string' || !UUID.test(input.targetUserId) ||
        typeof input.roleId !== 'string' || !UUID.test(input.roleId) ||
        typeof input.actorUserId !== 'string' || !UUID.test(input.actorUserId)) {
      throw new Error(STAFF_TENANT_REQUEST_INVALID);
    }
    const reason = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim() : 'Tenant staff role administration';
    const correlationId = typeof input.correlationId === 'string' ? input.correlationId : randomUUID();
    return this.repository.toggleRole(authority, input.targetUserId, input.roleId, input.actorUserId, reason, correlationId);
  }
}
