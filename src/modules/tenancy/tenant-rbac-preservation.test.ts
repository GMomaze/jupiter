import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');
const middleware = read('src/middleware/rbac.middleware.ts');
const auth = read('src/modules/auth/auth.config.ts');
const staff = read('src/modules/auth/staff.routes.ts');
const governance = read('src/modules/library/component-life-limit-governance.service.ts');
const associations = read('src/models/associations.ts');
const migration = read('migrations/588_create_tenant_membership_foundation.ts');

describe('MT-2 dormant RBAC preservation contract', () => {
  it('keeps existing middleware and Passport on global user/role identity', () => {
    expect(middleware).toContain('export const requirePermission');
    expect(middleware).toContain('export const requireRole');
    expect(middleware).toContain('user?.roles');
    expect(middleware).not.toMatch(/TenantMembership|activeTenant|tenantContext/);
    expect(auth).toContain('passport.serializeUser');
    expect(auth).toContain('user.id');
    expect(auth).toContain('passport.deserializeUser');
    expect(auth).not.toMatch(/TenantMembership|membership_id|activeTenant|tenantContext/);
  });

  it('keeps global user_roles for unrelated governance while staff administration is membership-local', () => {
    expect(staff).toContain('StaffTenantService');
    expect(staff).not.toContain('INSERT INTO user_roles');
    expect(staff).not.toContain('DELETE FROM user_roles');
    expect(governance).toContain('FROM user_roles ur');
    expect(governance).not.toContain('tenant_membership_roles');
    expect(associations).toContain('through: UserRole');
  });

  it('adds only dormant explicit associations and no many-to-many runtime authority', () => {
    expect(associations).toContain('Tenant.hasMany(TenantMembership');
    expect(associations).toContain('TenantMembership.belongsTo(Tenant');
    expect(associations).toContain('User.hasMany(TenantMembership');
    expect(associations).toContain('TenantMembership.hasMany(TenantMembershipRole');
    expect(associations).toContain('Role.hasMany(TenantMembershipRole');
    expect(associations).not.toContain('belongsToMany(TenantMembershipRole');
    expect(associations).not.toContain('TenantMembershipRole.belongsToMany');
  });

  it('requires no tenant or membership at login and performs no RBAC conversion', () => {
    expect(auth).not.toMatch(/tenant_id|membership_id|TenantMembership/);
    expect(migration).not.toMatch(/\bINSERT\s+INTO\b|\bUPDATE\s+user_roles\b|\bDELETE\s+FROM\s+user_roles\b/i);
    expect(migration).not.toMatch(/activeTenant|tenantContext|passport|sessions/i);
  });
});
