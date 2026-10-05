import fs from 'node:fs';
import path from 'node:path';
import { Op } from 'sequelize';
import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import {
  CustomerAircraftLinkTenantRepository,
  type CustomerAircraftLinkCreateInput,
} from './customer-aircraft-link-tenant.repository.js';
import { CustomerAircraftLinkTenantService } from './customer-aircraft-link-tenant.service.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'public-a', code: 'TENANT_A', displayName: 'Tenant A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
  validatedAt: 1,
});
const transaction = Object.freeze({ id: 'tx' }) as never;
const input: CustomerAircraftLinkCreateInput = Object.freeze({
  customerId: 'customer-a',
  aircraftId: 'aircraft-a',
  relationshipType: 'OWNER',
  startDate: '2026-08-28',
  notes: 'Owned fixture',
});

function ports(overrides: {
  customer?: unknown;
  aircraft?: unknown;
  link?: Record<string, unknown> | null;
  links?: readonly Record<string, unknown>[];
} = {}) {
  const link = {
    id: 'link-a', customer_id: 'customer-a', aircraft_id: 'aircraft-a',
    relationship_type: 'OWNER', is_current: true, start_date: '2026-08-28',
    end_date: null, notes: null,
    toJSON: vi.fn().mockReturnValue({
      id: 'link-a', customer_id: 'customer-a', aircraft_id: 'aircraft-a',
      relationship_type: 'OWNER', is_current: true, start_date: '2026-08-28',
      end_date: null, notes: null,
    }),
  };
  return {
    linkModel: {
      findOne: vi.fn().mockResolvedValue(overrides.link ?? null),
      findAll: vi.fn().mockResolvedValue(overrides.links ?? []),
      create: vi.fn().mockResolvedValue(link),
    },
    customerRoots: {
      getById: vi.fn().mockResolvedValue(
        overrides.customer === undefined ? { id: 'customer-a', tenant_id: 'tenant-a' } : overrides.customer,
      ),
    },
    aircraftRoots: {
      resolveOwnedRoot: vi.fn().mockResolvedValue(
        overrides.aircraft === undefined ? { id: 'aircraft-a' } : overrides.aircraft,
      ),
    },
    customerAssociation: Object.freeze({ name: 'Customer' }),
    aircraftAssociation: Object.freeze({ name: 'Aircraft' }),
  };
}

function repository(port = ports()) {
  return new CustomerAircraftLinkTenantRepository(
    port.linkModel as never,
    port.customerRoots as never,
    port.aircraftRoots as never,
    port.customerAssociation,
    port.aircraftAssociation,
  );
}

function includeConditions(call: Record<string, unknown>, index: number) {
  const include = call.include as readonly { where: Record<PropertyKey, unknown> }[];
  return include[index]?.where[Op.and];
}

describe('CustomerAircraftLink tenant contract', () => {
  it('requires branded TenantQueryAuthority first in repository and service APIs', async () => {
    const port = ports();
    const repo = repository(port);
    await expect(repo.getById(undefined as never, 'link-a')).rejects.toThrow(
      'TENANT_AUTHORITY_REQUIRED',
    );
    const forged = Object.freeze({ tenantId: 'tenant-a' }) as never;
    await expect(repo.getById(forged, 'link-a')).rejects.toThrow(
      'TENANT_AUTHORITY_REQUIRED',
    );
    const audit = { log: vi.fn() };
    const service = new CustomerAircraftLinkTenantService(repo, audit as never);
    await expect(service.createLink(forged, input, { transaction })).rejects.toThrow(
      'TENANT_AUTHORITY_REQUIRED',
    );
    type RepositoryFirst = Parameters<CustomerAircraftLinkTenantRepository['create']>[0];
    type ServiceFirst = Parameters<CustomerAircraftLinkTenantService['createLink']>[0];
    const bareRepository: string extends RepositoryFirst ? true : false = false;
    const optionalRepository: undefined extends RepositoryFirst ? true : false = false;
    const bareService: string extends ServiceFirst ? true : false = false;
    expect([bareRepository, optionalRepository, bareService]).toEqual([false, false, false]);
    expect(port.linkModel.findOne).not.toHaveBeenCalled();
    expect(port.customerRoots.getById).not.toHaveBeenCalled();
    expect(port.aircraftRoots.resolveOwnedRoot).not.toHaveBeenCalled();
    expect(port.linkModel.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('proves both same-tenant roots before creating a current relationship', async () => {
    const port = ports();
    await repository(port).create(authority, input, { transaction });
    expect(port.customerRoots.getById).toHaveBeenCalledWith(
      authority, 'customer-a', { transaction },
    );
    expect(port.aircraftRoots.resolveOwnedRoot).toHaveBeenCalledWith(
      authority, 'aircraft-a', { transaction },
    );
    expect(port.linkModel.create).toHaveBeenCalledWith({
      customer_id: 'customer-a',
      aircraft_id: 'aircraft-a',
      relationship_type: 'OWNER',
      is_current: true,
      start_date: '2026-08-28',
      end_date: null,
      notes: 'Owned fixture',
    }, { transaction });
  });

  it.each([
    ['foreign or absent Customer', null, { id: 'aircraft-a' }],
    ['foreign or absent Aircraft', { id: 'customer-a' }, null],
  ])('neutrally rejects %s before insertion', async (_label, customer, aircraft) => {
    const port = ports({ customer, aircraft });
    await expect(repository(port).create(authority, input, { transaction }))
      .rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    expect(port.linkModel.create).not.toHaveBeenCalled();
  });

  it('preserves existing current-link uniqueness semantics before insert', async () => {
    const port = ports({ link: { id: 'existing' } });
    await expect(repository(port).create(authority, input, { transaction }))
      .rejects.toThrow('CURRENT_CUSTOMER_ALREADY_ASSIGNED');
    const lookup = port.linkModel.findOne.mock.calls[0][0];
    expect(lookup.where).toEqual({
      customer_id: 'customer-a', aircraft_id: 'aircraft-a', relationship_type: 'OWNER', is_current: true,
    });
    expect(port.linkModel.create).not.toHaveBeenCalled();
  });

  it('rejects ownership aliases and never writes root ownership fields', async () => {
    for (const field of [
      'tenant_id', 'tenantId', 'customer_tenant_id', 'aircraft_tenant_id',
      'organisation_id', 'organisationId',
    ]) {
      const port = ports();
      await expect(repository(port).create(authority, { ...input, [field]: 'foreign' } as never, {
        transaction,
      })).rejects.toThrow('TENANT_QUERY_FAILED');
      expect(port.customerRoots.getById).not.toHaveBeenCalled();
      expect(port.linkModel.create).not.toHaveBeenCalled();
    }
  });

  it('makes link ID insufficient by joining both roots beneath authority', async () => {
    const port = ports({ link: { id: 'link-a' } });
    await repository(port).getById(authority, 'link-a');
    const query = port.linkModel.findOne.mock.calls[0][0];
    expect(query.where).toEqual({ id: 'link-a' });
    expect(includeConditions(query, 0)).toEqual([{ tenant_id: 'tenant-a' }, {}]);
    expect(includeConditions(query, 1)).toEqual([{ tenant_id: 'tenant-a' }, {}]);
    expect((query.include as readonly Record<string, unknown>[]).every((item) => item.required === true))
      .toBe(true);
  });

  it('collapses a foreign and nonexistent link to the same result', async () => {
    await expect(repository(ports()).getById(authority, 'foreign-or-absent'))
      .resolves.toBeUndefined();
  });

  it('returns a fixed historical-preserving projection with both roots tenant-scoped', async () => {
    const historical = {
      id: 'link-old', customer_id: 'customer-a', aircraft_id: 'aircraft-a',
      relationship_type: 'OWNER', is_current: false, start_date: '2020-01-01',
      end_date: '2021-01-01', notes: null,
    };
    const port = ports({ links: [historical] });
    const result = await repository(port).getCustomerWithLinks(authority, 'customer-a');
    expect(result?.links).toEqual([historical]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.links)).toBe(true);
    const query = port.linkModel.findAll.mock.calls[0][0];
    expect(query.where).toEqual({ customer_id: 'customer-a' });
    expect(includeConditions(query, 0)).toEqual([{ tenant_id: 'tenant-a' }, {}]);
    expect(includeConditions(query, 1)).toEqual([{ tenant_id: 'tenant-a' }, {}]);
    expect(query).not.toHaveProperty('is_current');
  });

  it('returns no projection and performs no link query for a foreign Customer', async () => {
    const port = ports({ customer: null });
    await expect(repository(port).getCustomerWithLinks(authority, 'customer-x'))
      .resolves.toBeUndefined();
    expect(port.linkModel.findAll).not.toHaveBeenCalled();
  });

  it('keeps multi-root checks, uniqueness lookup, and create on one explicit transaction', async () => {
    const port = ports();
    await repository(port).create(authority, input, { transaction });
    expect(port.linkModel.findOne.mock.calls[0][0].transaction).toBe(transaction);
    expect(port.linkModel.create.mock.calls[0][1].transaction).toBe(transaction);
    type Options = Parameters<CustomerAircraftLinkTenantRepository['create']>[2];
    const transactionRequired: undefined extends Options ? true : false = false;
    expect(transactionRequired).toBe(false);
  });

  it('service creates then writes the canonical audit once with the same transaction and actor', async () => {
    const repo = repository(ports());
    const link = {
      id: 'link-a',
      toJSON: vi.fn().mockReturnValue({ id: 'link-a', customer_id: 'customer-a' }),
    } as never;
    const create = vi.spyOn(repo, 'create').mockResolvedValue(link);
    const audit = { log: vi.fn().mockResolvedValue({ id: 'audit-a' }) };
    const service = new CustomerAircraftLinkTenantService(repo, audit as never);
    await service.createLink(authority, input, { transaction, actorId: 'actor-a' });
    expect(create).toHaveBeenCalledWith(authority, input, { transaction });
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith({
      table_name: 'customer_aircraft_links',
      row_id: 'link-a',
      action: 'CREATE',
      reason: 'Current customer relationship added to aircraft',
      new_values: { id: 'link-a', customer_id: 'customer-a' },
      actor_id: 'actor-a',
    }, transaction);
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(audit.log.mock.invocationCallOrder[0]);
  });

  it('uses one transaction across both roots, uniqueness, insert, and audit', async () => {
    const port = ports();
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new CustomerAircraftLinkTenantService(repository(port), audit as never);
    await service.createLink(authority, input, { transaction, actorId: 'actor-a' });

    expect(port.customerRoots.getById.mock.calls[0][2].transaction).toBe(transaction);
    expect(port.aircraftRoots.resolveOwnedRoot.mock.calls[0][2].transaction).toBe(transaction);
    expect(port.linkModel.findOne.mock.calls[0][0].transaction).toBe(transaction);
    expect(port.linkModel.create.mock.calls[0][1].transaction).toBe(transaction);
    expect(audit.log.mock.calls[0][1]).toBe(transaction);
    expect(port.linkModel.create.mock.invocationCallOrder[0])
      .toBeLessThan(audit.log.mock.invocationCallOrder[0]);
  });

  it('omits an absent actor exactly like the canonical live helper', async () => {
    const repo = repository(ports());
    const link = { id: 'link-a', toJSON: () => ({ id: 'link-a' }) } as never;
    vi.spyOn(repo, 'create').mockResolvedValue(link);
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new CustomerAircraftLinkTenantService(repo, audit as never);
    await service.createLink(authority, input, { transaction });
    expect(audit.log.mock.calls[0][0]).not.toHaveProperty('actor_id');
  });

  it('does not audit when repository creation fails', async () => {
    const repo = repository(ports());
    vi.spyOn(repo, 'create').mockRejectedValue(new Error('TENANT_RESOURCE_UNAVAILABLE'));
    const audit = { log: vi.fn() };
    const service = new CustomerAircraftLinkTenantService(repo, audit as never);
    await expect(service.createLink(authority, input, { transaction }))
      .rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('propagates audit failure without retrying or reporting creation success', async () => {
    const repo = repository(ports());
    const link = { id: 'link-a', toJSON: () => ({ id: 'link-a' }) } as never;
    vi.spyOn(repo, 'create').mockResolvedValue(link);
    const audit = { log: vi.fn().mockRejectedValue(new Error('audit unavailable')) };
    const service = new CustomerAircraftLinkTenantService(repo, audit as never);
    await expect(service.createLink(authority, input, { transaction, actorId: null }))
      .rejects.toThrow('audit unavailable');
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('exposes no unlink/update/delete or arbitrary query-options surface', () => {
    const repo = repository(ports()) as unknown as Record<string, unknown>;
    expect(repo).not.toHaveProperty('update');
    expect(repo).not.toHaveProperty('delete');
    expect(repo).not.toHaveProperty('unlink');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/customers/customer-aircraft-link-tenant.repository.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/FindOptions|whereOptions|rawSql|tenant_id\s*:/);
    expect(source).not.toMatch(/\.update\s*\(|\.destroy\s*\(|customers\.tenant_id\s*=|aircraft\.tenant_id\s*=/);
  });

  it('has only approved live consumers and remains portal-separated, RBAC-free, and migration-free', () => {
    const repositorySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/customers/customer-aircraft-link-tenant.repository.ts'),
      'utf8',
    );
    const serviceSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/customers/customer-aircraft-link-tenant.service.ts'),
      'utf8',
    );
    const sources = repositorySource + serviceSource;
    expect(sources).not.toMatch(
      /database\.js|sequelize\.query|customer-portal|\bADMIN\b|\brole\b|permission|user_roles|tenant_membership_roles|AsyncLocalStorage|globalThis/,
    );
    expect(repositorySource).not.toMatch(/AuditService|auditService|\.log\s*\(/);

    const customerRoot = path.resolve(process.cwd(), 'src/modules/customers');
    const productionConsumers = fs.readdirSync(customerRoot)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .filter((name) => !name.startsWith('customer-aircraft-link-tenant.'))
      .filter((name) => fs.readFileSync(path.join(customerRoot, name), 'utf8')
        .includes('customer-aircraft-link-tenant'));
    expect(productionConsumers).toEqual(['customers.service.ts']);

    const portal = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/customer-portal/customer-portal.routes.ts'), 'utf8',
    );
    expect(portal).not.toMatch(/Customer\.findByPk|CustomerAircraftLink\.findAll|sequelize\.query/);
    expect(portal).toContain('resolveCustomerPortalAuthority');
    expect(portal).not.toContain('TenantQueryAuthority');
    const app = fs.readFileSync(path.resolve(process.cwd(), 'src/app.ts'), 'utf8');
    expect(app).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
    expect(fs.readdirSync(path.resolve(process.cwd(), 'migrations')).some((name) => name.startsWith('591_')))
      .toBe(false);
  });
});
