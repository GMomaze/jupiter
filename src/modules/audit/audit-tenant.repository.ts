import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';

export const TENANT_AUDIT_SOURCES = Object.freeze([
  'aircraft',
  'customers',
  'workpacks',
  'task_cards',
  'workpack_snags',
  'aircraft_compliance',
  'utilisation_events',
  'customer_aircraft_links',
] as const);

export type TenantAuditSource = (typeof TENANT_AUDIT_SOURCES)[number];

export interface TenantAuditFilters {
  readonly tableName?: TenantAuditSource;
}

export interface TenantAuditLogProjection {
  readonly id: string;
  readonly table_name: TenantAuditSource;
  readonly row_id: string;
  readonly action: string;
  readonly old_values: unknown;
  readonly new_values: unknown;
  readonly reason: string | null;
  readonly created_at: Date;
  readonly actor_name: string | null;
}

export interface TenantAuditReadPort {
  listAuthorized(
    tenantId: string,
    filters: TenantAuditFilters,
  ): Promise<TenantAuditLogProjection[]>;
}

export class AuditTenantRepository {
  constructor(private readonly port: TenantAuditReadPort) {}

  async listAuthorized(
    authority: TenantQueryAuthority,
    filters: TenantAuditFilters = {},
  ): Promise<TenantAuditLogProjection[]> {
    assertTenantQueryAuthority(authority);
    return this.port.listAuthorized(authority.tenantId, filters);
  }
}
