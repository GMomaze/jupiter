import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');

describe('4C3A5 staff Customer tenant conversion', () => {
  const service = read('src/modules/customers/customers.service.ts');
  const controller = read('src/modules/customers/customers.controller.ts');
  const aircraftController = read('src/modules/aircraft/aircraft.controller.ts');

  it('requires nominal authority first for all six staff service operations', () => {
    for (const method of [
      'listCustomers',
      'getCustomerOrThrow',
      'getActiveCustomers',
      'createCustomer',
      'updateCustomer',
      'assignAircraftToCustomer',
    ]) {
      expect(service).toMatch(new RegExp(`static async ${method}\\(\\s*authority: TenantQueryAuthority`));
    }
    expect(service).not.toMatch(/CustomerCreationTenantAuthority|authority\?:|tenantIdOrAuthority/);
  });

  it('uses req.tenantAuthority without structural or RBAC fallbacks', () => {
    expect(controller).toContain('req.tenantAuthority');
    expect(controller).not.toMatch(/req\.tenantContext|\{\s*tenantId:|\bADMIN\b|role|permission/);
    expect(aircraftController).toMatch(
      /assignCustomer[\s\S]*requireTenantAuthority\(req\)[\s\S]*assignAircraftToCustomer\(authority/,
    );
  });

  it('removes direct Customer model access from converted staff service paths', () => {
    expect(service).not.toMatch(/\bCustomer\.(?:findByPk|findOne|findAll|count|create|update|destroy)/);
    expect(service).toContain('customerTenantRepository.list(authority, {}, { transaction })');
    expect(service).toContain('customerTenantRepository.listActive(authority, { transaction })');
    expect(service).toContain('customerTenantRepository.create(authority');
    expect(service).toContain('customerTenantRepository.getForRootUpdate(authority');
    expect(service).toContain('customerTenantRepository.updateById(authority');
  });

  it('keeps staff and portal Customer authority boundaries separate', () => {
    const portal = read('src/modules/customer-portal/customer-portal.routes.ts');
    const dashboard = read('src/routes/index.ts');
    expect(portal).not.toMatch(/Customer\.findByPk|sequelize\.query/);
    expect(portal).toContain('resolveCustomerPortalAuthority');
    expect(portal).not.toContain('TenantQueryAuthority');
    expect(dashboard).not.toMatch(/Customer\.count/);
    expect(dashboard).toContain('dashboardMetricsService.load(req.tenantAuthority)');
    expect(aircraftController.match(/model:\s*Customer,/g)).toHaveLength(2);
  });

  it('uses the fixed projection and preserves transaction-coupled update and link audits', () => {
    expect(service).toContain('getCustomerWithLinks(authority, id)');
    expect(service).toMatch(
      /getForRootUpdate\(authority, id,[\s\S]*transaction[\s\S]*LOCK\.UPDATE[\s\S]*updateById\(authority, id,[\s\S]*AuditService\.log/,
    );
    expect(service).toMatch(
      /customerAircraftLinkTenantService\.createLink\([\s\S]*authority[\s\S]*serviceOptions/,
    );
  });

  it('adds no gate, migration, portal authority, global tenant state, or ADMIN bypass', () => {
    const app = read('src/app.ts');
    expect(app).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
    expect(fs.readdirSync(path.resolve(process.cwd(), 'migrations')).some((name) => name.startsWith('606_')))
      .toBe(true);
    expect(service + controller).not.toMatch(/AsyncLocalStorage|globalThis|currentTenant|activeTenantSingleton|\bADMIN\b/);
  });
});
