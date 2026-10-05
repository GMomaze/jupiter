import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';

export interface DashboardCountModelPort {
  count(options: Readonly<Record<string, unknown>>): Promise<number>;
}

export interface DashboardSnagCountPort {
  countOpenForTenant(tenantId: string): Promise<number>;
}

export interface DashboardTenantRepositoryPorts {
  aircraft: DashboardCountModelPort;
  customer: DashboardCountModelPort;
  serializedComponent: DashboardCountModelPort;
  workpack: DashboardCountModelPort;
  snag: DashboardSnagCountPort;
}

function stableFailure(error: unknown): never {
  if (error instanceof Error && error.message === 'TENANT_AUTHORITY_REQUIRED') throw error;
  throw new Error('TENANT_QUERY_FAILED');
}

export class DashboardTenantRepository {
  constructor(private readonly ports: DashboardTenantRepositoryPorts) {}

  async countAircraft(authority: TenantQueryAuthority, status?: string): Promise<number> {
    assertTenantQueryAuthority(authority);
    try {
      return await this.ports.aircraft.count({
        where: {
          tenant_id: authority.tenantId,
          ...(status ? { status } : {}),
        },
      });
    } catch (error) {
      return stableFailure(error);
    }
  }

  async countWorkpacks(
    authority: TenantQueryAuthority,
    statusId: string,
    comparison: 'EQUALS' | 'NOT_EQUALS',
  ): Promise<number> {
    assertTenantQueryAuthority(authority);
    try {
      return await this.ports.workpack.count({
        where: {
          tenant_id: authority.tenantId,
          status_id: comparison === 'EQUALS' ? statusId : { $ne: statusId },
        },
      });
    } catch (error) {
      return stableFailure(error);
    }
  }

  async countOpenSnags(authority: TenantQueryAuthority): Promise<number> {
    assertTenantQueryAuthority(authority);
    try {
      return await this.ports.snag.countOpenForTenant(authority.tenantId);
    } catch (error) {
      return stableFailure(error);
    }
  }

  async countSerializedComponents(authority: TenantQueryAuthority): Promise<number> {
    assertTenantQueryAuthority(authority);
    try {
      return await this.ports.serializedComponent.count({
        where: { custodian_tenant_id: authority.tenantId },
      });
    } catch (error) {
      return stableFailure(error);
    }
  }

  async countCustomers(authority: TenantQueryAuthority, status?: string): Promise<number> {
    assertTenantQueryAuthority(authority);
    try {
      return await this.ports.customer.count({
        where: {
          tenant_id: authority.tenantId,
          ...(status ? { status } : {}),
        },
      });
    } catch (error) {
      return stableFailure(error);
    }
  }
}
