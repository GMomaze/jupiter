import { describe, it, expect, vi } from 'vitest';
import { PostgresStaffTenantRepository } from './staff-tenant.repository.js';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';

function authority() {
  return createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    validatedAt: Date.now(),
    tenant: { id: 't1', publicId: 't1', code: 'T', displayName: 'T', status: 'ACTIVE' },
    membership: { id: 'm1', tenantId: 't1', userId: 'u1', status: 'ACTIVE' },
  });
}

describe('PostgresStaffTenantRepository FORCE RLS tenant context', () => {
  it('establishes the tenant context before listing staff', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => { queries.push(String(sql)); return { rows: [] }; }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new PostgresStaffTenantRepository(pool as never);

    await repository.listStaff(authority());

    expect(queries.some((q) => q.includes("set_config('jupiter.tenant_id'"))).toBe(true);
    expect(queries.some((q) => q === 'BEGIN')).toBe(true);
    expect(queries.some((q) => q === 'COMMIT')).toBe(true);
    expect(client.release).toHaveBeenCalled();
  });

  it('establishes the tenant context before toggling a role', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(String(sql));
        if (String(sql).includes('FOR UPDATE') && String(sql).includes('tenant_memberships')) return { rowCount: 1, rows: [{ id: 'm1' }] };
        if (String(sql).includes('FROM rf_role')) return { rowCount: 1, rows: [{ id: 'r1', code: 'ENGINEER' }] };
        if (String(sql).includes('FROM tenant_membership_roles')) return { rowCount: 0, rows: [] };
        return { rowCount: 0, rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new PostgresStaffTenantRepository(pool as never);

    await repository.toggleRole(authority(), 'u2', 'r1', 'u1');

    expect(queries.some((q) => q.includes("set_config('jupiter.tenant_id'"))).toBe(true);
  });
});
