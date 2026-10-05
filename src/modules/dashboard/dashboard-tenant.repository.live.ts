import { Op, QueryTypes } from 'sequelize';
import { Aircraft, Customer, SerializedComponent, Workpack, sequelize } from '../../models/index.js';
import { DashboardTenantRepository } from './dashboard-tenant.repository.js';

export const dashboardTenantRepository = new DashboardTenantRepository({
  aircraft: { count: (options) => Aircraft.count(options) },
  customer: { count: (options) => Customer.count(options) },
  serializedComponent: { count: (options) => SerializedComponent.count(options) },
  workpack: {
    count: (options) => {
      const where = { ...(options.where as Record<string, unknown>) };
      if (where.status_id && typeof where.status_id === 'object' && '$ne' in where.status_id) {
        where.status_id = { [Op.ne]: (where.status_id as { $ne: unknown }).$ne };
      }
      return Workpack.count({ ...options, where });
    },
  },
  snag: {
    async countOpenForTenant(tenantId) {
      const rows = await sequelize.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM workpack_snags snag
          WHERE snag.status <> 'CLOSED'
            AND (
              (snag.workpack_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM workpacks owned_workpack
                 WHERE owned_workpack.id = snag.workpack_id
                   AND owned_workpack.tenant_id = :tenantId
              ))
              OR
              (snag.workpack_id IS NULL AND EXISTS (
                SELECT 1 FROM aircraft owned_aircraft
                 WHERE owned_aircraft.id = snag.aircraft_id
                   AND owned_aircraft.tenant_id = :tenantId
              ))
            )`,
        { replacements: { tenantId }, type: QueryTypes.SELECT },
      );
      return Number(rows[0]?.count ?? 0);
    },
  },
});
