import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/models/TenantMembershipRole.ts'), 'utf8');

describe('TenantMembershipRole dormant model source contract', () => {
  it('defines the exact assignment and revocation fields', () => {
    expect(source).toContain("tableName: 'tenant_membership_roles'");
    for (const field of [
      'id', 'membership_id', 'role_id', 'assigned_at', 'assigned_by_user_id',
      'revoked_at', 'revoked_by_user_id', 'revocation_reason', 'created_at', 'updated_at',
    ]) expect(source).toMatch(new RegExp(`\\b${field}\\b`));
  });

  it('validates complete, nonblank, chronological revocation evidence', () => {
    expect(source).toContain('revocation(this: TenantMembershipRole)');
    expect(source).toContain('this.revocation_reason?.trim()');
    expect(source).toContain('TENANT_MEMBERSHIP_ROLE_REVOCATION_INCOMPLETE');
    expect(source).toContain('this.revoked_at < this.assigned_at');
  });

  it('protects assignment identity and freezes a revoked historical row', () => {
    const hook = source.match(/beforeUpdate\(instance\) \{([\s\S]*?)\n      \},/)?.[1] ?? '';
    for (const field of ['id', 'membership_id', 'role_id', 'assigned_at', 'assigned_by_user_id']) {
      expect(hook).toContain(`'${field}'`);
    }
    expect(hook).toContain("previous('revoked_at')");
    expect(hook).toContain('TENANT_MEMBERSHIP_ROLE_HISTORY_IMMUTABLE');
  });

  it('contains no authorization lookup or belongsToMany shortcut', () => {
    expect(source).not.toMatch(/requirePermission|requireRole|belongsToMany|defaultScope|passport|session/i);
  });
});
