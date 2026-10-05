import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { AircraftComponentInstallationTenantRepository } from './aircraft-component-installation-tenant.repository.js';

const authority = createTenantQueryAuthority({ state: 'VALID_ACTIVE_TENANT', tenant: { id: 'tenant-a', publicId: 'pa', code: 'A', displayName: 'A', status: 'ACTIVE' }, membership: { id: 'ma', tenantId: 'tenant-a', userId: 'ua', status: 'ACTIVE' }, validatedAt: 1 });
const model = (result: unknown = null) => ({ findOne: vi.fn().mockResolvedValue(result), findAll: vi.fn().mockResolvedValue(result ?? []) });
const roots = (query: any) => query.include.map((item: any) => [item.association, item.where]);

describe('AircraftComponentInstallationTenantRepository', () => {
  it.each([undefined, null, Object.freeze({ tenantId: 'tenant-a' }), { tenantId: 'tenant-a', roles: ['ADMIN'] }])('rejects invalid authority before adapter', async (invalid) => {
    const port = model();
    await expect(new AircraftComponentInstallationTenantRepository(port).getById(invalid as never, 'installation-a')).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    expect(port.findOne).not.toHaveBeenCalled();
  });
  it('requires both same-authority roots for direct ID reads', async () => {
    const port = model({ id: 'installation-a' });
    await expect(new AircraftComponentInstallationTenantRepository(port).getById(authority, 'installation-a')).resolves.toEqual({ id: 'installation-a' });
    expect(roots(port.findOne.mock.calls[0][0])).toEqual([
      ['Aircraft', { tenant_id: 'tenant-a' }],
      ['SerializedComponent', { custodian_tenant_id: 'tenant-a' }],
    ]);
  });
  it.each(['A-aircraft/B-component', 'B-aircraft/A-component', 'B-aircraft/B-component', 'nonexistent'])('makes mixed or absent installation %s unavailable', async () => {
    await expect(new AircraftComponentInstallationTenantRepository(model()).getById(authority, 'unavailable')).resolves.toBeUndefined();
  });
  it('preserves removed_at null and both roots for active Aircraft reads', async () => {
    const port = model([]);
    await new AircraftComponentInstallationTenantRepository(port).listActiveForAircraft(authority, 'aircraft-a');
    const query = port.findAll.mock.calls[0][0];
    expect(query.where).toEqual({ aircraft_id: 'aircraft-a', removed_at: null });
    expect(roots(query)).toEqual([
      ['Aircraft', { id: 'aircraft-a', tenant_id: 'tenant-a' }],
      ['SerializedComponent', { custodian_tenant_id: 'tenant-a' }],
    ]);
  });
  it('scopes active component lookup and multi-component history through both roots', async () => {
    const port = model([]);
    const repository = new AircraftComponentInstallationTenantRepository(port);
    await repository.getActiveForSerializedComponent(authority, 'component-a');
    expect(port.findOne.mock.calls[0][0].where).toEqual({ serialized_component_id: 'component-a', removed_at: null });
    await repository.listForSerializedComponents(authority, ['component-a']);
    expect(port.findAll.mock.calls[0][0].where).toEqual({ serialized_component_id: ['component-a'] });
    expect(roots(port.findAll.mock.calls[0][0])).toHaveLength(2);
  });
  it('keeps workflow installation and history reads fixed to both tenant roots', async () => {
    const port = model([]);
    const repository = new AircraftComponentInstallationTenantRepository(port);
    await repository.listActiveWorkflowForAircraft(authority, 'aircraft-a');
    expect(port.findAll.mock.calls[0][0].where).toEqual({ aircraft_id: 'aircraft-a', removed_at: null });
    expect(roots(port.findAll.mock.calls[0][0])).toEqual([
      ['Aircraft', { id: 'aircraft-a', tenant_id: 'tenant-a' }],
      ['SerializedComponent', { custodian_tenant_id: 'tenant-a' }],
    ]);
    await repository.listWorkflowHistoryForSerializedComponents(authority, ['component-a']);
    expect(port.findAll.mock.calls[1][0].where).toEqual({ serialized_component_id: ['component-a'] });
    expect(roots(port.findAll.mock.calls[1][0])).toEqual([
      ['Aircraft', { tenant_id: 'tenant-a' }],
      ['SerializedComponent', { custodian_tenant_id: 'tenant-a' }],
    ]);
  });
  it('keeps locked later-mutation resolution explicit and dual-root scoped', async () => {
    const port = model({ id: 'installation-a' });
    const transaction = { id: 'tx' } as never;
    await new AircraftComponentInstallationTenantRepository(port).getForUpdate(authority, 'installation-a', { transaction, lock: 'UPDATE' as never });
    expect(port.findOne.mock.calls[0][0]).toMatchObject({ transaction, lock: 'UPDATE' });
    expect(roots(port.findOne.mock.calls[0][0])).toHaveLength(2);
  });
  it('exposes no arbitrary query or mutation escape', () => {
    const source = fs.readFileSync(path.resolve('src/modules/aircraft/aircraft-component-installation-tenant.repository.ts'), 'utf8');
    expect(source).not.toMatch(/rawQuery|sequelize\.query|whereFromCaller|includeAnything|authority\?\.tenantId|\bADMIN\b/);
    expect(source).not.toMatch(/destroy|bulkCreate|async findAll\s*\(/);
    expect(source).toContain('async create(authority: TenantQueryAuthority');
    expect(source).toContain('async removeActiveById(authority: TenantQueryAuthority');
  });
});
