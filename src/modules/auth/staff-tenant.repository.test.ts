import { describe, it, expect, vi } from 'vitest';
import { PostgresStaffTenantRepository, STAFF_TENANT_TARGET_UNAVAILABLE } from './staff-tenant.repository.js';
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
        if (String(sql).includes('resolve_tenant_membership_roles')) return { rowCount: 0, rows: [] };
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

describe('PostgresStaffTenantRepository role-assignment reads (SQLSTATE 42501 regression)', () => {
  it('reads staff roles only through the SECURITY DEFINER resolver, never by direct SELECT on tenant_membership_roles', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => { queries.push(String(sql)); return { rows: [] }; }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new PostgresStaffTenantRepository(pool as never);

    await repository.listStaff(authority());

    const listSql = queries.find((q) => q.includes('tenant_memberships') && q.includes('users'));
    expect(listSql).toBeDefined();
    expect(listSql).toContain('resolve_tenant_membership_roles');
    expect(listSql).toContain('resolve_tenant_membership_roles()');
    // jupiter_app is denied SELECT on tenant_membership_roles (migration 602); a direct
    // join would raise SQLSTATE 42501.
    expect(listSql).not.toMatch(/FROM\s+tenant_membership_roles/);
    expect(listSql).not.toMatch(/JOIN\s+tenant_membership_roles/);
  });

  it('toggles roles without any direct SELECT on tenant_membership_roles', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(String(sql));
        if (String(sql).includes('FOR UPDATE') && String(sql).includes('tenant_memberships')) return { rowCount: 1, rows: [{ id: 'm1' }] };
        if (String(sql).includes('FROM rf_role')) return { rowCount: 1, rows: [{ id: 'r1', code: 'ENGINEER' }] };
        if (String(sql).includes('resolve_tenant_membership_roles')) return { rowCount: 0, rows: [] };
        return { rowCount: 0, rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new PostgresStaffTenantRepository(pool as never);

    await repository.toggleRole(authority(), 'u2', 'r1', 'u1');

    const allSql = queries.join('\n');
    expect(allSql).toContain('resolve_tenant_membership_roles');
    expect(allSql).not.toMatch(/FROM\s+tenant_membership_roles/);
    expect(allSql).not.toMatch(/JOIN\s+tenant_membership_roles/);
  });
});

describe('PostgresStaffTenantRepository membership-status visibility', () => {
  it('lists ACTIVE and DISABLED memberships for the current tenant, not only ACTIVE', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => { queries.push(String(sql)); return { rows: [] }; }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new PostgresStaffTenantRepository(pool as never);

    await repository.listStaff(authority());

    const listSql = queries.find((q) => q.includes('tenant_memberships') && q.includes('users'));
    expect(listSql).toBeDefined();
    expect(listSql).toContain("tm.status IN ('ACTIVE','DISABLED')");
    expect(listSql).not.toContain("tm.status = 'ACTIVE'");
  });

  it('selects the tenant membership status from the membership row', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => { queries.push(String(sql)); return { rows: [] }; }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new PostgresStaffTenantRepository(pool as never);

    await repository.listStaff(authority());

    const listSql = queries.find((q) => q.includes('tenant_memberships') && q.includes('users'));
    expect(listSql).toBeDefined();
    expect(listSql).toContain('membership_status');
  });

  it('rejects role changes on DISABLED memberships server-side (lock filters ACTIVE)', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(String(sql));
        if (String(sql).includes('FOR UPDATE') && String(sql).includes('tenant_memberships')) return { rowCount: 0, rows: [] };
        return { rowCount: 0, rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new PostgresStaffTenantRepository(pool as never);

    await expect(repository.toggleRole(authority(), 'u2', 'r1', 'u1')).rejects.toThrow(STAFF_TENANT_TARGET_UNAVAILABLE);

    const lockSql = queries.find((q) => q.includes('FOR UPDATE') && q.includes('tenant_memberships'));
    expect(lockSql).toContain("status = 'ACTIVE'");
  });
});
