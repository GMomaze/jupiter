import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import {
  SerializedComponentReconciliationRepository,
  type SerializedComponentReconciliationData,
} from './serialized-component-reconciliation.repository.js';
import { SerializedComponentReconciliationService } from './serialized-component-reconciliation.service.js';

const source = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: '11111111-1111-4111-8111-111111111111', publicId: 'TENANT-A', code: 'A', displayName: 'A', status: 'ACTIVE' },
  membership: { id: '22222222-2222-4222-8222-222222222222', tenantId: '11111111-1111-4111-8111-111111111111', userId: '33333333-3333-4333-8333-333333333333', status: 'ACTIVE' },
  validatedAt: Date.now(),
});

function data(): SerializedComponentReconciliationData {
  return {
    legacyRows: [{
      legacy_component_id: 'legacy-a', aircraft_id: 'aircraft-a', aircraft_registration: 'ZS-AAA',
      legacy_model_id: 'model-a', legacy_serial_number: 'SERIAL-A', legacy_position: 'ENGINE',
      legacy_status: 'INSTALLED', legacy_removed_at: null, legacy_model_code: 'M-A',
      legacy_model_name: 'Model A', legacy_asset_type_id: 'asset-a', legacy_asset_type_code: 'ENGINE',
    }],
    serializedInstallationRows: [{
      serialized_installation_id: 'install-a', aircraft_id: 'aircraft-a', aircraft_registration: 'ZS-AAA',
      serialized_position: 'ENGINE', serialized_removed_at: null, serialized_component_id: 'serialized-a',
      serialized_model_id: 'model-a', serialized_serial_number: 'SERIAL-A', serialized_status: 'INSTALLED',
      serialized_model_code: 'M-A', serialized_model_name: 'Model A', serialized_asset_type_id: 'asset-a',
      serialized_asset_type_code: 'ENGINE', life_state_id: 'life-a',
    }],
    totalSerializedComponents: 2,
  };
}

describe('MT-4C7D reconciliation tenant boundary', () => {
  it('keeps authentication, permission, tenant gate, then controller order', () => {
    const app = source('src/app.ts');
    const routes = source('src/modules/library/library.routes.ts');
    expect(app).toContain("app.use('/library', ensureAuthenticated, requireMountedHumanPlatformGate(platformAuthorityRepository, 'LIBRARY'), libraryRoutes)");
    expect(app).toContain('createLibraryRouter(requireValidActiveTenantContext)');
    const start = routes.indexOf("'/serialized-components/reconciliation'");
    const block = routes.slice(start, routes.indexOf(');', start));
    expect(block.indexOf("requirePermission('LIBRARY_EDIT')")).toBeLessThan(block.indexOf('requireReconciliationTenant'));
    expect(block.indexOf('requireReconciliationTenant')).toBeLessThan(block.indexOf('LibraryController.renderSerializedReconciliationReport'));
  });

  it('requires authentic authority in repository and service', async () => {
    const loadForTenant = vi.fn().mockResolvedValue(data());
    const repository = new SerializedComponentReconciliationRepository({ loadForTenant });
    const service = new SerializedComponentReconciliationService(repository);
    expect(() => repository.load({ tenantId: authority.tenantId } as any)).toThrow('TENANT_AUTHORITY_REQUIRED');
    await expect(service.getReport({ tenantId: authority.tenantId } as any)).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    await service.getReport(authority);
    expect(loadForTenant).toHaveBeenCalledWith(authority.tenantId);
  });

  it('preserves matching and derives every count from authorized data', async () => {
    const repository = new SerializedComponentReconciliationRepository({ loadForTenant: vi.fn().mockResolvedValue(data()) });
    const report = await new SerializedComponentReconciliationService(repository).getReport(authority);
    expect(report.summary).toEqual({ total_legacy_rows: 1, active_legacy_rows: 1, total_serialized_components: 2,
      active_serialized_installations: 1, matched_count: 1, migration_ready_count: 1, readiness_percentage: 50 });
    expect(report.bucket_counts.MATCHED).toBe(1);
    expect(report.bucket_counts.SERIALIZED_ONLY).toBe(1);
  });

  it('keeps inactive legacy rows out of details but in the authorized total', async () => {
    const input = data();
    input.legacyRows.push({ ...input.legacyRows[0]!, legacy_component_id: 'removed', legacy_status: 'REMOVED' });
    const repository = new SerializedComponentReconciliationRepository({ loadForTenant: vi.fn().mockResolvedValue(input) });
    const report = await new SerializedComponentReconciliationService(repository).getReport(authority);
    expect(report.summary.total_legacy_rows).toBe(2);
    expect(report.summary.active_legacy_rows).toBe(1);
    expect(report.details.some(row => row.legacy_component_id === 'removed')).toBe(false);
  });

  it('keeps mounted report data access out of controller and route', () => {
    const controller = source('src/modules/library/library.controller.ts');
    const routes = source('src/modules/library/library.routes.ts');
    expect(controller).toContain('serializedComponentReconciliationService.getReport(req.tenantAuthority)');
    expect(controller).not.toMatch(/renderSerializedReconciliationReport[\s\S]{0,400}sequelize\.query/);
    expect(routes).not.toMatch(/serialized-components\/reconciliation[\s\S]{0,250}req\.(query|body|params).*tenant/i);
  });

  it('scopes operational roots in SQL while leaving shared masters decorative', () => {
    const live = source('src/modules/library/serialized-component-reconciliation.repository.live.ts');
    expect(live).toContain('ac.custodian_tenant_id = :tenantId');
    expect(live).toContain('aircraft.tenant_id = :tenantId');
    expect(live).toContain('sc.custodian_tenant_id = :tenantId');
    expect(live).toContain('aci.removed_at IS NULL');
    expect(live).toContain('NOT EXISTS');
    expect(live).toContain('WHERE custodian_tenant_id = :tenantId');
    expect(live).not.toContain('cm.tenant_id');
    expect(live).not.toContain('at.tenant_id');
  });
});
