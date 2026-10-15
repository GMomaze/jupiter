import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { QueryTypes, Transaction } from 'sequelize';
import pg from 'pg';
import sequelize from '../../config/database.js';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { platformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { TenantLifecycleCommandRepository } from './tenant-lifecycle-command.repository.js';

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

async function insertUser(transaction: Transaction, id: string, label: string): Promise<void> {
  await sequelize.query(
    `INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES(:id,:email,'unused',:label,true)`,
    { replacements: { id, email: `${label}-${id}@example.test`, label }, transaction },
  );
}

async function insertTenant(
  transaction: Transaction, id: string, label: string, actorUserId: string, status = 'PROVISIONING',
): Promise<string> {
  const publicId = randomUUID();
  await sequelize.query(
    `INSERT INTO tenants(id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id)
     VALUES(:id,:publicId,:code,:label,:status,:actorUserId,:actorUserId)`,
    {
      replacements: { id, publicId, code: `T${id.replace(/-/g, '').toUpperCase()}`, label, status, actorUserId },
      transaction,
    },
  );
  return publicId;
}

async function addMembershipRole(
  transaction: Transaction, tenantId: string, userId: string,
  membershipStatus: 'ACTIVE' | 'INVITED', roleCode: string, revoke = false,
): Promise<void> {
  await sequelize.query(`SELECT set_config('jupiter.tenant_id', :tenantId, true)`, {
    replacements: { tenantId }, transaction,
  });
  const membershipId = randomUUID();
  await sequelize.query(
    `INSERT INTO tenant_memberships(id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id)
     VALUES(:id,:tenantId,:userId,:status,
            CASE WHEN :status = 'ACTIVE' THEN CURRENT_TIMESTAMP ELSE NULL END,:userId,:userId)`,
    { replacements: { id: membershipId, tenantId, userId, status: membershipStatus }, transaction },
  );
  const roleId = randomUUID();
  await sequelize.query(
    `INSERT INTO tenant_membership_roles(id,membership_id,role_id,assigned_by_user_id)
     SELECT :id, :membershipId, r.id, :userId FROM rf_role r WHERE r.code = :roleCode`,
    { replacements: { id: roleId, membershipId, userId, roleCode }, transaction },
  );
  if (revoke) {
    await sequelize.query(
      `UPDATE tenant_membership_roles SET revoked_at=CURRENT_TIMESTAMP,revoked_by_user_id=:userId,revocation_reason='test revoke' WHERE id=:roleId`,
      { replacements: { roleId, userId }, transaction },
    );
  }
}

function buildEvidence(ids: { principal: string; user: string }, operation: 'TENANT_ACTIVATE') {
  const resolver = new PlatformAuthorityRepository({ query: async () => ({
    rows: [{ id: ids.principal, principal_type: 'HUMAN', principal_code: ids.user, capabilities: [operation] }], rowCount: 1,
  }) } as any);
  return async (reason: string) => {
    const authority = (await resolver.resolveHuman(ids.user))!;
    return platformMutationEvidence(authority, [operation], {
      reason, correlationId: randomUUID(), source: { kind: 'GUARDED_JUP_008_TEST' }, resourceType: 'tenant',
    });
  };
}


describe('activation active-admin check (adminPool)', () => {
  afterAll(async () => { await sequelize.close(); });

  async function cleanup(tenantId: string, adminId: string): Promise<void> {
    await withOwner(async (c) => {
      await c.query('ALTER TABLE public.tenants DISABLE TRIGGER tr_tenants_delete_prohibited');
      await c.query('ALTER TABLE public.platform_global_audit_log DISABLE TRIGGER tr_platform_global_audit_immutable');
      try {
        await c.query('DELETE FROM platform_global_audit_log WHERE resource_id=$1', [tenantId]);
        await c.query('DELETE FROM tenant_membership_roles WHERE membership_id IN (SELECT id FROM tenant_memberships WHERE tenant_id=$1)', [tenantId]);
        await c.query('DELETE FROM tenant_memberships WHERE tenant_id=$1', [tenantId]);
        await c.query('DELETE FROM tenants WHERE id=$1', [tenantId]);
        await c.query('DELETE FROM users WHERE id=$1', [adminId]);
      } finally {
        await c.query('ALTER TABLE public.platform_global_audit_log ENABLE TRIGGER tr_platform_global_audit_immutable');
        await c.query('ALTER TABLE public.tenants ENABLE TRIGGER tr_tenants_delete_prohibited');
      }
    });
  }

  it('permits activation with an ACTIVE unrevoked ADMIN and denies it otherwise', async () => {
    expect((await sequelize.query<{ name: string }>('SELECT current_database() name', { type: QueryTypes.SELECT }))[0]?.name).toBe('jupiter_test');
    const ids = { user: randomUUID(), principal: randomUUID() };

    await sequelize.transaction(async (transaction) => {
      await insertUser(transaction, ids.user, 'actor');
      await sequelize.query(
        `INSERT INTO platform_principals(id,principal_type,user_id,display_name,status) VALUES(:principal,'HUMAN',:user,'Actor','ACTIVE')`,
        { replacements: ids, transaction },
      );
      await sequelize.query(
        `INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason)
         SELECT gen_random_uuid(),:principal,id,:principal,'JUP-008 test' FROM platform_capabilities WHERE code='TENANT_ACTIVATE'`,
        { replacements: { principal: ids.principal }, transaction },
      );
    });

    const evidence = buildEvidence(ids, 'TENANT_ACTIVATE');
    const repository = new TenantLifecycleCommandRepository();

    async function runCase(label: string, status: 'ACTIVE' | 'INVITED', revoke: boolean, shouldSucceed: boolean): Promise<void> {
      const tenantId = randomUUID();
      const adminId = randomUUID();
      await sequelize.transaction(async (transaction) => {
        await insertUser(transaction, adminId, `admin-${label}`);
        await insertTenant(transaction, tenantId, label, adminId);
        await addMembershipRole(transaction, tenantId, adminId, status, 'ADMIN', revoke);
      });
      const [row] = await sequelize.query<{ public_id: string }>(
        `SELECT public_id FROM tenants WHERE id=:id`, { replacements: { id: tenantId }, type: QueryTypes.SELECT },
      );
      const promise = repository.activate(await evidence(`Activate ${label}`), row.public_id);
      if (shouldSucceed) {
        await expect(promise).resolves.toMatchObject({ status: 'ACTIVE' });
      } else {
        await expect(promise).rejects.toThrow('TENANT_LIFECYCLE_COMMAND_UNAVAILABLE');
      }
      await cleanup(tenantId, adminId);
    }

    await runCase('active-admin', 'ACTIVE', false, true);
    await runCase('invited', 'INVITED', false, false);
    await runCase('revoked', 'ACTIVE', true, false);

    await withOwner(async (c) => {
      await c.query('DELETE FROM platform_capability_grants WHERE principal_id=$1', [ids.principal]);
      await c.query('DELETE FROM platform_principals WHERE id=$1', [ids.principal]);
      await c.query('DELETE FROM users WHERE id=$1', [ids.user]);
    });
  });

  it('preserves the privilege model: no runtime SELECT on role assignments and no privileged function', () => {
    const baseline = readFileSync(resolve(process.cwd(), 'src/config/databasePrivilegeBaseline.ts'), 'utf8');
    expect(baseline).toContain("['tenant_membership_roles', ['INSERT', 'UPDATE']]");
    expect(baseline).not.toContain("['tenant_membership_roles', ['SELECT'");

    const repository = readFileSync(resolve(process.cwd(), 'src/modules/tenancy/tenant-lifecycle-command.repository.ts'), 'utf8');
    expect(repository).toContain('adminPool');
    expect(repository).not.toMatch(/GRANT\s+SELECT\s+ON\s+TABLE/i);
  });
});
