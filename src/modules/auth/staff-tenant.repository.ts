import type { Pool, PoolClient } from 'pg';
import { assertTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { randomUUID } from 'node:crypto';
import { TENANT_LIFECYCLE_LOCK_NAMESPACE } from '../tenancy/tenant-lifecycle-coordination.js';

export const STAFF_TENANT_TARGET_UNAVAILABLE = 'STAFF_TENANT_TARGET_UNAVAILABLE';
export interface TenantStaffRow { readonly id: string; readonly email: string; readonly full_name: string; readonly is_active: boolean; readonly roles: readonly string[]; }
export interface SharedRoleRow { readonly id: string; readonly code: string; readonly label: string; }
export interface StaffTenantRepository {
  listStaff(authority: TenantQueryAuthority): Promise<readonly TenantStaffRow[]>;
  listAssignableRoles(authority: TenantQueryAuthority): Promise<readonly SharedRoleRow[]>;
  toggleRole(authority: TenantQueryAuthority, targetUserId: string, roleId: string, actorUserId: string, reason?: string, correlationId?: string): Promise<'ASSIGNED' | 'REVOKED'>;
}

export class PostgresStaffTenantRepository implements StaffTenantRepository {
  constructor(private readonly database: Pool, private readonly transactionClient?: PoolClient) {}
  private get queryable() { return this.transactionClient ?? this.database; }
  async listStaff(authority: TenantQueryAuthority): Promise<readonly TenantStaffRow[]> {
    assertTenantQueryAuthority(authority);
    const result = await this.queryable.query(
      `SELECT u.id, u.email, u.full_name, u.is_active,
              COALESCE(array_agg(r.code ORDER BY r.code)
                FILTER (WHERE r.id IS NOT NULL AND tmr.revoked_at IS NULL), ARRAY[]::varchar[]) AS roles
         FROM tenant_memberships tm JOIN users u ON u.id = tm.user_id
         LEFT JOIN tenant_membership_roles tmr ON tmr.membership_id = tm.id
         LEFT JOIN rf_role r ON r.id = tmr.role_id AND r.is_active = true
        WHERE tm.tenant_id = $1 AND tm.status = 'ACTIVE'
        GROUP BY tm.id, u.id, u.email, u.full_name, u.is_active
        ORDER BY u.full_name ASC, u.id ASC`, [authority.tenantId]);
    return result.rows;
  }
  async listAssignableRoles(authority: TenantQueryAuthority): Promise<readonly SharedRoleRow[]> {
    assertTenantQueryAuthority(authority);
    const result = await this.queryable.query(
      `SELECT id, code, label FROM rf_role WHERE is_active = true ORDER BY label ASC, id ASC`);
    return result.rows;
  }
  async toggleRole(authority: TenantQueryAuthority, targetUserId: string, roleId: string, actorUserId: string, reason = 'Tenant staff role administration', correlationId = randomUUID()): Promise<'ASSIGNED' | 'REVOKED'> {
    assertTenantQueryAuthority(authority);
    const client = this.transactionClient ?? await this.database.connect();
    const ownsTransaction = !this.transactionClient;
    try {
      if (ownsTransaction) await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint))`, [authority.tenantId]);
      const membership = await this.lockTargetMembership(client, authority.tenantId, targetUserId);
      const role = await client.query(`SELECT id,code FROM rf_role WHERE id = $1 AND is_active = true FOR SHARE`, [roleId]);
      if (role.rowCount !== 1) throw new Error(STAFF_TENANT_TARGET_UNAVAILABLE);
      const current = await client.query(
        `SELECT id FROM tenant_membership_roles WHERE membership_id = $1 AND role_id = $2 AND revoked_at IS NULL FOR UPDATE`,
        [membership.id, roleId]);
      let outcome: 'ASSIGNED' | 'REVOKED';
      if (current.rowCount === 1) {
        if (role.rows[0].code === 'ADMIN') {
          const otherAdmin = await client.query(
            `SELECT 1 FROM tenant_memberships tm
               JOIN tenant_membership_roles tmr ON tmr.membership_id = tm.id AND tmr.revoked_at IS NULL
               JOIN rf_role r ON r.id = tmr.role_id AND r.code = 'ADMIN' AND r.is_active = true
             WHERE tm.tenant_id = $1 AND tm.status = 'ACTIVE' AND tm.id <> $2 LIMIT 1`,
            [authority.tenantId, membership.id]);
          if (otherAdmin.rowCount === 0) throw new Error('LAST_ACTIVE_TENANT_ADMIN_REQUIRED');
        }
        await client.query(
          `UPDATE tenant_membership_roles SET revoked_at = CURRENT_TIMESTAMP, revoked_by_user_id = $2,
             revocation_reason = 'Removed through tenant staff administration', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND revoked_at IS NULL`, [current.rows[0].id, actorUserId]);
        outcome = 'REVOKED';
      } else {
        await client.query(
          `INSERT INTO tenant_membership_roles (membership_id, role_id, assigned_by_user_id) VALUES ($1, $2, $3)`,
          [membership.id, roleId, actorUserId]);
        outcome = 'ASSIGNED';
      }
      await client.query(`INSERT INTO tenant_membership_authority_audit
        (id,tenant_id,membership_id,actor_user_id,actor_kind,action,reason,correlation_id,old_values,new_values)
        VALUES($1,$2,$3,$4,'TENANT_ADMIN',$5,$6,$7,$8::jsonb,$9::jsonb)`, [
        randomUUID(),authority.tenantId,membership.id,actorUserId,
        outcome === 'ASSIGNED' ? 'TENANT_ROLE_GRANTED' : 'TENANT_ROLE_REVOKED',reason,correlationId,
        JSON.stringify(outcome === 'REVOKED' ? { role: role.rows[0].code } : null),
        JSON.stringify(outcome === 'ASSIGNED' ? { role: role.rows[0].code } : null),
      ]);
      if (ownsTransaction) await client.query('COMMIT');
      return outcome;
    } catch (error) {
      if (ownsTransaction) await client.query('ROLLBACK');
      throw error;
    } finally { if (ownsTransaction) client.release(); }
  }
  private async lockTargetMembership(client: PoolClient, tenantId: string, userId: string): Promise<{ id: string }> {
    const result = await client.query(
      `SELECT id FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2 AND status = 'ACTIVE' FOR UPDATE`,
      [tenantId, userId]);
    if (result.rowCount !== 1) throw new Error(STAFF_TENANT_TARGET_UNAVAILABLE);
    return result.rows[0];
  }
}
