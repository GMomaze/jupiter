import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('MT-4C3C static tenant isolation', () => {
  const repository = source('src/modules/workpacks/workpack-tenant.repository.ts');
  const lifecycle = source('src/modules/workpacks/services/workpack-lifecycle.service.ts');
  const taskExecution = source('src/modules/workpacks/services/task-execution.service.ts');
  const snag = source('src/modules/workpacks/services/snag.service.ts');
  const integration = source('src/modules/workpacks/services/workpack-component-integration.service.ts');
  const controller = source('src/modules/workpacks/workpack.controller.ts');

  it('requires authentic authority and historical Workpack ownership', () => {
    expect(repository).toContain('assertTenantQueryAuthority(authority)');
    expect(repository).toContain('tenant_id: authority.tenantId');
    expect(lifecycle).toContain('workpackTenantRepository.getById(authority');
    expect(controller).toContain('assertTenantQueryAuthority(req.tenantAuthority)');
  });

  it('resolves standalone and linked snags through mutually exclusive owned roots', () => {
    expect(repository).toContain('snag.workpack_id IS NOT NULL');
    expect(repository).toContain('owned_workpack.tenant_id = :tenantId');
    expect(repository).toContain('snag.workpack_id IS NULL');
    expect(repository).toContain('owned_aircraft.tenant_id = :tenantId');
    expect(snag).not.toMatch(/WorkpackSnag\.findByPk\(snagId/);
  });

  it('makes mixed-tenant TaskCards unavailable before mutation', () => {
    expect(repository).toContain('authority_workpacks.tenant_id <>');
    expect(repository).toContain('required: true');
    expect(taskExecution).toContain('workpackTenantRepository.getTaskCardById(authority');
    expect(taskExecution).not.toMatch(/TaskCard\.findByPk\(taskId/);
  });

  it('uses B3 repositories for component integration after an owned Workpack root', () => {
    expect(integration).toContain('workpackTenantRepository.getById(params.authority');
    expect(integration).toContain('aircraftComponentInstallationTenantRepository');
    expect(integration).toContain('aircraftComponentTenantRepository');
    expect(integration).not.toMatch(/AircraftComponent(?:Installation)?\.find/);
  });

  it('keeps standalone audit history rather than inventing a Workpack', () => {
    const audit = source('src/modules/workpacks/services/workpack-audit.service.ts');
    const model = source('src/models/audit/WorkpackSnagAuditLog.ts');
    expect(audit).toContain('workpackId: string | null');
    expect(audit).toContain('getSnagAuditEntries');
    expect(model).toContain('declare workpack_id: string | null');
  });
});
