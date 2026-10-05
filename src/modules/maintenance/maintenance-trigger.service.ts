import type { TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';

export class MaintenanceTriggerService {
  static async evaluateComponentTBO(
    aircraft_id: string,
    aircraftHours: number,
    installedComponents: unknown[],
    transaction: unknown,
    tenantAuthority: TenantQueryAuthority,
  ): Promise<never> {
    void aircraft_id; void aircraftHours; void installedComponents; void transaction; void tenantAuthority;
    throw new Error('DORMANT_MAINTENANCE_SHARED_WRITER_DISABLED');
  }
}
