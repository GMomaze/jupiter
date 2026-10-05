import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';

const source = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: '11111111-1111-4111-8111-111111111111', publicId: 'A', code: 'A', displayName: 'A', status: 'ACTIVE' },
  membership: { id: '22222222-2222-4222-8222-222222222222', tenantId: '11111111-1111-4111-8111-111111111111', userId: '33333333-3333-4333-8333-333333333333', status: 'ACTIVE' },
  validatedAt: Date.now(),
});

describe('MT-4C8A tenant-authorized migration tooling', () => {
  it('orders permission, route-local tenant gate, CSRF where applicable, and controller', () => {
    const routes = source('src/modules/library/library.routes.ts');
    for (const marker of [
      "'/serialized-components/migration-dry-run'",
      "'/serialized-components/migration-dry-run/save'",
      "'/serialized-components/migration-dry-run/batches/:batchId'",
    ]) {
      const start = routes.indexOf(marker);
      const block = routes.slice(start, routes.indexOf(');', start));
      expect(block.indexOf("requirePermission('LIBRARY_EDIT')")).toBeLessThan(block.indexOf('requireMigrationTenant'));
      expect(block.indexOf('requireMigrationTenant')).toBeLessThan(block.indexOf('LibraryController.'));
      if (marker.includes('/save')) {
        expect(block.indexOf('requireMigrationTenant')).toBeLessThan(block.indexOf('csrfProtection'));
      }
    }
    expect(source('src/app.ts')).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
  });

  it('requires authentic authority at controller and both services', () => {
    const controller = source('src/modules/library/library.controller.ts');
    const dryRun = source('src/modules/migration/migration-dry-run.service.ts');
    const ledger = source('src/modules/migration/migration-ledger.service.ts');
    expect(controller.match(/assertTenantQueryAuthority\(req\.tenantAuthority\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(dryRun).toContain('assertTenantQueryAuthority(authority)');
    expect(ledger).toContain('assertTenantQueryAuthority(authority)');
    expect(Object.isFrozen(authority)).toBe(true);
  });

  it('scopes legacy and serialized roots before calculation', () => {
    const service = source('src/modules/migration/migration-dry-run.service.ts');
    expect(service).toContain('ac.custodian_tenant_id = :tenantId');
    expect(service).toContain('aircraft.tenant_id = :tenantId');
    expect(service).toContain('sc.custodian_tenant_id = :tenantId');
    expect(service).toContain('installation_aircraft.tenant_id = :tenantId');
    expect(service).toContain('aci.removed_at IS NULL');
    expect(service).toContain('foreign_aircraft.tenant_id <> :tenantId');
  });

  it('uses C7D authority-first reconciliation and not the global loader', () => {
    const service = source('src/modules/migration/migration-dry-run.service.ts');
    expect(service).toContain('serializedComponentReconciliationService.getReport(authority)');
    expect(service).not.toContain('getSerializedComponentReconciliationReport()');
    expect(service).not.toContain('loadGlobalReconciliationDataForMigration');
  });

  it('treats aircraft id only as an intersecting filter', () => {
    const service = source('src/modules/migration/migration-dry-run.service.ts');
    expect(service).toContain('ac.aircraft_id = :aircraftId');
    expect(service).toContain("'ac.custodian_tenant_id = :tenantId'");
    expect(service).not.toMatch(/tenant(Id|_id).*options|options.*tenant(Id|_id)/i);
  });

  it('regenerates the preview server-side and persists authoritative parent ownership', () => {
    const controller = source('src/modules/library/library.controller.ts');
    const ledger = source('src/modules/migration/migration-ledger.service.ts');
    expect(controller).toContain('previewLegacyAircraftComponentMigration(req.tenantAuthority');
    expect(controller).toContain('saveLegacyAircraftComponentDryRun(req.tenantAuthority');
    expect(ledger).toContain('tenant_id: authority.tenantId');
    expect(ledger).toContain('TENANT_MIGRATION_BATCH_INVALID');
  });

  it('prevents batch IDOR and neutralizes malformed identifiers', () => {
    const ledger = source('src/modules/migration/migration-ledger.service.ts');
    expect(ledger).toContain('where: { id: batchId, tenant_id: authority.tenantId }');
    expect(ledger).toMatch(/test\(batchId\)[\s\S]{0,80}return null/);
  });

  it('defines parent-only immutable ownership with guarded historical backfill', () => {
    const migration = source('migrations/597_add_migration_batch_tenant_ownership.ts');
    expect(migration).toContain('MIGRATION_597_HISTORICAL_BATCH_OWNERSHIP_UNRESOLVED');
    expect(migration).toContain('COUNT(DISTINCT ac.custodian_tenant_id) <> 1');
    expect(migration).toContain('ALTER COLUMN tenant_id SET NOT NULL');
    expect(migration).toContain('ON UPDATE RESTRICT ON DELETE RESTRICT');
    expect(migration).toContain('MIGRATION_BATCH_TENANT_IMMUTABLE');
    expect(migration).toContain('MIGRATION_BATCH_ROW_PARENT_IMMUTABLE');
    expect(source('src/models/MigrationBatchRow.ts')).not.toContain('tenant_id');
  });
});
