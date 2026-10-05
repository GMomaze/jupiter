import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { pool } from '../../config/database.js';
import { TENANT_LIFECYCLE_LOCK_NAMESPACE } from './tenant-lifecycle-coordination.js';

describe('L3-3 guarded suspension/access coordination', () => {
  afterAll(async () => { await pool.end(); });

  it('allows unrelated tenant access while another tenant lifecycle key is held exclusively', async () => {
    expect((await pool.query('SELECT current_database() name')).rows[0]?.name).toBe('jupiter_test');
    const lifecycleTenantId = randomUUID();
    const otherTenantId = randomUUID();
    const lifecycle = await pool.connect();
    const access = await pool.connect();
    try {
      await lifecycle.query(`SELECT pg_advisory_lock(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint))`, [lifecycleTenantId]);
      const unrelated = await access.query(`SELECT pg_try_advisory_lock_shared(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint)) acquired`, [otherTenantId]);
      expect(unrelated.rows[0]?.acquired).toBe(true);
      expect((await access.query(`SELECT pg_advisory_unlock_shared(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint)) released`, [otherTenantId])).rows[0]?.released).toBe(true);
      expect((await lifecycle.query(`SELECT pg_advisory_unlock(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint)) released`, [lifecycleTenantId])).rows[0]?.released).toBe(true);
    } finally {
      lifecycle.release(true);
      access.release(true);
    }
  });

  it('uses conflicting shared/exclusive locks on exact jupiter_test with no durable residue', async () => {
    expect((await pool.query('SELECT current_database() name')).rows[0]?.name).toBe('jupiter_test');
    const tenantId = randomUUID();
    const access = await pool.connect();
    const lifecycle = await pool.connect();
    try {
      await access.query(`SELECT pg_advisory_lock_shared(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint))`, [tenantId]);
      const blocked = await lifecycle.query(`SELECT pg_try_advisory_lock(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint)) acquired`, [tenantId]);
      expect(blocked.rows[0]?.acquired).toBe(false);
      expect((await access.query(`SELECT pg_advisory_unlock_shared(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint)) released`, [tenantId])).rows[0]?.released).toBe(true);
      const acquired = await lifecycle.query(`SELECT pg_try_advisory_lock(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint)) acquired`, [tenantId]);
      expect(acquired.rows[0]?.acquired).toBe(true);
      expect((await lifecycle.query(`SELECT pg_advisory_unlock(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint)) released`, [tenantId])).rows[0]?.released).toBe(true);
    } finally {
      access.release(true);
      lifecycle.release(true);
    }
    const state = await pool.query(`SELECT
      (SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1) ledger_head,
      (SELECT count(*)::int FROM platform_capabilities WHERE code LIKE 'TENANT_%' AND is_active AND system_locked) lifecycle_capabilities,
      EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND granted AND pid=pg_backend_pid()) local_advisory_lock`);
    expect(state.rows[0]).toEqual({ ledger_head: '601_create_tenant_lifecycle_foundation.ts', lifecycle_capabilities: 4, local_advisory_lock: false });
  });
});
