import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(process.cwd(), 'migrations/588_create_tenant_membership_foundation.ts');
const source = fs.readFileSync(migrationPath, 'utf8');

describe('migration 588 dormant tenant membership source contract', () => {
  it('proves prerequisites and creates the two exact tables atomically', () => {
    expect(path.basename(migrationPath)).toBe('588_create_tenant_membership_foundation.ts');
    for (const table of ['tenants', 'users', 'rf_role']) expect(source).toContain(`'${table}'`);
    expect(source).toContain("const MEMBERSHIPS = 'tenant_memberships'");
    expect(source).toContain("const MEMBERSHIP_ROLES = 'tenant_membership_roles'");
    expect(source).toContain('sequelize.transaction');
  });

  it('enforces membership FKs, uniqueness, lifecycle, dates, indexes, and identity', () => {
    expect(source).toContain('tenant_memberships_tenant_user_unique UNIQUE (tenant_id, user_id)');
    expect(source).toContain("CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED'))");
    expect(source).toContain('tenant_memberships_lifecycle_check');
    expect(source).toContain("btrim(status_reason) <> ''");
    for (const check of ['joined_date', 'suspended_date', 'disabled_date', 'disabled_joined_date']) {
      expect(source).toContain(`tenant_memberships_${check}_check`);
    }
    expect(source).toContain('(tenant_id, status)');
    expect(source).toContain('(user_id, status)');
    expect(source).toContain('fn_tenant_memberships_preserve_identity');
    for (const field of ['id', 'tenant_id', 'user_id']) expect(source).toContain(`NEW.${field} IS DISTINCT FROM OLD.${field}`);
  });

  it('enforces role FKs, partial active uniqueness, revocation shape, and history', () => {
    expect(source).toContain('tenant_membership_roles_revocation_shape_check');
    expect(source).toContain('tenant_membership_roles_revocation_date_check');
    expect(source).toMatch(/CREATE UNIQUE INDEX tenant_membership_roles_active_unique[\s\S]*?WHERE revoked_at IS NULL/);
    expect(source).toContain('fn_tenant_membership_roles_preserve_history');
    expect(source).toContain('OLD.revoked_at IS NOT NULL AND NEW IS DISTINCT FROM OLD');
    expect((source.match(/onUpdate: 'RESTRICT'/g) ?? [])).toHaveLength(10);
    expect((source.match(/onDelete: 'RESTRICT'/g) ?? [])).toHaveLength(10);
  });

  it('is data-empty and does not convert RBAC, tenantize operations, grant, or enable RLS', () => {
    expect(source).not.toMatch(/\bINSERT\s+INTO\b|\bUPDATE\s+user_roles\b|\bDELETE\s+FROM\s+user_roles\b/i);
    expect(source).not.toMatch(/\bGRANT\b|\bCREATE\s+POLICY\b|\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i);
    expect(source).not.toMatch(/customers|aircraft|serialized_components|workpacks|compliance/i);
  });

  it('down removes only MT-2 objects in dependency order', () => {
    const down = source.slice(source.indexOf('async down'));
    const orderedOperations = [
      'tr_tenant_membership_roles_preserve_history',
      'dropTable(MEMBERSHIP_ROLES',
      'fn_tenant_membership_roles_preserve_history',
      'tr_tenant_memberships_preserve_identity',
      'dropTable(MEMBERSHIPS',
      'fn_tenant_memberships_preserve_identity',
    ].map(operation => down.indexOf(operation));
    expect(orderedOperations.every(position => position >= 0)).toBe(true);
    expect(orderedOperations).toEqual([...orderedOperations].sort((left, right) => left - right));
    expect(down).not.toMatch(/dropTable\(['"](?:users|tenants|rf_role|user_roles)/);
  });

  it('resolves DOWN existence state before transactional DDL and never escapes its transaction', () => {
    const down = source.slice(source.indexOf('async down'));
    const transactionStart = down.indexOf('await queryInterface.sequelize.transaction');
    const preTransaction = down.slice(0, transactionStart);
    const transactionBody = down.slice(transactionStart);

    expect(preTransaction).toContain('tableExists(queryInterface, MEMBERSHIP_ROLES)');
    expect(preTransaction).toContain('tableExists(queryInterface, MEMBERSHIPS)');
    expect(transactionBody).not.toMatch(/tableExists\(|describeTable\(/);
    expect((transactionBody.match(/\{ transaction \}/g) ?? [])).toHaveLength(6);
    expect(transactionBody).not.toMatch(/SequelizeMeta|INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+/i);
  });
});
