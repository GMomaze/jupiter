import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/models/TenantMembership.ts'), 'utf8');

describe('TenantMembership dormant model source contract', () => {
  it('defines the exact fields, status vocabulary, and timestamps', () => {
    expect(source).toContain("tableName: 'tenant_memberships'");
    for (const field of [
      'id', 'tenant_id', 'user_id', 'status', 'joined_at', 'suspended_at',
      'suspended_by_user_id', 'disabled_at', 'disabled_by_user_id', 'status_reason',
      'created_at', 'created_by_user_id', 'updated_at', 'updated_by_user_id',
    ]) expect(source).toMatch(new RegExp(`\\b${field}\\b`));
    for (const status of ['INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED']) {
      expect(source).toContain(`'${status}'`);
    }
    expect(source).toContain("createdAt: 'created_at'");
    expect(source).toContain("updatedAt: 'updated_at'");
  });

  it('enforces lifecycle/date validation and protects only membership identity', () => {
    expect(source).toContain('lifecycle(this: TenantMembership)');
    for (const status of ['INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED']) {
      expect(source).toContain(`this.status === '${status}'`);
    }
    expect(source).toContain('TENANT_MEMBERSHIP_JOINED_DATE_INVALID');
    expect(source).toContain('TENANT_MEMBERSHIP_SUSPENDED_DATE_INVALID');
    expect(source).toContain('TENANT_MEMBERSHIP_DISABLED_DATE_INVALID');
    const hook = source.match(/beforeUpdate\(instance\) \{([\s\S]*?)\n      \},/)?.[1] ?? '';
    for (const field of ['id', 'tenant_id', 'user_id']) expect(hook).toContain(`changed('${field}')`);
    expect(hook).not.toContain("changed('status')");
  });

  it('contains no runtime tenant scope or authorization behavior', () => {
    expect(source).not.toMatch(/defaultScope|addScope|requirePermission|requireRole|passport|session/i);
  });
});
