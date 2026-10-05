import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  fs.readFileSync(path.resolve(process.cwd(), 'src/modules/aircraft', name), 'utf8');

describe('MT-4C3A4 Aircraft root tenant conversion', () => {
  const controller = read('aircraft.controller.ts');
  const service = read('aircraft.service.ts');
  const repository = read('aircraft-tenant.repository.ts');
  const componentRepository = read('aircraft-component-tenant.repository.ts');
  const applicability = fs.readFileSync(
    path.resolve(process.cwd(), 'src/modules/compliance/applicability-engine.service.ts'),
    'utf8',
  );

  it('uses only request TenantQueryAuthority for converted controller actions', () => {
    expect(controller).toContain('return req.tenantAuthority;');
    expect(controller).not.toMatch(/req\.tenantContext[^\n]*(?:AircraftService|authority)/);
    expect(controller).not.toMatch(/\{\s*tenantId:/);
    expect(controller).not.toMatch(/\bADMIN\b/);
    for (const action of ['index', 'create', 'showView', 'showApplicability', 'showByRegistration', 'update', 'transition']) {
      const body = controller.match(new RegExp(`static async ${action}\\([\\s\\S]*?\\n  }`))?.[0] ?? '';
      expect(body).toContain('requireTenantAuthority(req)');
    }
  });

  it('makes authority mandatory and first for every converted service operation', () => {
    for (const operation of [
      'getById', 'getByRegistration', 'list', 'create', 'updateDetails',
      'activate', 'ground', 'returnToService', 'retire',
    ]) {
      expect(service).toMatch(new RegExp(`static async ${operation}\\(authority: TenantQueryAuthority`));
    }
    expect(service).not.toMatch(/authority\?:\s*TenantQueryAuthority|tenantIdOrAuthority/);
  });

  it('routes root get, list, registration, create, update, and lifecycle through the repository', () => {
    for (const call of [
      'getById(authority, id, { transaction })',
      'getByRegistration(authority, registration, { transaction })',
      'list(authority, {}, { transaction })',
      'create(authority, {',
      'getForRootUpdate(authority, id, {',
      'getForLifecycleUpdate(authority, id, {',
    ]) {
      expect(service).toContain(`tenantRepository.${call}`);
    }
    const deferredCalls = [...service.matchAll(/Aircraft\.(findByPk|findOne|findAll|count|create|update)/g)]
      .map((match) => match[0]);
    expect(deferredCalls).toEqual([]);
    expect((service.match(/Deferred 4C3B child\/mixed-domain root context/g) ?? []).length).toBe(0);
  });

  it('preserves transaction, lock, lifecycle policy, quarantine, save, and audit ownership', () => {
    expect(service).toContain('allowedTransitions');
    expect(service).toContain('this.requireReason(reason)');
    expect(componentRepository).toContain("current_status: 'QUARANTINED'");
    expect(service).toContain('hasQuarantinedForAircraft(');
    expect(service).toContain('lock: transaction.LOCK.UPDATE');
    expect(service).toContain('await aircraft.save({ transaction })');
    expect(service).toContain("action: 'CREATE'");
    expect(service).toContain("action: 'UPDATE'");
    expect(service).toContain("action: 'STATUS_CHANGE'");
    expect(service).not.toMatch(/as\s+(?:AircraftLifecycleInstance|AircraftRootUpdateInstance)/);
  });

  it('keeps ownership predicates and ownership mutation protection in the repository', () => {
    expect(repository).toContain('aircraftTenantWhere(authority, Object.freeze({ id }))');
    expect(repository).toContain('tenant_id: authority.tenantId');
    expect(repository).toContain('rejectOwnershipInput');
    expect(repository).not.toMatch(/\bADMIN\b|AsyncLocalStorage|globalThis/);
  });

  it('tenant-scopes aircraft view aggregates without structural authority or raw-ID fallback', () => {
    const directCalls = [...controller.matchAll(/Aircraft\.(findByPk|findOne|findAll|count|create|update)/g)]
      .map((match) => match[0]);
    expect(directCalls).toEqual(['Aircraft.findOne', 'Aircraft.findOne', 'Aircraft.findOne']);
    expect(controller.match(/where: \{ id: [^,]+, tenant_id: authority\.tenantId \}/g)).toHaveLength(4);
    expect(controller).toContain('getSerializedWorkflowContext(authority, aircraft.id)');
    expect(controller).toContain('getTenantApplicabilityForAircraft(authority, aircraftId)');
    expect(controller).not.toMatch(/getSerializedWorkflowContext\(aircraft\.id\)|authority\?\.tenantId/);
    expect(applicability).toContain('assertTenantQueryAuthority(authority);');
    expect(applicability).toContain('AND a.tenant_id = :tenantId');
  });

  it('does not activate the gate, add global tenant state, touch portal, or add migration 591', () => {
    const app = fs.readFileSync(path.resolve(process.cwd(), 'src/app.ts'), 'utf8');
    expect(app).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
    expect(controller + service).not.toMatch(/AsyncLocalStorage|globalThis|currentTenant|activeTenantSingleton/);
    expect(controller + service).not.toMatch(/customer-portal|customerUser/);
    expect(fs.readdirSync(path.resolve(process.cwd(), 'migrations')).some((name) => name.startsWith('606_'))).toBe(true);
  });
});
