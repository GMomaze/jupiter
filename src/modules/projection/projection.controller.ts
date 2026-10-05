import type { Request, Response } from 'express';
import { assertTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import type { FleetProjectionService } from './projection.service.js';

export class ProjectionController {
  constructor(private readonly service: FleetProjectionService) {}

  renderFleetStatus = async (req: Request, res: Response) => {
    try {
      assertTenantQueryAuthority(req.tenantAuthority);
      res.render(
        'projection/fleet_health',
        await this.service.loadFleetHealth(req.tenantAuthority),
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'TENANT_AUTHORITY_REQUIRED') {
        return res.redirect(303, '/organisation/unavailable');
      }
      throw error;
    }
  };

  getSummary = async (req: Request, res: Response) => {
    try {
      assertTenantQueryAuthority(req.tenantAuthority);
      const summary = await this.service.loadSummary(req.tenantAuthority);
      res.render('projection/partials/summary_cards', { summary, layout: false });
    } catch (error) {
      if (error instanceof Error && error.message === 'TENANT_AUTHORITY_REQUIRED') {
        return res.redirect(303, '/organisation/unavailable');
      }
      throw error;
    }
  };
}
