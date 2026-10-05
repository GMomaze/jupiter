export interface TenantLifecycleLockExecutor {
  query(sql: string, options: { replacements: { tenantId: string } }): Promise<unknown>;
}

const TENANT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const TENANT_LIFECYCLE_LOCK_NAMESPACE = '7290185754895614303';

function assertTenantId(tenantId: string): void {
  if (!TENANT_UUID.test(tenantId)) throw new Error('TENANT_LIFECYCLE_LOCK_KEY_INVALID');
}

export async function acquireTenantWorkLock(
  executor: TenantLifecycleLockExecutor,
  tenantId: string,
): Promise<void> {
  assertTenantId(tenantId);
  await executor.query(
    `SELECT pg_advisory_xact_lock_shared(hashtextextended(:tenantId::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint))`,
    { replacements: { tenantId } },
  );
}

export async function acquireTenantLifecycleLock(
  executor: TenantLifecycleLockExecutor,
  tenantId: string,
): Promise<void> {
  assertTenantId(tenantId);
  await executor.query(
    `SELECT pg_advisory_xact_lock(hashtextextended(:tenantId::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint))`,
    { replacements: { tenantId } },
  );
}
