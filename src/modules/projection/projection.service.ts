import type { TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import type {
  FleetProjectionRepository,
  ProjectionAircraftRow,
  ProjectionComponentRow,
  ProjectionStatus,
} from './projection.repository.js';

export interface FleetProjectionAircraft extends ProjectionAircraftRow {
  total_hours: number;
  components: ProjectionComponentRow[];
}

const PROJECTION_STATUSES: readonly ProjectionStatus[] = [
  'NORMAL',
  'CRITICAL',
  'EXPIRED',
  'UNKNOWN',
];

export class FleetProjectionService {
  constructor(private readonly repository: FleetProjectionRepository) {}

  async loadFleetHealth(authority: TenantQueryAuthority): Promise<{
    aircraft: FleetProjectionAircraft[];
    uninstalled: ProjectionComponentRow[];
  }> {
    const [aircraftRows, components] = await Promise.all([
      this.repository.listAircraft(authority),
      this.repository.listComponents(authority),
    ]);
    const installedByAircraft = new Map<string, ProjectionComponentRow[]>();
    for (const component of components) {
      if (component.current_status !== 'INSTALLED') continue;
      const rows = installedByAircraft.get(component.aircraft_id) ?? [];
      rows.push(component);
      installedByAircraft.set(component.aircraft_id, rows);
    }

    return {
      aircraft: aircraftRows.map((aircraft) => ({
        ...aircraft,
        total_hours: aircraft.total_time_hours,
        components: installedByAircraft.get(aircraft.id) ?? [],
      })),
      uninstalled: components.filter((component) => component.current_status === 'REMOVED'),
    };
  }

  async loadSummary(authority: TenantQueryAuthority) {
    const components = await this.repository.listComponents(authority);
    return PROJECTION_STATUSES.map((maintenance_status) => ({
      maintenance_status,
      count: components.filter((component) => component.maintenance_status === maintenance_status).length,
    }));
  }
}
