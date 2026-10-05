import fs from 'node:fs';
import path from 'node:path';
import { Op } from 'sequelize';
import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { CustomerTenantRepository } from './customer-tenant.repository.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'public-a', code: 'TENANT_A', displayName: 'Tenant A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
  validatedAt: 1,
});
const createInput = Object.freeze({
  name: 'Acme',
  contact_person: 'Alex',
  email: 'alex@example.test',
  phone: '0123456789',
  status: 'ACTIVE' as const,
});

function model(overrides: Record<string, unknown> = {}) {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 'customer-a' }),
    update: vi.fn().mockResolvedValue([1]),
    ...overrides,
  };
}

function conditions(call: unknown): readonly Record<PropertyKey, unknown>[] {
  const options = call as { where: Record<PropertyKey, unknown> };
  return options.where[Op.and] as readonly Record<PropertyKey, unknown>[];
}

describe('CustomerTenantRepository', () => {
  it('requires branded authority first and accepts neither a bare nor optional authority', async () => {
    const port = model();
    const repository = new CustomerTenantRepository(port);
    await expect(repository.getById(undefined as never, 'customer-a')).rejects.toThrow(
      'TENANT_AUTHORITY_REQUIRED',
    );
    expect(port.findOne).not.toHaveBeenCalled();
    await expect(
      repository.getById(Object.freeze({ tenantId: 'tenant-a' }) as never, 'customer-a'),
    ).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    expect(port.findOne).not.toHaveBeenCalled();
    type First = Parameters<CustomerTenantRepository['getById']>[0];
    const bareAccepted: string extends First ? true : false = false;
    const optional: undefined extends First ? true : false = false;
    expect([bareAccepted, optional]).toEqual([false, false]);
  });

  it('queries direct ID and ownership together and neutrally returns absent', async () => {
    const port = model();
    const repository = new CustomerTenantRepository(port);
    await expect(repository.getById(authority, 'foreign-or-absent')).resolves.toBeUndefined();
    expect(conditions(port.findOne.mock.calls[0][0])).toEqual([
      { tenant_id: 'tenant-a' },
      { id: 'foreign-or-absent' },
    ]);
    expect('findByPk' in port).toBe(false);
  });

  it('resolves a tenant-owned root with the required transaction and row lock', async () => {
    const port = model({ findOne: vi.fn().mockResolvedValue({ id: 'customer-a' }) });
    const repository = new CustomerTenantRepository(port);
    const transaction = { id: 'tx' } as never;
    const lock = { level: 'UPDATE' } as never;
    await expect(repository.getForRootUpdate(authority, 'customer-a', { transaction, lock }))
      .resolves.toEqual({ id: 'customer-a' });
    expect(conditions(port.findOne.mock.calls[0][0])).toEqual([
      { tenant_id: 'tenant-a' },
      { id: 'customer-a' },
    ]);
    expect(port.findOne.mock.calls[0][0]).toMatchObject({ transaction, lock });
    expect(port.findOne.mock.calls[0][0].attributes).toContain('account_reference');
  });

  it('lists and contains trusted filters beneath ownership, ignoring caller escape fields', async () => {
    const port = model();
    const repository = new CustomerTenantRepository(port);
    await repository.list(authority, {
      status: 'ACTIVE',
      [Op.or]: [{ tenant_id: 'tenant-b' }],
      tenant_id: 'tenant-b',
    } as never);
    expect(conditions(port.findAll.mock.calls[0][0])).toEqual([
      { tenant_id: 'tenant-a' },
      { status: 'ACTIVE' },
    ]);
    expect(port.findAll.mock.calls[0][0]).not.toHaveProperty('include');
  });

  it('uses the canonical ACTIVE state beneath ownership', async () => {
    const port = model();
    const repository = new CustomerTenantRepository(port);
    await repository.listActive(authority);
    expect(conditions(port.findAll.mock.calls[0][0])).toEqual([
      { tenant_id: 'tenant-a' },
      { status: 'ACTIVE' },
    ]);
  });

  it('counts only within ownership', async () => {
    const port = model({ count: vi.fn().mockResolvedValue(2) });
    const repository = new CustomerTenantRepository(port);
    await expect(repository.count(authority, { status: 'INACTIVE' })).resolves.toBe(2);
    expect(conditions(port.count.mock.calls[0][0])).toEqual([
      { tenant_id: 'tenant-a' },
      { status: 'INACTIVE' },
    ]);
  });

  it('normalizes nonblank account references exactly like migration 590 within the tenant', async () => {
    const port = model({ findOne: vi.fn().mockResolvedValue({ id: 'customer-a' }) });
    const repository = new CustomerTenantRepository(port);
    await expect(repository.accountReferenceExists(authority, '  ac-42 ')).resolves.toBe(true);
    const scoped = conditions(port.findOne.mock.calls[0][0]);
    expect(scoped[0]).toEqual({ tenant_id: 'tenant-a' });
    expect(JSON.stringify(scoped[1])).toContain('AC-42');

    await expect(repository.accountReferenceExists(authority, '   ')).resolves.toBe(false);
    await expect(repository.accountReferenceExists(authority, null)).resolves.toBe(false);
    expect(port.findOne).toHaveBeenCalledTimes(1);
  });

  it('does not turn another tenant equivalent reference into a global collision', async () => {
    const port = model();
    const repository = new CustomerTenantRepository(port);
    await expect(repository.accountReferenceExists(authority, 'REF-1')).resolves.toBe(false);
    expect(conditions(port.findOne.mock.calls[0][0])[0]).toEqual({ tenant_id: 'tenant-a' });
  });

  it('creates from separate authority and rejects every ownership alias', async () => {
    const port = model();
    const repository = new CustomerTenantRepository(port);
    await repository.create(authority, createInput, { transaction: { id: 'tx' } as never });
    expect(port.create.mock.calls[0][0]).toMatchObject({ ...createInput, tenant_id: 'tenant-a' });
    expect(port.create.mock.calls[0][1]).toEqual({ transaction: { id: 'tx' } });
    for (const field of ['tenant_id', 'tenantId', 'Tenant', 'organisation_id', 'organisationId']) {
      await expect(repository.create(authority, { ...createInput, [field]: 'foreign' } as never))
        .rejects.toThrow('TENANT_QUERY_FAILED');
    }
    expect(port.create).toHaveBeenCalledTimes(1);
  });

  it.each([[0, 'UNAVAILABLE'], [1, 'CHANGED']] as const)(
    'maps %i affected scoped updates to %s',
    async (affected, outcome) => {
      const port = model({ update: vi.fn().mockResolvedValue([affected]) });
      const repository = new CustomerTenantRepository(port);
      await expect(repository.updateById(authority, 'customer-a', { name: 'Changed' }))
        .resolves.toEqual({ outcome });
      expect(conditions(port.update.mock.calls[0][1])).toEqual([
        { tenant_id: 'tenant-a' },
        { id: 'customer-a' },
      ]);
    },
  );

  it('fails closed for impossible multi-row mutation and immutable ownership input', async () => {
    const port = model({ update: vi.fn().mockResolvedValue([2]) });
    const repository = new CustomerTenantRepository(port);
    await expect(repository.updateById(authority, 'customer-a', { name: 'Changed' }))
      .rejects.toThrow('TENANT_QUERY_FAILED');
    await expect(repository.updateById(authority, 'customer-a', { tenant_id: 'foreign' } as never))
      .rejects.toThrow('TENANT_QUERY_FAILED');
  });

  it('keeps optional transactions separate and omitted when absent', async () => {
    const port = model();
    const repository = new CustomerTenantRepository(port);
    const transaction = { id: 'tx' } as never;
    await repository.getById(authority, 'customer-a', { transaction });
    expect(port.findOne.mock.calls[0][0].transaction).toBe(transaction);
    await repository.getById(authority, 'customer-b');
    expect(port.findOne.mock.calls[1][0]).not.toHaveProperty('transaction');
  });

  it('has no arbitrary options/include, RBAC, portal, relationship, DB, or global authority API', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/customers/customer-tenant.repository.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/findByPk|include\??:|CustomerAircraftLink|customer-portal/);
    expect(source).not.toMatch(
      /requireValidActiveTenantContext|sequelize\.query|database\.js|\bADMIN\b|\brole\b|permission|user_roles|tenant_membership_roles|AsyncLocalStorage|globalThis/,
    );
    expect(source).not.toMatch(/authority\?:|tenantIdOrAuthority/);
    expect(source).not.toMatch(/delete|destroy|transfer|audit/i);
  });

  it('has only the approved live consumers and preserves portal, gate, and migration boundaries', () => {
    const customersRoot = path.resolve(process.cwd(), 'src/modules/customers');
    const consumers = fs.readdirSync(customersRoot)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .filter((name) => name !== 'customer-tenant.repository.ts')
      .filter((name) => fs.readFileSync(path.join(customersRoot, name), 'utf8')
        .includes('customer-tenant.repository'));
    expect(consumers.sort()).toEqual([
      'customer-aircraft-link-tenant.live.ts',
      'customer-tenant.repository.live.ts',
      'customers.service.ts',
    ]);

    const portal = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/customer-portal/customer-portal.routes.ts'),
      'utf8',
    );
    expect(portal).not.toMatch(/Customer\.findByPk|sequelize\.query/);
    expect(portal).toContain('resolveCustomerPortalAuthority');
    const app = fs.readFileSync(path.resolve(process.cwd(), 'src/app.ts'), 'utf8');
    expect(app).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
    expect(
      fs.readdirSync(path.resolve(process.cwd(), 'migrations')).some((name) => name.startsWith('591_')),
    ).toBe(false);
  });
});
