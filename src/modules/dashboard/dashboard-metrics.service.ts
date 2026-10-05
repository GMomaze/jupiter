import type { TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import type { DashboardTenantRepository } from './dashboard-tenant.repository.js';

export interface DashboardStatusPort {
  findIdByCode(code: string): Promise<string | undefined>;
}

export interface DashboardMetrics {
  totalAircraft: number | null;
  activeAircraft: number | null;
  openWorkpacks: number | null;
  awaitingCertification: number | null;
  openSnags: number | null;
  serializedComponents: number | null;
  activeCustomers: number | null;
}

export const DASHBOARD_METRICS_WARNING =
  'Some operational counts are temporarily unavailable. Navigation remains fully available.';
export const DASHBOARD_LOAD_WARNING =
  'Operational counts could not be loaded right now. Navigation remains fully available.';

export class DashboardMetricsService {
  constructor(
    private readonly repository: DashboardTenantRepository,
    private readonly statuses: DashboardStatusPort,
  ) {}

  async load(authority: TenantQueryAuthority): Promise<{
    metrics: DashboardMetrics;
    metricsWarning: string | null;
  }> {
    const metrics: DashboardMetrics = {
      totalAircraft: null,
      activeAircraft: null,
      openWorkpacks: null,
      awaitingCertification: null,
      openSnags: null,
      serializedComponents: null,
      activeCustomers: null,
    };

    try {
      const [closedStatus, inProgressStatus] = await Promise.all([
        this.statuses.findIdByCode('CLOSED'),
        this.statuses.findIdByCode('IN_PROGRESS'),
      ]);
      const countTasks = {
        totalAircraft: this.repository.countAircraft(authority),
        activeAircraft: this.repository.countAircraft(authority, 'ACTIVE'),
        openWorkpacks: closedStatus
          ? this.repository.countWorkpacks(authority, closedStatus, 'NOT_EQUALS')
          : Promise.resolve(null),
        awaitingCertification: inProgressStatus
          ? this.repository.countWorkpacks(authority, inProgressStatus, 'EQUALS')
          : Promise.resolve(null),
        openSnags: this.repository.countOpenSnags(authority),
        serializedComponents: this.repository.countSerializedComponents(authority),
        activeCustomers: this.repository.countCustomers(authority, 'ACTIVE'),
      };
      const entries = Object.entries(countTasks) as Array<
        [keyof DashboardMetrics, Promise<number | null>]
      >;
      const settled = await Promise.allSettled(entries.map(([, promise]) => promise));
      settled.forEach((result, index) => {
        const entry = entries[index];
        if (entry && result.status === 'fulfilled') metrics[entry[0]] = result.value;
      });
      return {
        metrics,
        metricsWarning: settled.some((result) => result.status === 'rejected')
          ? DASHBOARD_METRICS_WARNING
          : null,
      };
    } catch {
      return { metrics, metricsWarning: DASHBOARD_LOAD_WARNING };
    }
  }
}
