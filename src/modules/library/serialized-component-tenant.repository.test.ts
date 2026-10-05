import fs from 'node:fs';
import path from 'node:path';
import { Op } from 'sequelize';
import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { SerializedComponentTenantRepository } from './serialized-component-tenant.repository.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'public-a', code: 'A', displayName: 'A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
  validatedAt: 1,
});

function model(overrides: Record<string, unknown> = {}) {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'component-a' }),
    update: vi.fn().mockResolvedValue([1]),
    ...overrides,
  };
}

function conditions(call: unknown): readonly Record<PropertyKey, unknown>[] {
  return (call as { where: Record<PropertyKey, unknown> }).where[Op.and] as readonly Record<PropertyKey, unknown>[];
}

describe('SerializedComponentTenantRepository', () => {
  it.each([
    undefined, null, {}, Object.freeze({ tenantId: 'tenant-a' }),
    { ...authority }, Object.assign({}, authority),
    JSON.parse(JSON.stringify(authority)), { tenantId: 'tenant-a', roles: ['ADMIN'] },
  ])('rejects non-authentic authority before adapter access', async (invalid) => {
    const port = model();
    await expect(new SerializedComponentTenantRepository(port).getById(invalid as never, 'component-a'))
      .rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    expect(port.findOne).not.toHaveBeenCalled();
  });

  it('accepts factory authority and scopes direct ID atomically', async () => {
    const port = model({ findOne: vi.fn().mockResolvedValue({ id: 'component-a' }) });
    await expect(new SerializedComponentTenantRepository(port).getById(authority, 'component-a'))
      .resolves.toEqual({ id: 'component-a' });
    expect(conditions(port.findOne.mock.calls[0][0])).toEqual([
      { custodian_tenant_id: 'tenant-a' }, { id: 'component-a' },
    ]);
    expect('findByPk' in port).toBe(false);
  });

  it('collapses foreign and nonexistent IDs to the same neutral result', async () => {
    const repository = new SerializedComponentTenantRepository(model());
    await expect(repository.getById(authority, 'foreign')).resolves.toBeUndefined();
    await expect(repository.getById(authority, 'nonexistent')).resolves.toBeUndefined();
  });

  it('locks only an ID and custody scoped row in the supplied transaction', async () => {
    const record = { id: 'component-a' };
    const port = model({ findOne: vi.fn().mockResolvedValue(record) });
    const transaction = { id: 'tx' } as never;
    const lock = 'UPDATE' as never;
    await expect(new SerializedComponentTenantRepository(port).getForUpdate(
      authority, 'component-a', { transaction, lock },
    )).resolves.toBe(record);
    expect(conditions(port.findOne.mock.calls[0][0])).toEqual([
      { custodian_tenant_id: 'tenant-a' }, { id: 'component-a' },
    ]);
    expect(port.findOne.mock.calls[0][0]).toMatchObject({ transaction, lock });
  });

  it('lists only beneath custody and exposes no caller filter', async () => {
    const port = model();
    const repository = new SerializedComponentTenantRepository(port);
    await repository.list(authority);
    expect(conditions(port.findAll.mock.calls[0][0])).toEqual([
      { custodian_tenant_id: 'tenant-a' }, {},
    ]);
  });

  it('lists available components beneath custody with fixed shared-master projections', async () => {
    const port = model();
    await new SerializedComponentTenantRepository(port).listAvailable(authority);
    const query = port.findAll.mock.calls[0][0];
    expect(conditions(query)).toEqual([
      { custodian_tenant_id: 'tenant-a' }, { status: 'AVAILABLE' },
    ]);
    expect(query.include).toEqual(expect.arrayContaining([
      expect.objectContaining({ association: 'ComponentModel', required: true }),
    ]));
  });

  it('matches migration-590 normalized serial identity inside the tenant and model', async () => {
    const port = model({ findOne: vi.fn().mockResolvedValue({ id: 'component-a' }) });
    const repository = new SerializedComponentTenantRepository(port);
    await expect(repository.findBySerialIdentity(authority, 'model-a', '  sn-001 '))
      .resolves.toBeDefined();
    const scoped = conditions(port.findOne.mock.calls[0][0]);
    expect(scoped[0]).toEqual({ custodian_tenant_id: 'tenant-a' });
    expect(scoped[1]).toMatchObject({ component_model_id: 'model-a' });
    const identityConditions = scoped[1][Op.and] as readonly unknown[];
    expect(JSON.stringify(identityConditions[0])).toContain('SN-001');
  });

  it('does not disclose a cross-tenant equivalent serial identity', async () => {
    const port = model();
    await expect(new SerializedComponentTenantRepository(port)
      .findBySerialIdentity(authority, 'model-a', 'SN-001')).resolves.toBeUndefined();
    expect(conditions(port.findOne.mock.calls[0][0])[0]).toEqual({ custodian_tenant_id: 'tenant-a' });
  });

  it('derives custody on create and rejects every ownership override', async () => {
    const input = { component_model_id: 'model-a', serial_number: ' SN-001 ', status: 'AVAILABLE' };
    const aliases = ['custodian_tenant_id', 'custodianTenantId', 'tenant_id', 'tenantId'];
    const port = model();
    const repository = new SerializedComponentTenantRepository(port);
    await repository.create(authority, input);
    expect(port.create.mock.calls[0][0]).toMatchObject({
      custodian_tenant_id: 'tenant-a', component_model_id: 'model-a', serial_number: 'SN-001',
    });
    for (const alias of aliases) {
      await expect(repository.create(authority, { ...input, [alias]: 'tenant-b' } as never))
        .rejects.toThrow('TENANT_QUERY_FAILED');
    }
    expect(port.create).toHaveBeenCalledTimes(1);
  });

  it.each([[0, 'UNAVAILABLE'], [1, 'CHANGED']] as const)(
    'maps %i affected tenant-scoped updates to %s', async (affected, outcome) => {
      const port = model({ update: vi.fn().mockResolvedValue([affected]) });
      const result = await new SerializedComponentTenantRepository(port)
        .updateById(authority, 'component-a', { serial_number: ' SN-NEW ' });
      expect(result).toEqual({ outcome });
      expect(conditions(port.update.mock.calls[0][1])).toEqual([
        { custodian_tenant_id: 'tenant-a' }, { id: 'component-a' },
      ]);
      expect(port.update.mock.calls[0][0]).not.toHaveProperty('custodian_tenant_id');
    },
  );

  it('fails closed for custody changes and impossible multi-row updates', async () => {
    const port = model({ update: vi.fn().mockResolvedValue([2]) });
    const repository = new SerializedComponentTenantRepository(port);
    await expect(repository.updateById(authority, 'component-a', { custodian_tenant_id: 'tenant-b' } as never))
      .rejects.toThrow('TENANT_QUERY_FAILED');
    await expect(repository.updateById(authority, 'component-a', { status: 'AVAILABLE' }))
      .rejects.toThrow('TENANT_QUERY_FAILED');
  });

  it('contains no count, raw SQL, arbitrary where/include, role, or transfer escape', () => {
    const repository = new SerializedComponentTenantRepository(model());
    expect('count' in repository).toBe(false);
    const source = fs.readFileSync(path.resolve(
      'src/modules/library/serialized-component-tenant.repository.ts',
    ), 'utf8');
    expect(source).not.toMatch(/sequelize\.query|findByPk|authority\?\.tenantId|authority\?:/);
    expect(source).not.toMatch(/\bADMIN\b|\brole\b|permission|transferCustody|setCustodian/);
    expect(source).not.toMatch(/rawQuery|includeAnything|whereFromCaller/);
  });
});
