import type { Transaction } from 'sequelize';
import type { Pool, PoolClient } from 'pg';
import sequelize from '../../config/database.js';
import { assertTenantQueryAuthority, type TenantQueryAuthority } from './tenant-query-authority.js';

// Canonical tenant database transaction context (4.2 §4.1).
//
// Ordinary tenant-owned database work must run through one of these two
// wrappers. They require an authentic, repository-issued TenantQueryAuthority
// (never a raw/public tenant UUID), pin the database transaction/connection,
// install the transaction-local tenant context on that SAME connection, run the
// supplied work inside it, and COMMIT/ROLLBACK normally. `is_local=true` clears
// the context automatically at transaction end, so pooled connections never
// retain it.
//
// RLS is defence-in-depth beneath the existing application-level
// WHERE/EXISTS tenant predicates; these wrappers do not replace that authority.

export async function withTenantTransaction<T>(
  authority: TenantQueryAuthority,
  work: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  assertTenantQueryAuthority(authority);
  return sequelize.transaction(async (transaction) => {
    await sequelize.query(`SELECT set_config('jupiter.tenant_id', :tenantId, true)`, {
      replacements: { tenantId: authority.tenantId }, transaction,
    });
    return work(transaction);
  });
}

export async function withTenantClient<T>(
  authority: TenantQueryAuthority,
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  assertTenantQueryAuthority(authority);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      await client.query(`SELECT set_config('jupiter.tenant_id', $1, true)`, [authority.tenantId]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
  }
}
