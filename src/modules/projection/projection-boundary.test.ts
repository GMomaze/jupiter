import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.resolve(relativePath), 'utf8');

describe('MT-4C6B3 mounted projection boundary', () => {
  it('places both mounted endpoints behind the route-local tenant gate and authentic authority', () => {
    const routes = read('src/modules/projection/projection.routes.ts');
    const controller = read('src/modules/projection/projection.controller.ts');
    const app = read('src/app.ts');

    expect(routes).toMatch(/router\.get\('\/fleet-health', requireValidActiveTenantContext/);
    expect(routes).toMatch(/router\.get\('\/summary', requireValidActiveTenantContext/);
    expect(controller.match(/assertTenantQueryAuthority\(req\.tenantAuthority\)/g)).toHaveLength(2);
    expect(app).toContain('createProjectionRouter(requireValidActiveTenantContext)');
  });

  it('uses canonical custody tables/states and database tenant predicates without stale projection sources', () => {
    const liveRepository = read('src/modules/projection/projection.repository.live.ts');
    const projectionFiles = [
      liveRepository,
      read('src/modules/projection/projection.controller.ts'),
      read('src/views/projection/fleet_health.ejs'),
    ].join('\n');

    expect(liveRepository).toContain('FROM aircraft_components component');
    expect(liveRepository).toContain('aircraft.tenant_id = :tenantId');
    expect(liveRepository.match(/component\.custodian_tenant_id = :tenantId/g)).toHaveLength(2);
    expect(liveRepository).toContain("component.current_status = 'INSTALLED'");
    expect(liveRepository).toContain("component.current_status = 'REMOVED'");
    expect(liveRepository).toContain("THEN 'UNKNOWN'");
    expect(projectionFiles).not.toMatch(/vw_component_status|\bcomponents c\b|SERVICEABLE/);
  });
});
