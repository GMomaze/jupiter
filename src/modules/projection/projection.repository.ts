import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';

export type ProjectionStatus = 'NORMAL' | 'CRITICAL' | 'EXPIRED' | 'UNKNOWN';

export interface ProjectionAircraftRow {
  id: string;
  registration: string;
  serial_number: string;
  total_time_hours: number;
}

export interface ProjectionComponentRow {
  id: string;
  aircraft_id: string;
  model_name: string;
  category_name: string;
  serial_number: string;
  install_hours_airframe: number;
  current_actual_tso: number;
  tbo_hours: number | null;
  hours_remaining: number | null;
  maintenance_status: ProjectionStatus;
  current_status: 'INSTALLED' | 'REMOVED';
  tso_at_install: number;
}

export interface FleetProjectionRepositoryPorts {
  listAircraft(tenantId: string): Promise<ProjectionAircraftRow[]>;
  listComponents(tenantId: string): Promise<ProjectionComponentRow[]>;
}

export class FleetProjectionRepository {
  constructor(private readonly ports: FleetProjectionRepositoryPorts) {}

  async listAircraft(authority: TenantQueryAuthority) {
    assertTenantQueryAuthority(authority);
    return this.ports.listAircraft(authority.tenantId);
  }

  async listComponents(authority: TenantQueryAuthority) {
    assertTenantQueryAuthority(authority);
    return this.ports.listComponents(authority.tenantId);
  }
}
