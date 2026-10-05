import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(file), 'utf8');

describe('MT-4C7A mounted audit boundary', () => {
  it('preserves permissions and tenant-gates list and export', () => {
    const routes = read('src/modules/audit/audit.routes.ts');
    const app = read('src/app.ts');

    expect(routes).toMatch(/requirePermission\('AUDIT_VIEW'\),\s*requireValidActiveTenantContext/);
    expect(routes).toMatch(/requirePermission\('AUDIT_EXPORT'\),\s*requireValidActiveTenantContext/);
    expect(routes.match(/assertTenantQueryAuthority\(req\.tenantAuthority\)/g)).toHaveLength(2);
    expect(routes.match(/AuditService\.getLogs\(/g)).toHaveLength(2);
    expect(app).toContain('createAuditRouter(requireValidActiveTenantContext)');
  });

  it('implements only the eight server-owned mappings and default-denies all others', () => {
    const repository = read('src/modules/audit/audit-tenant.repository.live.ts');
    for (const source of [
      'aircraft', 'customers', 'workpacks', 'task_cards', 'workpack_snags',
      'aircraft_compliance', 'utilisation_events', 'customer_aircraft_links',
    ]) {
      expect(repository).toContain(`WHEN '${source}'`);
    }
    expect(repository).toContain('ELSE FALSE');
    expect(repository).not.toMatch(/(?:old_values|new_values)\s*->/i);
    expect(repository).toContain('ORDER BY audit.created_at DESC');
    expect(repository).toContain('LIMIT 100');
  });

  it('enforces special TaskCard, snag, and customer-aircraft-link rules', () => {
    const repository = read('src/modules/audit/audit-tenant.repository.live.ts');

    expect(repository).toMatch(/WHEN 'task_cards'[\s\S]*EXISTS[\s\S]*workpack_tasks current_link[\s\S]*tenant_id = :tenantId[\s\S]*AND NOT EXISTS[\s\S]*workpack_tasks foreign_link[\s\S]*tenant_id <> :tenantId/);
    expect(repository).toMatch(/WHEN 'workpack_snags'[\s\S]*snag\.workpack_id IS NOT NULL[\s\S]*FROM workpacks owned_workpack[\s\S]*FROM aircraft owned_aircraft[\s\S]*snag\.workpack_id IS NULL/);
    expect(repository).toMatch(/WHEN 'customer_aircraft_links'[\s\S]*JOIN customers owned_customer[\s\S]*JOIN aircraft owned_aircraft[\s\S]*owned_customer\.tenant_id = :tenantId[\s\S]*owned_aircraft\.tenant_id = :tenantId/);
  });
});
