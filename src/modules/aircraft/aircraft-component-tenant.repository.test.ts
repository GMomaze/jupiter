import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { AircraftComponentTenantRepository } from './aircraft-component-tenant.repository.js';

const authority = createTenantQueryAuthority({ state: 'VALID_ACTIVE_TENANT', tenant: { id: 'tenant-a', publicId: 'pa', code: 'A', displayName: 'A', status: 'ACTIVE' }, membership: { id: 'ma', tenantId: 'tenant-a', userId: 'ua', status: 'ACTIVE' }, validatedAt: 1 });
const model = (result: unknown = null) => ({
  findOne: vi.fn().mockResolvedValue(result),
  findAll: vi.fn().mockResolvedValue(result ?? []),
  create: vi.fn().mockResolvedValue(result),
  update: vi.fn().mockResolvedValue([1]),
});

describe('AircraftComponentTenantRepository', () => {
  it.each([undefined, null, {}, Object.freeze({ tenantId: 'tenant-a' }), { tenantId: 'tenant-a', roles: ['ADMIN'] }])('rejects invalid authority before adapter', async (invalid) => {
    const port = model();
    await expect(new AircraftComponentTenantRepository(port).getById(invalid as never, 'child-a')).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    expect(port.findOne).not.toHaveBeenCalled();
  });
  it('returns an own direct child only through its tenant-owned Aircraft root', async () => {
    const port = model({ id: 'child-a' });
    await expect(new AircraftComponentTenantRepository(port).getById(authority, 'child-a')).resolves.toEqual({ id: 'child-a' });
    const query = port.findOne.mock.calls[0][0];
    expect(query.where).toEqual({ id: 'child-a' });
    expect(query.include).toEqual(expect.arrayContaining([expect.objectContaining({ association: 'Aircraft', required: true, where: { tenant_id: 'tenant-a' } })]));
  });
  it('makes foreign and nonexistent direct IDs identically unavailable', async () => {
    const repository = new AircraftComponentTenantRepository(model());
    await expect(repository.getById(authority, 'foreign')).resolves.toBeUndefined();
    await expect(repository.getById(authority, 'nonexistent')).resolves.toBeUndefined();
  });
  it('lists by child Aircraft ID and proves the same tenant-owned root', async () => {
    const port = model([]);
    await new AircraftComponentTenantRepository(port).listForAircraft(authority, 'aircraft-a');
    const query = port.findAll.mock.calls[0][0];
    expect(query.where).toEqual({ aircraft_id: 'aircraft-a' });
    expect(query.include[0]).toMatchObject({ association: 'Aircraft', required: true, where: { id: 'aircraft-a', tenant_id: 'tenant-a' } });
  });
  it('scopes installed workflow and quarantine checks through the owned Aircraft root', async () => {
    const port = model([]);
    const repository = new AircraftComponentTenantRepository(port);
    await repository.listInstalledForAircraft(authority, 'aircraft-a');
    expect(port.findAll.mock.calls[0][0]).toMatchObject({
      where: { aircraft_id: 'aircraft-a', current_status: 'INSTALLED' },
      include: expect.arrayContaining([
        expect.objectContaining({ association: 'Aircraft', required: true, where: { id: 'aircraft-a', tenant_id: 'tenant-a' } }),
      ]),
    });
    await repository.hasQuarantinedForAircraft(authority, 'aircraft-a');
    expect(port.findOne.mock.calls[0][0]).toMatchObject({
      where: { aircraft_id: 'aircraft-a', current_status: 'QUARANTINED', removed_at: null },
      include: [expect.objectContaining({ association: 'Aircraft', required: true, where: { id: 'aircraft-a', tenant_id: 'tenant-a' } })],
    });
  });
  it('keeps locked child lookup and conflict searches tenant-root scoped', async () => {
    const port = model({ id: 'child-a' });
    const repository = new AircraftComponentTenantRepository(port);
    const transaction = { id: 'tx' } as never;
    await repository.getForUpdate(authority, 'child-a', { transaction, lock: 'UPDATE' as never });
    await repository.hasInstalledSerialConflict(authority, 'SERIAL-A', { transaction, lock: 'UPDATE' as never });
    await repository.hasInstalledPositionConflict(authority, 'aircraft-a', 'BAT-1', { transaction, lock: 'UPDATE' as never });
    for (const query of port.findOne.mock.calls.map(([value]) => value)) {
      expect(query).toMatchObject({ transaction, lock: 'UPDATE' });
      expect(query.include).toEqual(expect.arrayContaining([
        expect.objectContaining({ association: 'Aircraft', required: true, where: expect.objectContaining({ tenant_id: 'tenant-a' }) }),
      ]));
    }
  });
  it('creates after authority validation and updates only the locked aircraft child version', async () => {
    const port = model({ id: 'child-a' });
    const repository = new AircraftComponentTenantRepository(port);
    const transaction = { id: 'tx' } as never;
    await repository.create(authority, {
      aircraft_id: 'aircraft-a', model_id: 'model-a', serial_number: 'SERIAL-A',
      position_code: 'BAT-1', installation_date: '2026-09-05', tsn_at_install: 0,
      tso_at_install: 0, install_af_hours: 10, current_status: 'INSTALLED', removed_at: null, version: 0,
    }, { transaction });
    await expect(repository.updateByVersion(authority, 'child-a', 'aircraft-a', 3, { current_status: 'REMOVED', version: 4 }, { transaction })).resolves.toEqual({ outcome: 'CHANGED' });
    expect(port.create).toHaveBeenCalledWith(expect.objectContaining({ aircraft_id: 'aircraft-a' }), { transaction });
    expect(port.update).toHaveBeenCalledWith(expect.objectContaining({ version: 4 }), {
      where: { id: 'child-a', aircraft_id: 'aircraft-a', version: 3 }, transaction,
    });
  });
  it('has only fixed root/shared includes and no arbitrary query or destructive escape', () => {
    const source = fs.readFileSync(path.resolve('src/modules/aircraft/aircraft-component-tenant.repository.ts'), 'utf8');
    expect(source).not.toMatch(/rawQuery|sequelize\.query|whereFromCaller|includeAnything|authority\?\.tenantId|\bADMIN\b/);
    expect(source).not.toMatch(/\b(destroy|bulkCreate)\s*\(/);
    expect(source).toContain('async create(authority: TenantQueryAuthority');
    expect(source).toContain('async updateByVersion(authority: TenantQueryAuthority');
  });
});
