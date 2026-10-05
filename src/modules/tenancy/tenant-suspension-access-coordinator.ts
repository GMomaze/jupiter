import { TENANT_LIFECYCLE_LOCK_NAMESPACE } from './tenant-lifecycle-coordination.js';

export interface TenantAccessLockClient {
  query<Row = Record<string, unknown>>(sql: string, values: readonly unknown[]): Promise<{ rows: readonly Row[] }>;
  release(destroy?: boolean): void;
}

export interface TenantAccessLockPool {
  connect(): Promise<TenantAccessLockClient>;
}

export interface TenantAccessLease {
  release(): Promise<void>;
}

const TENANT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TenantSuspensionAccessCoordinator {
  constructor(private readonly pool: TenantAccessLockPool) {}

  async acquire(tenantId: string): Promise<TenantAccessLease> {
    if (!TENANT_UUID.test(tenantId)) throw new Error('TENANT_ACCESS_LOCK_KEY_INVALID');
    const client = await this.pool.connect();
    let acquired = false;
    try {
      await client.query(
        `SELECT pg_advisory_lock_shared(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint))`,
        [tenantId],
      );
      acquired = true;
    } catch (error) {
      client.release(true);
      throw error;
    }
    let released = false;
    return Object.freeze({
      async release() {
        if (released) return;
        released = true;
        try {
          const result = await client.query<{ released: boolean }>(
            `SELECT pg_advisory_unlock_shared(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint)) AS released`,
            [tenantId],
          );
          if (result.rows[0]?.released !== true) throw new Error('TENANT_ACCESS_UNLOCK_FAILED');
          client.release();
        } catch (error) {
          if (acquired) client.release(true);
          throw error;
        }
      },
    });
  }
}
