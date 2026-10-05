import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';

describe('membership resolver + tenant RLS', () => {
  afterAll(async () => { await sequelize.close(); });

  it('resolves the authenticated user membership without tenant context and preserves RLS', async () => {
    const db = await sequelize.query<{ name: string }>(
      'SELECT current_database() name', { type: QueryTypes.SELECT },
    );
    expect(db[0]?.name).toBe('jupiter_test');

    const ids = {
      tenant: randomUUID(),
      user: randomUUID(),
      otherUser: randomUUID(),
      membership: randomUUID(),
    };

    await expect(sequelize.transaction(async (t) => {
      const q = (sql: string, replacements: Record<string, unknown>) =>
        sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction: t });

      // users and tenants have no RLS.
      await sequelize.query(
        `INSERT INTO users(id, email, password_hash, full_name, is_active) VALUES
           (:user, :email1, 'unused', 'Resolver User', true),
           (:otherUser, :email2, 'unused', 'Other User', true)`,
        { replacements: { ...ids, email1: `resolver-${ids.user}@example.test`, email2: `resolver-${ids.otherUser}@example.test` }, transaction: t },
      );
      await sequelize.query(
        `INSERT INTO tenants(id, public_id, code, display_name, status, created_by_user_id, updated_by_user_id)
         VALUES (:tenant, :publicId, :code, 'Resolver Tenant', 'ACTIVE', :user, :user)`,
        { replacements: { ...ids, publicId: randomUUID(), code: `RES${ids.tenant.slice(0, 8).toUpperCase()}` }, transaction: t },
      );

      // tenant_memberships has FORCE RLS; set the tenant context to satisfy the predicate.
      await sequelize.query(`SELECT set_config('jupiter.tenant_id', :tenant, true)`, { replacements: { tenant: ids.tenant }, transaction: t });
      await sequelize.query(
        `INSERT INTO tenant_memberships(id, tenant_id, user_id, status, joined_at, created_by_user_id, updated_by_user_id)
         VALUES (:membership, :tenant, :user, 'ACTIVE', CURRENT_TIMESTAMP, :user, :user)`,
        { replacements: ids, transaction: t },
      );

      // 1. Resolver returns the membership regardless of the caller's tenant context.
      const resolved = await q(
        `SELECT membership_id FROM public.resolve_authenticated_memberships(:user)`,
        { user: ids.user },
      );
      expect(resolved).toHaveLength(1);
      expect((resolved[0] as { membership_id: string }).membership_id).toBe(ids.membership);

      // 2. Resolver is scoped to the passed user (another user sees nothing).
      const other = await q(
        `SELECT membership_id FROM public.resolve_authenticated_memberships(:otherUser)`,
        { otherUser: ids.otherUser },
      );
      expect(other).toHaveLength(0);

      // 3. Direct SELECT without tenant context returns no rows (RLS intact).
      await sequelize.query(`SELECT set_config('jupiter.tenant_id', '', true)`, { transaction: t });
      const noCtx = await q(
        `SELECT count(*)::int AS n FROM tenant_memberships WHERE user_id = :user`,
        { user: ids.user },
      );
      expect((noCtx[0] as { n: number }).n).toBe(0);

      // 4. Direct SELECT with tenant context returns the row (RLS isolates correctly).
      await sequelize.query(`SELECT set_config('jupiter.tenant_id', :tenant, true)`, { replacements: { tenant: ids.tenant }, transaction: t });
      const withCtx = await q(
        `SELECT count(*)::int AS n FROM tenant_memberships WHERE user_id = :user`,
        { user: ids.user },
      );
      expect((withCtx[0] as { n: number }).n).toBe(1);

      throw new Error('ROLLBACK_TEST_FIXTURES');
    })).rejects.toThrow('ROLLBACK_TEST_FIXTURES');
  });
});
