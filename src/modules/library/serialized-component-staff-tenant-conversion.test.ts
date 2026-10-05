import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';

const repository = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([]),
  getById: vi.fn().mockResolvedValue(undefined),
  getForUpdate: vi.fn().mockResolvedValue(undefined),
  findBySerialIdentity: vi.fn().mockResolvedValue(undefined),
  create: vi.fn().mockResolvedValue({ id: 'component-a' }),
  updateById: vi.fn().mockResolvedValue({ outcome: 'CHANGED' }),
}));

vi.mock('../../models/index.js', () => ({
  AssetType: {}, Manufacturer: {}, ComponentModel: { findAll: vi.fn(), findByPk: vi.fn() },
  MaintenanceRequirement: {}, ServiceBulletin: {}, ServiceBulletinModel: {},
  SupplementalInspectionDocument: {}, SidModelApplicability: {}, TaskTemplate: {},
  SerializedComponentLifeState: {}, SerializedComponentMaintenanceEvent: {},
  ComponentLifeLimit: {}, AircraftComponentInstallation: {}, Aircraft: {},
  ComplianceAssignment: {}, User: {}, AdApplicabilityAllocation: {},
  AdServiceBulletinReference: {},
}));
vi.mock('../../config/database.js', () => ({ default: { transaction: vi.fn() } }));
vi.mock('../../models/AirworthinessDirective.js', () => ({ AirworthinessDirective: {} }));
vi.mock('../../models/ComplianceItem.js', () => ({ ComplianceItem: {} }));
vi.mock('../../models/MaintenanceTemplate.js', () => ({ MaintenanceTemplate: {} }));
vi.mock('../../models/MaintenanceTemplateItem.js', () => ({ MaintenanceTemplateItem: {} }));
vi.mock('../due-status/due-status.service.js', () => ({
  DueStatusService: { defaultThresholds: { hours: 50, cycles: 25, calendarDays: 30 } },
}));
vi.mock('./ad-relevance.service.js', () => ({ AdRelevanceService: {} }));
vi.mock('./ad-applicability-allocation.service.js', () => ({ AdApplicabilityAllocationService: {} }));

vi.mock('./serialized-component-tenant.repository.live.js', () => ({
  serializedComponentTenantRepository: repository,
}));

import { LibraryService } from './library.service.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'public-a', code: 'A', displayName: 'A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
  validatedAt: 1,
});

const source = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('4C3B2 SerializedComponent staff tenant conversion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes exact factory authority to list and direct detail repositories', async () => {
    await expect(LibraryService.getSerializedComponents(authority)).resolves.toEqual([]);
    await expect(LibraryService.getSerializedComponentById(authority, 'component-a')).resolves.toBeUndefined();
    expect(repository.list).toHaveBeenCalledWith(authority);
    expect(repository.getById).toHaveBeenCalledWith(authority, 'component-a');
  });

  it.each([undefined, null, Object.freeze({ tenantId: 'tenant-a' }), { tenantId: 'tenant-a', roles: ['ADMIN'] }])(
    'rejects missing, structural, and ADMIN-shaped authority before repository access', async (invalid) => {
      await expect(LibraryService.getSerializedComponents(invalid as never)).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
      expect(repository.list).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid authority before mutation validation or transaction creation', async () => {
    const invalid = Object.freeze({ tenantId: 'tenant-a' }) as never;
    await expect(LibraryService.adjustSerializedComponentLifeState(invalid, 'component-a', {}))
      .rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    await expect(LibraryService.recordSerializedComponentOverhaul(invalid, 'component-a', {}))
      .rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    await expect(LibraryService.recordSerializedComponentGenericMaintenanceEvent(invalid, 'component-a', {}))
      .rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    expect(repository.getForUpdate).not.toHaveBeenCalled();
  });

  it('uses tenant repository identity and create operations without custody input', async () => {
    const input = { component_model_id: 'model-a', serial_number: ' SN-1 ' };
    await LibraryService.createSerializedComponent(authority, input);
    expect(repository.findBySerialIdentity).toHaveBeenCalledWith(authority, 'model-a', ' SN-1 ');
    expect(repository.create).toHaveBeenCalledWith(authority, expect.objectContaining({
      component_model_id: 'model-a', serial_number: 'SN-1',
    }));
    expect(repository.create.mock.calls[0][1]).not.toHaveProperty('custodian_tenant_id');
    await expect(LibraryService.createSerializedComponent(
      authority, { ...input, custodian_tenant_id: 'tenant-b' } as never,
    )).rejects.toThrow('TENANT_QUERY_FAILED');
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('keeps foreign and nonexistent detail/life roots equally neutral', async () => {
    await expect(LibraryService.getSerializedComponentById(authority, 'foreign')).resolves.toBeUndefined();
    await expect(LibraryService.getSerializedComponentById(authority, 'nonexistent')).resolves.toBeUndefined();
    await expect(LibraryService.getSerializedComponentLifeDashboard(authority, 'foreign')).resolves.toBeNull();
    await expect(LibraryService.getSerializedComponentLifeDashboard(authority, 'nonexistent')).resolves.toBeNull();
  });

  it('requires route-local canonical authority and never substitutes tenantContext or request input', () => {
    const routes = source('src/modules/library/library.routes.ts');
    const staffSlice = routes.slice(
      routes.indexOf("'/serialized-components',"),
      routes.indexOf("router.get('/asset-types/new'"),
    );
    expect(routes).toContain('assertTenantQueryAuthority(req.tenantAuthority)');
    expect(staffSlice).toContain('requireTenantAuthority(req)');
    expect(staffSlice).not.toMatch(/req\.tenantContext|req\.(?:body|query|params)\.(?:tenant|custodian)/);
  });

  it('contains all eight mandatory authority-first service signatures', () => {
    const service = source('src/modules/library/library.service.ts');
    for (const method of [
      'getSerializedComponents', 'getSerializedComponentById', 'createSerializedComponent',
      'updateSerializedComponent', 'getSerializedComponentLifeDashboard',
      'adjustSerializedComponentLifeState', 'recordSerializedComponentOverhaul',
      'recordSerializedComponentGenericMaintenanceEvent',
    ]) {
      expect(service).toMatch(new RegExp(`static async ${method}\\(\\s*authority: TenantQueryAuthority`));
    }
  });

  it('eliminates direct SerializedComponent root access from Library service', () => {
    const service = source('src/modules/library/library.service.ts');
    expect(service).not.toMatch(/SerializedComponent\.(?:findByPk|findOne|findAll|count|create|update)/);
    expect(service).not.toMatch(/authority\?\.tenantId|authority\?:\s*TenantQueryAuthority/);
  });

  it('preserves root-first child access and existing transaction/history coupling', () => {
    const service = source('src/modules/library/library.service.ts');
    for (const method of [
      'adjustSerializedComponentLifeState', 'recordSerializedComponentOverhaul',
      'recordSerializedComponentGenericMaintenanceEvent',
    ]) {
      const start = service.indexOf(`static async ${method}`);
      const end = service.indexOf('\n  static async ', start + 20);
      const body = service.slice(start, end < 0 ? undefined : end);
      expect(body.indexOf('getForUpdate(')).toBeGreaterThan(body.indexOf('sequelize.transaction('));
      expect(body.indexOf('SerializedComponentMaintenanceEvent.create(')).toBeGreaterThan(body.indexOf('getForUpdate('));
      expect(body).toContain('{ transaction }');
    }
  });

  it('leaves broad reconciliation, raw aggregates, and customer portal outside conversion claims', () => {
    const service = source('src/modules/library/library.service.ts');
    expect(service).toContain('getSerializedComponentReconciliationReport');
    expect(service).toContain('total_serialized_components');
    expect(source('src/app.ts')).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
  });
});
