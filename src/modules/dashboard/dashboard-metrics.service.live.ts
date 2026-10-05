import { WorkpackStatus } from '../../models/index.js';
import { DashboardMetricsService } from './dashboard-metrics.service.js';
import { dashboardTenantRepository } from './dashboard-tenant.repository.live.js';

export const dashboardMetricsService = new DashboardMetricsService(
  dashboardTenantRepository,
  {
    async findIdByCode(code) {
      const status = await WorkpackStatus.findOne({ where: { code }, attributes: ['id'] });
      return status?.id;
    },
  },
);
