import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Transaction } from 'sequelize';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import { requireDatabaseTestExecutionApproval } from '../../config/databaseTestExecutionSafety.js';
import { Tenant, User, sequelize } from '../../models/index.js';
import { customerTenantRepository } from '../customers/customer-tenant.repository.live.js';
import { createTenantQueryAuthority } from './tenant-query-authority.js';

let transaction: Transaction;
let beforeTotals: unknown;

async function totals() {
  const [rows] = await sequelize.query(
    'SELECT (SELECT count(*)::int FROM tenants) tenants, (SELECT count(*)::int FROM users) users, (SELECT count(*)::int FROM customers) customers',
  );
  return rows[0];
}

describe('Level 1 guarded Customer authority activation boundary', () => {
  beforeAll(async () => {
    requireDatabaseTestExecutionApproval(process.env);
    await assertTestDatabaseSafety(pool);
    beforeTotals = await totals();
    transaction = await sequelize.transaction();
  });

  afterAll(async () => {
    if (transaction) await transaction.rollback();
    expect(await totals()).toEqual(beforeTotals);
  });

  it('keeps representative Customer reads and writes tenant-local', async () => {
    const suffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
    const user = await User.create({
      email: `level1-${suffix}@example.test`, password_hash: 'test',
      full_name: `Level 1 ${suffix}`, is_active: true,
    }, { transaction });
    const tenantA = await Tenant.create({
      code: `L1A_${suffix}`, display_name: `Level 1 A ${suffix}`, status: 'ACTIVE',
      created_by_user_id: user.id, updated_by_user_id: user.id,
    }, { transaction });
    const tenantB = await Tenant.create({
      code: `L1B_${suffix}`, display_name: `Level 1 B ${suffix}`, status: 'ACTIVE',
      created_by_user_id: user.id, updated_by_user_id: user.id,
    }, { transaction });
    const authority = (tenant: Tenant) => createTenantQueryAuthority({
      state: 'VALID_ACTIVE_TENANT',
      tenant: { id: tenant.id, publicId: tenant.public_id, code: tenant.code, displayName: tenant.display_name, status: 'ACTIVE' },
      membership: { id: randomUUID(), tenantId: tenant.id, userId: user.id, status: 'ACTIVE' },
      validatedAt: Date.now(),
    });
    const authorityA = authority(tenantA);
    const authorityB = authority(tenantB);
    const input = (label: string) => ({
      name: `Customer ${label} ${suffix}`, contact_person: 'Contact',
      email: `${label.toLowerCase()}-${suffix}@example.test`, phone: '1', status: 'ACTIVE' as const,
    });
    const customerA = await customerTenantRepository.create(authorityA, input('A'), { transaction });
    const customerB = await customerTenantRepository.create(authorityB, input('B'), { transaction });

    expect((await customerTenantRepository.list(authorityA, {}, { transaction })).map(row => row.id)).toContain(customerA.id);
    expect((await customerTenantRepository.list(authorityA, {}, { transaction })).map(row => row.id)).not.toContain(customerB.id);
    expect(await customerTenantRepository.getById(authorityA, customerB.id, { transaction })).toBeUndefined();
    expect(await customerTenantRepository.updateById(authorityA, customerB.id, { notes: 'foreign' }, { transaction })).toEqual({ outcome: 'UNAVAILABLE' });
  });
});
