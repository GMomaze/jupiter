import { describe, expect, it, vi } from 'vitest';
import { PostgresStaffTenantRepository } from './staff-tenant.repository.js';
import { StaffMembershipAdministrationRepository } from './staff-membership-administration.js';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';

function authority() {
  return createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    validatedAt: Date.now(),
    tenant: { id: 't1', publicId: 't1', code: 'T', displayName: 'T', status: 'ACTIVE' },
    membership: { id: 'm1', tenantId: 't1', userId: 'u1', status: 'ACTIVE' },
  });
}

function capturingClient(overrides: (sql: string) => { rowCount?: number; rows?: Record<string, unknown>[] } = () => ({ rows: [] })) {
  const queries: string[] = [];
  const client = {
    query: vi.fn(async (sql: string) => {
      queries.push(String(sql));
      const r = overrides(String(sql));
      return { rowCount: r.rowCount ?? 0, rows: r.rows ?? [] };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn().mockResolvedValue(client) };
  return { queries, pool, client };
}

describe('tenant advisory-lock type regression (invitation/role-toggle deadlock)', () => {
  it('toggleRole uses the shared tenant work lock, not the exclusive lifecycle lock', async () => {
    const { queries, pool, client } = capturingClient((sql) => {
      if (sql.includes('FOR UPDATE') && sql.includes('tenant_memberships')) return { rowCount: 1, rows: [{ id: 'm1' }] };
      if (sql.includes('FROM rf_role')) return { rowCount: 1, rows: [{ id: 'r1', code: 'ENGINEER' }] };
      if (sql.includes('resolve_tenant_membership_roles')) return { rowCount: 0, rows: [] };
      return { rows: [] };
    });
    const repository = new PostgresStaffTenantRepository(pool as never);
    await repository.toggleRole(authority(), 'u2', 'r1', 'u1');
    expect(queries.some((q) => q.includes('pg_advisory_xact_lock_shared'))).toBe(true);
    expect(queries.some((q) => q.includes('pg_advisory_xact_lock('))).toBe(false);
    expect(client.release).toHaveBeenCalled();
  });

  it('invite uses the shared tenant work lock, not the exclusive lifecycle lock', async () => {
    const { queries, pool, client } = capturingClient((sql) => {
      if (sql.includes('FOR SHARE') && sql.includes('tenant_memberships')) return { rowCount: 1, rows: [{ id: 'm1' }] };
      if (sql.includes('resolve_tenant_membership_roles') && sql.includes('role_code')) return { rowCount: 1, rows: [{ role_code: 'ADMIN' }] };
      if (sql.includes('display_name')) return { rows: [{ display_name: 'Test Co' }] };
      return { rows: [] };
    });
    const repository = new StaffMembershipAdministrationRepository(pool as never);
    await repository.invite(authority(), {
      email: 'a@b.c', fullName: 'A', actorUserId: 'u1', expiresAt: new Date(),
      tokenHash: 'h', placeholderHash: 'p', correlationId: 'c', reason: 'r',
    });
    expect(queries.some((q) => q.includes('pg_advisory_xact_lock_shared'))).toBe(true);
    expect(queries.some((q) => q.includes('pg_advisory_xact_lock('))).toBe(false);
    // The actor's ADMIN role is resolved through the SECURITY DEFINER resolver, never by
    // a direct read of tenant_membership_roles (which jupiter_app is denied SELECT on).
    expect(queries.some((q) => q.includes('resolve_tenant_membership_roles'))).toBe(true);
    expect(queries.join('\n')).not.toMatch(/FROM\s+tenant_membership_roles|JOIN\s+tenant_membership_roles/);
    expect(client.release).toHaveBeenCalled();
  });

  it('setMembershipStatus resolves last-admin checks through the resolver, not direct reads', async () => {
    const { queries, pool, client } = capturingClient((sql) => {
      if (sql.includes('FOR SHARE') && sql.includes('tenant_memberships')) return { rowCount: 1, rows: [{ id: 'm1' }] };
      if (sql.includes('FOR UPDATE') && sql.includes('tenant_memberships')) return { rowCount: 1, rows: [{ id: 'm9', status: 'ACTIVE', joined_at: null }] };
      if (sql.includes('resolve_tenant_membership_roles') && sql.includes('membership_id = $1')) return { rowCount: 1, rows: [{ role_code: 'ADMIN' }] };
      if (sql.includes('resolve_tenant_membership_roles') && sql.includes('membership_id <> $1')) return { rowCount: 1, rows: [{ role_code: 'ADMIN' }] };
      return { rows: [] };
    });
    const repository = new StaffMembershipAdministrationRepository(pool as never);
    await repository.setMembershipStatus(authority(), 'u9', 'DISABLED', 'u1', 'reason', 'corr');
    expect(queries.join('\n')).toContain('resolve_tenant_membership_roles');
    expect(queries.join('\n')).not.toMatch(/FROM\s+tenant_membership_roles|JOIN\s+tenant_membership_roles/);
    expect(client.release).toHaveBeenCalled();
  });
});
