import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(import.meta.dirname, '../..');
const readSource = (path: string) => readFileSync(resolve(sourceRoot, path), 'utf8');

describe('PlanningSession and Workpack creation authority', () => {
  const controller = readSource('modules/workpacks/workpack.controller.ts');
  const planning = readSource('modules/workpacks/services/planning-session.service.ts');
  const lifecycle = readSource('modules/workpacks/services/workpack-lifecycle.service.ts');
  const generation = readSource('modules/workpacks/services/workpack-generation.service.ts');
  const automation = readSource('modules/workpacks/workpack-automation.service.ts');

  it('requires validated tenant context at every request-driven creation entry', () => {
    expect(controller.match(/req\.tenantContext\?\.tenant\.id/g)).toHaveLength(3);
    expect(controller).not.toMatch(/ADMIN.*tenant|tenant.*ADMIN/i);
    expect(controller).toContain('tenantAuthority: { tenantId: authoritativeTenantId }');
    expect(controller).toContain('{ tenantId: authoritativeTenantId }');
  });

  it('scopes PlanningSession creation and referenced Aircraft to one authority', () => {
    expect(planning).toContain(
      'where: { id: params.aircraftId, tenant_id: params.tenantAuthority.tenantId }'
    );
    expect(planning).toContain('tenant_id: params.tenantAuthority.tenantId');
    expect(planning).toContain("throw new Error('ACTIVE_TENANT_CONTEXT_REQUIRED')");
    expect(planning.match(/PlanningSession\.create\(/g)).toHaveLength(1);
    expect(planning).not.toMatch(/tenant_id:\s*(?:req\.|user|creator|payload)/);
  });

  it('scopes every Workpack create mechanism to authoritative Aircraft ownership', () => {
    for (const source of [lifecycle, generation, automation]) {
      expect(source).toMatch(/where: \{ id: (?:data\.aircraft_id|params\.aircraftId|aircraft_id), tenant_id: (?:tenantAuthority|params\.tenantAuthority)\.tenantId \}/);
      expect(source).toMatch(/tenant_id: (?:tenantAuthority|params\.tenantAuthority)\.tenantId/);
      expect(source).not.toMatch(/tenant_id:\s*(?:data\.|req\.|user|customer)/);
    }
    expect(lifecycle.match(/Workpack\.create\(/g)).toHaveLength(1);
    expect(generation.match(/Workpack\.create\(/g)).toHaveLength(1);
    expect(automation.match(/Workpack\.create\(/g)).toHaveLength(1);
  });

  it('adds no fallback, ADMIN bypass, client authority, or transfer behavior', () => {
    const combined = [planning, lifecycle, generation, automation].join('\n');
    expect(combined).not.toMatch(/defaultTenant|fallbackTenant|inferTenant|transferTenant/);
    expect(combined).not.toMatch(/ADMIN.*tenant|tenant.*ADMIN/i);
    expect(combined).not.toMatch(/\.tenant_id\s*=|update\([^)]*tenant_id/);
  });
});
