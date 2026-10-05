import fs from 'node:fs';
import path from 'node:path';
import { Op } from 'sequelize';
import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { AircraftTenantRepository } from './aircraft-tenant.repository.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'public-a', code: 'TENANT_A', displayName: 'Tenant A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
  validatedAt: 1,
});

function model(overrides: Record<string, unknown> = {}) {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 'aircraft-a' }),
    update: vi.fn().mockResolvedValue([1]),
    ...overrides,
  };
}

function conditions(call: unknown): readonly Record<PropertyKey, unknown>[] {
  const options = call as { where: Record<PropertyKey, unknown> };
  return options.where[Op.and] as readonly Record<PropertyKey, unknown>[];
}

describe('AircraftTenantRepository', () => {
  it('exposes a lifecycle-capable compile-time return contract', () => {
    type Result = Awaited<ReturnType<AircraftTenantRepository['getForLifecycleUpdate']>>;
    type LifecycleInstance = Exclude<Result, undefined>;
    type Status = LifecycleInstance['status'];
    type Version = LifecycleInstance['version'];
    type Save = LifecycleInstance['save'];
    type StatusIsString = Status extends string ? true : false;
    type VersionIsNumber = Version extends number ? true : false;
    type SaveIsCallable = Save extends (...args: never[]) => Promise<LifecycleInstance>
      ? true
      : false;
    const statusIsString: StatusIsString = true;
    const versionIsNumber: VersionIsNumber = true;
    const saveIsCallable: SaveIsCallable = true;
    expect([statusIsString, versionIsNumber, saveIsCallable]).toEqual([true, true, true]);
  });

  it('requires branded authority first and has no bare or optional authority API', async () => {
    const port = model();
    const repository = new AircraftTenantRepository(port);
    await expect(repository.getById(undefined as never, 'aircraft-a')).rejects.toThrow(
      'TENANT_AUTHORITY_REQUIRED',
    );
    expect(port.findOne).not.toHaveBeenCalled();
    await expect(
      repository.getById(Object.freeze({ tenantId: 'tenant-a' }) as never, 'aircraft-a'),
    ).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    expect(port.findOne).not.toHaveBeenCalled();

    type First = Parameters<AircraftTenantRepository['getById']>[0];
    type BareStringAccepted = string extends First ? true : false;
    type OptionalAuthority = undefined extends First ? true : false;
    const bareStringAccepted: BareStringAccepted = false;
    const optionalAuthority: OptionalAuthority = false;
    expect([bareStringAccepted, optionalAuthority]).toEqual([false, false]);
  });

  it('queries direct ID and authoritative ownership together without findByPk', async () => {
    const port = model({ findOne: vi.fn().mockResolvedValue({ id: 'aircraft-a' }) });
    const repository = new AircraftTenantRepository(port);
    await expect(repository.getById(authority, 'aircraft-a')).resolves.toEqual({ id: 'aircraft-a' });
    expect(conditions(port.findOne.mock.calls[0][0])).toEqual([
      { tenant_id: 'tenant-a' },
      { id: 'aircraft-a' },
    ]);
    expect('findByPk' in port).toBe(false);
  });

  it('collapses foreign and nonexistent direct IDs to the same neutral result', async () => {
    const port = model();
    const repository = new AircraftTenantRepository(port);
    await expect(repository.getById(authority, 'absent-or-foreign')).resolves.toBeUndefined();
  });

  it('scopes normalized registration lookup and existence to authority', async () => {
    const port = model({ findOne: vi.fn().mockResolvedValue({ id: 'aircraft-a' }) });
    const repository = new AircraftTenantRepository(port);
    await expect(repository.getByRegistration(authority, '  zs-abc ')).resolves.toBeDefined();
    const lookupConditions = conditions(port.findOne.mock.calls[0][0]);
    expect(lookupConditions[0]).toEqual({ tenant_id: 'tenant-a' });
    expect(JSON.stringify(lookupConditions[1])).toContain('ZS-ABC');
    await expect(repository.registrationExists(authority, 'zs-abc')).resolves.toBe(true);
  });

  it('lists beneath ownership and contains business status predicates', async () => {
    const port = model();
    const repository = new AircraftTenantRepository(port);
    await repository.list(authority, { status: 'ACTIVE' });
    expect(conditions(port.findAll.mock.calls[0][0])).toEqual([
      { tenant_id: 'tenant-a' },
      { status: 'ACTIVE' },
    ]);
  });

  it('counts in the database beneath ownership', async () => {
    const port = model({ count: vi.fn().mockResolvedValue(3) });
    const repository = new AircraftTenantRepository(port);
    await expect(repository.count(authority, { status: 'ACTIVE' })).resolves.toBe(3);
    expect(conditions(port.count.mock.calls[0][0])[0]).toEqual({ tenant_id: 'tenant-a' });
  });

  it('creates with authority-owned tenant_id and rejects ownership aliases', async () => {
    const port = model();
    const repository = new AircraftTenantRepository(port);
    const input = {
      registration: 'ZS-ABC', serial_number: 'SN-1', model_id: 'model-1', category_id: 'category-1',
    };
    await repository.create(authority, input, { transaction: { id: 'tx' } as never });
    expect(port.create.mock.calls[0][0]).toMatchObject({ ...input, tenant_id: 'tenant-a' });
    await expect(
      repository.create(authority, { ...input, tenant_id: 'foreign' } as never),
    ).rejects.toThrow('TENANT_QUERY_FAILED');
    expect(port.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    [0, 'UNAVAILABLE'],
    [1, 'CHANGED'],
  ] as const)('maps %i affected unique updates to %s', async (affected, outcome) => {
    const port = model({ update: vi.fn().mockResolvedValue([affected]) });
    const repository = new AircraftTenantRepository(port);
    await expect(repository.updateById(authority, 'aircraft-a', { registration: 'ZS-NEW' }))
      .resolves.toEqual({ outcome });
    expect(conditions(port.update.mock.calls[0][1])).toEqual([
      { tenant_id: 'tenant-a' },
      { id: 'aircraft-a' },
    ]);
  });

  it('fails closed for impossible multi-row unique mutation and ownership changes', async () => {
    const port = model({ update: vi.fn().mockResolvedValue([2]) });
    const repository = new AircraftTenantRepository(port);
    await expect(repository.updateById(authority, 'aircraft-a', { registration: 'ZS-NEW' }))
      .rejects.toThrow('TENANT_QUERY_FAILED');
    await expect(repository.updateById(authority, 'aircraft-a', { tenant_id: 'foreign' } as never))
      .rejects.toThrow('TENANT_QUERY_FAILED');
  });

  it('resolves a tenant-owned lifecycle instance with the caller transaction and row lock', async () => {
    const aircraft = {
      id: 'aircraft-a',
      status: 'ACTIVE',
      version: 3,
      save: vi.fn().mockResolvedValue(undefined),
    };
    const port = model({ findOne: vi.fn().mockResolvedValue(aircraft) });
    const repository = new AircraftTenantRepository(port);
    const transaction = { id: 'tx' } as never;
    const lock = 'UPDATE' as never;
    await expect(repository.getForLifecycleUpdate(authority, 'aircraft-a', {
      transaction,
      lock,
    })).resolves.toBe(aircraft);
    expect(conditions(port.findOne.mock.calls[0][0])).toEqual([
      { tenant_id: 'tenant-a' },
      { id: 'aircraft-a' },
    ]);
    expect(port.findOne.mock.calls[0][0]).toMatchObject({
      transaction,
      lock,
    });
    expect(port.update).not.toHaveBeenCalled();
  });

  it('keeps lifecycle policy, mutation, instance save, and audit outside the repository', async () => {
    const port = model();
    const repository = new AircraftTenantRepository(port);
    await expect(repository.getForLifecycleUpdate(authority, 'foreign-or-absent', {
      transaction: { id: 'tx' } as never,
      lock: 'UPDATE' as never,
    })).resolves.toBeUndefined();

    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/aircraft/aircraft-tenant.repository.ts'), 'utf8',
    );
    expect(source).not.toMatch(/updateLifecycleStatus|setAircraftStatus|transitionStatus/);
    expect(source).not.toMatch(/expectedStatus|nextStatus|allowedTransitions|INVALID_TRANSITION/);
    expect(source).not.toMatch(/AuditService|STATUS_CHANGE|\.save\s*\(/);
    expect(port.update).not.toHaveBeenCalled();
  });

  it('retrieves a tenant-scoped locked instance for service-owned root updates', async () => {
    const aircraft = { id: 'aircraft-a', status: 'ACTIVE', version: 2, save: vi.fn() };
    const port = model({ findOne: vi.fn().mockResolvedValue(aircraft) });
    const repository = new AircraftTenantRepository(port);
    const transaction = { id: 'tx' } as never;
    const lock = 'UPDATE' as never;

    await expect(repository.getForRootUpdate(authority, 'aircraft-a', {
      transaction,
      lock,
    })).resolves.toBe(aircraft);
    expect(conditions(port.findOne.mock.calls[0][0])).toEqual([
      { tenant_id: 'tenant-a' },
      { id: 'aircraft-a' },
    ]);
    expect(port.findOne.mock.calls[0][0]).toMatchObject({ transaction, lock });
  });

  it('resolves only a minimal tenant-owned root projection', async () => {
    const port = model({ findOne: vi.fn().mockResolvedValue({ id: 'aircraft-a', tenant_id: 'tenant-a' }) });
    const repository = new AircraftTenantRepository(port);
    const root = await repository.resolveOwnedRoot(authority, 'aircraft-a');
    expect(root).toEqual({ id: 'aircraft-a' });
    expect(Object.isFrozen(root)).toBe(true);
    expect(port.findOne.mock.calls[0][0].attributes).toEqual(['id']);
  });

  it('keeps transactions separate and exposes no include or child-query API', async () => {
    const transaction = { id: 'tx' } as never;
    const port = model();
    const repository = new AircraftTenantRepository(port);
    await repository.getById(authority, 'aircraft-a', { transaction });
    expect(port.findOne.mock.calls[0][0].transaction).toBe(transaction);
    expect(port.findOne.mock.calls[0][0]).not.toHaveProperty('include');

    await repository.getById(authority, 'aircraft-b');
    expect(port.findOne.mock.calls[1][0]).not.toHaveProperty('transaction');
  });

  it('introduces no customer, gate, SQL, role, or global authority behavior', () => {
    const repositorySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/aircraft/aircraft-tenant.repository.ts'), 'utf8',
    );
    const productionReferences = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/aircraft/aircraft.controller.ts'), 'utf8',
    ) + fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/aircraft/aircraft.service.ts'), 'utf8',
    );
    expect(productionReferences).toContain('aircraft-tenant.repository');
    expect(repositorySource).not.toMatch(
      /\bCustomer\b|customer-portal|requireValidActiveTenantContext|sequelize\.query|\bADMIN\b|\brole\b|permission|user_roles|tenant_membership_roles|AsyncLocalStorage|globalThis/,
    );
    expect(repositorySource).not.toMatch(/authority\?:|tenantIdOrAuthority|findByPk/);
    expect(repositorySource).not.toMatch(/include\??:|\.\.\.[^\n]*(?:tenant_id|authority\.tenantId)/);
    expect(
      fs.readdirSync(path.resolve(process.cwd(), 'migrations')).some((name) => name.startsWith('591_')),
    ).toBe(false);
  });
});
