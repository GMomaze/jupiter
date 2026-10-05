import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('Level 1 operational authority activation', () => {
  it('injects the approved gate into all five mounted router groups', () => {
    const app = source('src/app.ts');
    for (const factory of [
      'createAircraftRouter',
      'createCustomersRouter',
      'createWorkpackRouter',
      'createInventoryRouter',
      'createLibraryRouter',
    ]) {
      expect(app).toContain(`${factory}(requireValidActiveTenantContext)`);
    }
  });

  it('does not introduce a global active-tenant gate', () => {
    expect(source('src/app.ts')).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
  });

  it('gates the Aircraft tenant workflow and leaves its shared selector excluded', () => {
    const routes = source('src/modules/aircraft/aircraft.routes.ts');
    expect(routes).toContain("router.get('/', requireAircraftTenant, AircraftController.index)");
    expect(routes).toContain("router.get('/create', requireAircraftTenant, AircraftController.showCreate)");
    expect(routes).toContain("router.get('/view/:id', requireAircraftTenant, AircraftController.showView)");
    expect(routes).toMatch(/'\/manufacturer\/:manufacturerId\/models',[\s\S]*?AircraftController\.getModelsByManufacturer/);
    const selector = routes.slice(routes.indexOf("'/manufacturer/:manufacturerId/models'"), routes.indexOf('// UUID routes'));
    expect(selector).not.toContain('requireAircraftTenant');
  });

  it('places Aircraft tenant authority before disk upload', () => {
    const routes = source('src/modules/aircraft/aircraft.routes.ts');
    for (const marker of ["router.post('/',", "router.post('/:id',", "router.patch('/:id',"]) {
      const line = routes.slice(routes.indexOf(marker), routes.indexOf('\n', routes.indexOf(marker)));
      expect(line.indexOf('requireAircraftTenant')).toBeLessThan(line.indexOf('aircraftPhotoUpload'));
    }
  });

  it('gates the complete Customer and Inventory routers', () => {
    expect(source('src/modules/customers/customers.routes.ts')).toContain('router.use(requireCustomerTenant)');
    expect(source('src/modules/inventory/inventory.routes.ts')).toContain('router.use(requireInventoryTenant)');
  });

  it('gates Workpack handlers after RBAC while excluding shared template import', () => {
    const routes = source('src/modules/workpacks/workpack.routes.ts');
    expect(routes).toContain("property === 'handleImportTemplates'");
    expect(routes).toContain('requireWorkpackTenant(req, res');
    expect(routes).toContain("requireRole('PLANNER'),\n  upload.single('task_csv'),\n  csrfProtection,\n  WorkpackController.handleImportTemplates");
  });

  it('gates exactly the nine tenant-owned Library component routes', () => {
    const routes = source('src/modules/library/library.routes.ts');
    expect(routes.match(/requireOperationalTenant,/g)).toHaveLength(9);
    for (const marker of [
      "'/serialized-components'",
      "'/serialized-components/create'",
      "'/serialized-components/:id/edit'",
      "'/serialized-components/:id/life'",
      "'/serialized-components/:id/update'",
      "'/serialized-components/:id/life-adjustment'",
      "'/serialized-components/:id/overhaul'",
      "'/serialized-components/:id/maintenance-events'",
    ]) {
      const start = routes.indexOf(marker);
      const block = routes.slice(start, routes.indexOf(');', start));
      expect(block).toContain('requireOperationalTenant');
    }
  });

  it('preserves independently gated Library routes and shared selectors', () => {
    const routes = source('src/modules/library/library.routes.ts');
    expect(routes.match(/requireReconciliationTenant,/g)).toHaveLength(1);
    expect(routes.match(/requireMigrationTenant,/g)).toHaveLength(3);
    for (const marker of [
      "'/serialized-components/create/asset-types/:assetTypeId/manufacturer-options'",
      "'/serialized-components/create/asset-types/:assetTypeId/manufacturers/:manufacturerId/model-options'",
    ]) {
      const start = routes.indexOf(marker);
      const block = routes.slice(start, routes.indexOf(');', start));
      expect(block).not.toContain('requireOperationalTenant');
    }
  });
});
