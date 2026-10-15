import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { QueryTypes } from 'sequelize';
import pg from 'pg';
import sequelize from '../../config/database.js';

async function withOwner<T>(work: (c: pg.Client) => Promise<T>): Promise<T> {
  const { config } = await import('dotenv');
  config({ path: '.env.test', override: true, quiet: true });
  const c = new pg.Client({
    host: process.env.DB_MIGRATION_HOST,
    port: Number(process.env.DB_MIGRATION_PORT ?? '5432'),
    database: process.env.DB_MIGRATION_NAME,
    user: process.env.DB_MIGRATION_USER,
    password: process.env.DB_MIGRATION_PASSWORD,
  });
  await c.connect();
  try { return await work(c); } finally { await c.end(); }
}

describe('migration 625 membership role resolver', () => {
  afterAll(async () => { await sequelize.close(); });

  it('is a SECURITY DEFINER function owned by postgres with restricted EXECUTE', async () => {
    const [row] = await sequelize.query<{
      fn_exists: boolean;
      owner: string;
      security_definer: boolean;
      app_execute: boolean;
      test_execute: boolean;
    }>(
      `SELECT
         to_regprocedure('public.resolve_authenticated_membership_roles(uuid, uuid, uuid)') IS NOT NULL AS fn_exists,
         r.rolname AS owner,
         p.prosecdef AS security_definer,
         has_function_privilege('jupiter_app', 'public.resolve_authenticated_membership_roles(uuid, uuid, uuid)', 'EXECUTE') AS app_execute,
         has_function_privilege('jupiter_test', 'public.resolve_authenticated_membership_roles(uuid, uuid, uuid)', 'EXECUTE') AS test_execute
       FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
       WHERE p.oid = to_regprocedure('public.resolve_authenticated_membership_roles(uuid, uuid, uuid)')`,
      { type: QueryTypes.SELECT },
    );
    expect(row).toMatchObject({
      fn_exists: true,
      owner: 'postgres',
      security_definer: true,
      app_execute: true,
      test_execute: true,
    });
  });

  it('returns the authenticated membership roles and permissions', async () => {
    const userId = randomUUID();
    const tenantId = randomUUID();
    const membershipId = randomUUID();
    await withOwner(async (c) => {
      await c.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES($1,$2,'unused','Admin',true)`, [userId, `r-${userId}@example.test`]);
      await c.query(`INSERT INTO tenants(id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,'Tenant','ACTIVE',$4,$4)`, [tenantId, randomUUID(), `T${tenantId.replace(/-/g, '').toUpperCase()}`, userId]);
      await c.query(`INSERT INTO tenant_memberships(id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,'ACTIVE',CURRENT_TIMESTAMP,$3,$3)`, [membershipId, tenantId, userId]);
      await c.query(`INSERT INTO tenant_membership_roles(id,membership_id,role_id,assigned_by_user_id) SELECT $1,$2,id,$3 FROM rf_role WHERE code='ADMIN'`, [randomUUID(), membershipId, userId]);

      const result = await c.query(
        `SELECT role_code, permissions FROM public.resolve_authenticated_membership_roles($1, $2, $3)`,
        [userId, membershipId, tenantId],
      );
      expect(result.rows.map((r) => r.role_code)).toContain('ADMIN');
      expect(result.rows.every((r) => Array.isArray(r.permissions))).toBe(true);

      // Foreign tenant returns no rows.
      const foreign = await c.query(
        `SELECT role_code FROM public.resolve_authenticated_membership_roles($1, $2, $3)`,
        [userId, membershipId, randomUUID()],
      );
      expect(foreign.rows).toEqual([]);

      // Cleanup.
      await c.query('ALTER TABLE public.tenants DISABLE TRIGGER tr_tenants_delete_prohibited');
      await c.query('DELETE FROM tenant_membership_roles WHERE membership_id=$1', [membershipId]);
      await c.query('DELETE FROM tenant_memberships WHERE id=$1', [membershipId]);
      await c.query('DELETE FROM tenants WHERE id=$1', [tenantId]);
      await c.query('DELETE FROM users WHERE id=$1', [userId]);
      await c.query('ALTER TABLE public.tenants ENABLE TRIGGER tr_tenants_delete_prohibited');
    });
  });

  it('does not grant jupiter_app SELECT on role assignments', () => {
    const migration = readFileSync(resolve(process.cwd(), 'migrations/625_create_membership_role_resolver_function.ts'), 'utf8');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION');
    expect(migration).not.toMatch(/GRANT\s+SELECT\s+ON\s+TABLE/i);
    const middleware = readFileSync(resolve(process.cwd(), 'src/modules/auth/active-tenant-rbac.middleware.ts'), 'utf8');
    expect(middleware).toContain('resolve_authenticated_membership_roles');
    expect(middleware).not.toMatch(/FROM\s+tenant_membership_roles/i);
  });
});
