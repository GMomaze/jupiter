import { AuditLog, User } from '../../models/index.js';
import {
  TENANT_AUDIT_SOURCES,
  type AuditTenantRepository,
  type TenantAuditFilters,
  type TenantAuditSource,
} from './audit-tenant.repository.js';
import { auditTenantRepository } from './audit-tenant.repository.live.js';
import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';

export class AuditService {

  static async log(data: {
    table_name: string;
    row_id: string;
    action: string;
    actor_id?: string | null;
    old_values?: any;
    new_values?: any;
    reason?: string | null;
  }, transaction?: any) {

    if (!data.row_id) {
      throw new Error('AUDIT_ERROR: row_id required');
    }

    let actorId: string | null = null;

    // ✅ FIX: verify user actually exists
    if (
      data.actor_id &&
      /^[0-9a-fA-F-]{36}$/.test(data.actor_id)
    ) {
      const user = await User.findByPk(data.actor_id, { transaction });
      if (user) {
        actorId = data.actor_id;
      }
    }

    return AuditLog.create(
      {
        table_name: data.table_name,
        row_id: data.row_id,
        action: data.action,
        actor_id: actorId, // ✅ NULL if invalid → no FK error
        old_values: data.old_values ?? null,
        new_values: data.new_values ?? null,
        reason: data.reason ?? null
      },
      { transaction }
    );
  }

  static async getLogs(
    authority: TenantQueryAuthority,
    filters: { table_name?: unknown } = {},
    repository: AuditTenantRepository = auditTenantRepository,
  ) {
    assertTenantQueryAuthority(authority);
    const requestedTable = typeof filters.table_name === 'string'
      ? filters.table_name.trim().toLowerCase()
      : '';
    if (
      requestedTable &&
      !TENANT_AUDIT_SOURCES.includes(requestedTable as TenantAuditSource)
    ) {
      return [];
    }
    const tenantFilters: TenantAuditFilters = requestedTable
      ? { tableName: requestedTable as TenantAuditSource }
      : {};
    return repository.listAuthorized(authority, tenantFilters);
  }
}

