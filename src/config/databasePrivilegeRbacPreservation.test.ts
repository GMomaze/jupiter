import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDatabasePrivilegeBaselineSql } from './databasePrivilegeBaseline.js';

const read = (path: string) => readFileSync(path, 'utf8');

describe('database baseline preserves application RBAC', () => {
  it('does not encode users, application roles, or permission decisions in SQL', () => {
    const sql = buildDatabasePrivilegeBaselineSql();
    for (const applicationRole of ['ADMIN', 'ENGINEER', 'MECHANIC', 'PLANNER', 'VIEWER']) {
      expect(sql).not.toContain(applicationRole);
    }
    for (const permissionFamily of ['LIBRARY_', 'AIRCRAFT_', 'WORKPACK_', 'AUDIT_VIEW', 'AD_COMPLIANCE_']) {
      expect(sql).not.toContain(permissionFamily);
    }
    expect(sql).not.toMatch(/SET ROLE/i);
  });

  it('retains the application authorization middleware contract', () => {
    const middleware = read('src/middleware/rbac.middleware.ts');
    expect(middleware).toContain('export const requirePermission');
    expect(middleware).toContain('export const requireRole');
    expect(middleware).toContain('export const requireAnyRole');
    expect(middleware).toContain('export const requireAnyPermission');
  });

  it('retains representative authorization gates in completed domains', () => {
    const library = read('src/modules/library/library.routes.ts');
    const aircraft = read('src/modules/aircraft/aircraft.routes.ts');
    const workpacks = read('src/modules/workpacks/workpack.routes.ts');
    const audit = read('src/modules/audit/audit.routes.ts');

    expect(library).toContain('router.use(ensureAuthenticated)');
    expect(library).toContain("requirePermission('LIBRARY_EDIT')");
    expect(library).toContain("requirePermission('AD_APPLICABILITY_REVIEW_VIEW')");
    expect(aircraft).toContain("requirePermission('AD_COMPLIANCE_ASSIGN_CREATE')");
    expect(aircraft).toContain("requireRole('ADMIN')");
    expect(workpacks).toContain("requireRole('PLANNER')");
    expect(workpacks).toContain("requireRole('MECHANIC')");
    expect(workpacks).toContain("requireRole('ENGINEER')");
    expect(audit).toContain("requirePermission('AUDIT_VIEW')");
  });

  it('keeps identity and permission tables usable without ownership or DDL', () => {
    const sql = buildDatabasePrivilegeBaselineSql();
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES');
    expect(sql).not.toMatch(/OWNER TO jupiter_(app|test)/);
    expect(sql).not.toMatch(/GRANT (CREATE|TRUNCATE|TRIGGER|REFERENCES)/);
  });
});
