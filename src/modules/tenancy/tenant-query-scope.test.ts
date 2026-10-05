import fs from 'node:fs';
import path from 'node:path';
import { Op } from 'sequelize';
import { describe, expect, it } from 'vitest';
import { createTenantQueryAuthority } from './tenant-query-authority.js';
import {
  aircraftTenantWhere,
  customerTenantWhere,
  planningSessionTenantWhere,
  serializedComponentTenantWhere,
  workpackTenantWhere,
} from './tenant-query-scope.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-1', publicId: 'public-1', code: 'TENANT_1', displayName: 'Tenant 1', status: 'ACTIVE' },
  membership: { id: 'membership-1', tenantId: 'tenant-1', userId: 'user-1', status: 'ACTIVE' },
  validatedAt: 1,
});

const read = (relative: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');

describe('tenant root query scopes', () => {
  it.each([
    ['aircraft', aircraftTenantWhere, 'tenant_id'],
    ['customer', customerTenantWhere, 'tenant_id'],
    ['serialized component', serializedComponentTenantWhere, 'custodian_tenant_id'],
    ['planning session', planningSessionTenantWhere, 'tenant_id'],
    ['workpack', workpackTenantWhere, 'tenant_id'],
  ] as const)('scopes %s with the exact ownership column', (_name, scope, column) => {
    const business = Object.freeze({ id: 'record-1' });
    const where = scope(authority, business);
    const conditions = where[Op.and] as readonly Record<string, unknown>[];

    expect(Object.isFrozen(where)).toBe(true);
    expect(Object.isFrozen(conditions)).toBe(true);
    expect(conditions).toHaveLength(2);
    expect(conditions[0]).toEqual({ [column]: 'tenant-1' });
    expect(conditions[1]).toBe(business);
  });

  it('combines direct ID and ownership in one outer AND scope', () => {
    const where = aircraftTenantWhere(authority, { id: 'aircraft-1' });
    expect(where[Op.and]).toEqual([
      { tenant_id: 'tenant-1' },
      { id: 'aircraft-1' },
    ]);
  });

  it('contains business OR predicates beneath immutable ownership', () => {
    const business = {
      [Op.or]: [{ registration: 'A' }, { registration: 'B' }],
    };
    const where = aircraftTenantWhere(authority, business);
    const conditions = where[Op.and] as readonly Record<PropertyKey, unknown>[];
    expect(conditions[0]).toEqual({ tenant_id: 'tenant-1' });
    expect(conditions[1]).toBe(business);
  });

  it('does not allow a business ownership predicate to overwrite authority', () => {
    const where = serializedComponentTenantWhere(authority, {
      custodian_tenant_id: 'foreign-tenant',
    });
    expect(where[Op.and]).toEqual([
      { custodian_tenant_id: 'tenant-1' },
      { custodian_tenant_id: 'foreign-tenant' },
    ]);
  });

  it('fails closed without authority', () => {
    expect(() => aircraftTenantWhere(undefined as never, { id: 'aircraft-1' })).toThrow(
      'TENANT_AUTHORITY_REQUIRED',
    );
  });

  it('exports exactly five explicit scopes and no arbitrary column helper', async () => {
    const exports = await import('./tenant-query-scope.js');
    const functions = Object.entries(exports)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name)
      .sort();
    expect(functions).toEqual([
      'aircraftTenantWhere',
      'customerTenantWhere',
      'planningSessionTenantWhere',
      'serializedComponentTenantWhere',
      'workpackTenantWhere',
    ]);

    const source = read('src/modules/tenancy/tenant-query-scope.ts');
    expect(source).not.toMatch(/export\s+(?:function|const)\s+.*(?:column|root)/i);
    expect(source).not.toMatch(/tenant_id:\s*authority\.tenantId,\s*\.\.\.|\.\.\.[^\n]*,\s*tenant_id:/);
  });
});
