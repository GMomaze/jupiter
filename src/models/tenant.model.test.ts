import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/models/Tenant.ts'), 'utf8');

describe('Tenant model source contract', () => {
  it('defines the exact dormant tenant schema and lifecycle values', () => {
    expect(source).toContain("tableName: 'tenants'");
    for (const field of [
      'id', 'public_id', 'code', 'display_name', 'legal_name', 'status',
      'suspension_reason', 'suspended_at', 'suspended_by_user_id', 'created_at',
      'created_by_user_id', 'updated_at', 'updated_by_user_id', 'archived_at',
    ]) expect(source).toMatch(new RegExp(`\\b${field}\\b`));
    for (const status of ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']) {
      expect(source).toContain(`'${status}'`);
    }
  });

  it('normalizes unique codes while permanently protecting only id and public_id', () => {
    expect(source).toContain('normalizeTenantCode(instance.code)');
    expect(source).toMatch(/code:[\s\S]*?unique: true/);
    expect(source).toMatch(/public_id:[\s\S]*?unique: true/);
    const updateHook = source.match(/beforeUpdate\(instance\) \{([\s\S]*?)\n      \},/)?.[1] ?? '';
    expect(updateHook).toContain("instance.changed('id')");
    expect(updateHook).toContain("instance.changed('public_id')");
    expect(updateHook).not.toContain("instance.changed('code')");
  });

  it('contains lifecycle validation but no scope, association, auth, session, or customer inference', () => {
    expect(source).toContain('lifecycleMetadata');
    expect(source).not.toMatch(/defaultScope|addScope|belongsTo|hasMany/);
    expect(source).not.toMatch(/\bsession\b|passport|\bcustomer_id\b|\btenant_id\b/i);
  });
});
