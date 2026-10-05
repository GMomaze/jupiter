import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ValidActiveTenantContext } from './active-tenant-context.types.js';
import {
  assertTenantQueryAuthority,
  createTenantQueryAuthority,
  type TenantQueryAuthority,
} from './tenant-query-authority.js';

const validContext: ValidActiveTenantContext = Object.freeze({
  state: 'VALID_ACTIVE_TENANT',
  tenant: Object.freeze({
    id: 'tenant-1',
    publicId: 'public-1',
    code: 'ORG_ONE',
    displayName: 'Organisation One',
    status: 'ACTIVE',
  }),
  membership: Object.freeze({
    id: 'membership-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    status: 'ACTIVE',
  }),
  validatedAt: 100,
});

const read = (relative: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');

describe('TenantQueryAuthority', () => {
  it('creates a frozen authority exposing only the authoritative tenant ID', () => {
    const authority = createTenantQueryAuthority(validContext);
    expect(Object.keys(authority)).toEqual(['tenantId']);
    expect(authority.tenantId).toBe('tenant-1');
    expect(Object.isFrozen(authority)).toBe(true);
    expect(authority).not.toHaveProperty('membershipId');
    expect(authority).not.toHaveProperty('roles');
    expect(authority).not.toHaveProperty('permissions');
    expect(authority).not.toHaveProperty('customerUser');
  });

  it('fails closed for an inconsistent supposedly-valid relationship', () => {
    const inconsistent = {
      ...validContext,
      membership: { ...validContext.membership, tenantId: 'tenant-2' },
    } as ValidActiveTenantContext;
    expect(() => createTenantQueryAuthority(inconsistent)).toThrow(
      'TENANT_QUERY_AUTHORITY_INVALID',
    );
  });

  it('accepts no raw tenant-ID or ADMIN-shaped factory input at the type boundary', () => {
    type FactoryInput = Parameters<typeof createTenantQueryAuthority>[0];
    type RawIdAccepted = string extends FactoryInput ? true : false;
    type AdminAccepted = { tenantId: string; roles: readonly ['ADMIN'] } extends FactoryInput
      ? true
      : false;
    const rawIdAccepted: RawIdAccepted = false;
    const adminAccepted: AdminAccepted = false;
    expect(rawIdAccepted).toBe(false);
    expect(adminAccepted).toBe(false);
  });

  it('is nominal rather than structurally constructible', () => {
    type PlainObjectAccepted = { readonly tenantId: string } extends TenantQueryAuthority
      ? true
      : false;
    const plainObjectAccepted: PlainObjectAccepted = false;
    expect(plainObjectAccepted).toBe(false);
  });

  it('accepts only exact factory-issued runtime identity', () => {
    const authority = createTenantQueryAuthority(validContext);
    const reflectedSymbol = Object.getOwnPropertySymbols(authority)[0];
    const reflectedSymbolClone = { tenantId: authority.tenantId };
    if (reflectedSymbol) {
      Object.defineProperty(reflectedSymbolClone, reflectedSymbol, { value: true });
    }
    const nullPrototype = Object.create(null) as Record<string, unknown>;
    nullPrototype.tenantId = authority.tenantId;
    const copiedEnumerable = Object.fromEntries(Object.entries(authority));
    const fakeSymbol = Symbol('TenantQueryAuthority');
    const fakeSymbolObject = { tenantId: authority.tenantId, [fakeSymbol]: true };
    const prototypeClone = Object.create(authority) as object;
    const castObject = { tenantId: authority.tenantId } as TenantQueryAuthority;

    const forgeries: unknown[] = [
      undefined,
      null,
      {},
      { tenantId: authority.tenantId },
      Object.freeze({ tenantId: authority.tenantId }),
      { ...authority },
      Object.assign({}, authority),
      JSON.parse(JSON.stringify(authority)),
      nullPrototype,
      copiedEnumerable,
      { tenantId: authority.tenantId, brand: 'TenantQueryAuthority' },
      fakeSymbolObject,
      reflectedSymbolClone,
      prototypeClone,
      castObject,
      { tenantId: 'altered-tenant' },
    ];

    for (const forgery of forgeries) {
      expect(() => assertTenantQueryAuthority(forgery)).toThrow(
        'TENANT_AUTHORITY_REQUIRED',
      );
    }
    expect(() => assertTenantQueryAuthority(authority)).not.toThrow();
  });

  it('keeps the issued authority immutable and makes clones non-authentic', () => {
    const authority = createTenantQueryAuthority(validContext);
    expect(() => {
      (authority as { tenantId: string }).tenantId = 'tenant-2';
    }).toThrow();
    expect(authority.tenantId).toBe('tenant-1');
    expect(() => assertTenantQueryAuthority({ ...authority })).toThrow(
      'TENANT_AUTHORITY_REQUIRED',
    );
  });

  it('has no database, global-context, RBAC, customer, or operational dependency', () => {
    const source = read('src/modules/tenancy/tenant-query-authority.ts');
    expect(source).not.toMatch(
      /sequelize|from ['"]pg['"]|database\.js|AsyncLocalStorage|globalThis|\bADMIN\b|role|permission|customerUser|Aircraft|Customer|SerializedComponent|PlanningSession|Workpack/,
    );
    expect(source).toContain('const issuedTenantQueryAuthorities = new WeakSet<object>()');
    expect(source).not.toMatch(/export\s+(?:const|let|var)\s+.*(?:WeakSet|Brand|Token)/i);
  });

  it('allows only explicitly authorised progression and no operational activation', () => {
    const app = read('src/app.ts');
    expect(app).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
    expect(
      fs.readdirSync(path.resolve(process.cwd(), 'migrations'))
        .filter((name) => name.startsWith('591_')),
    ).toEqual(['591_allow_standalone_snag_audit_history.ts']);

    const expectedProductionImports = new Set([
      path.resolve(
        process.cwd(),
        'src/modules/aircraft/aircraft-tenant.repository.ts',
      ),
      path.resolve(
        process.cwd(),
        'src/modules/aircraft/aircraft.controller.ts',
      ),
      path.resolve(
        process.cwd(),
        'src/modules/aircraft/aircraft.service.ts',
      ),
      path.resolve(
        process.cwd(),
        'src/modules/customers/customer-tenant.repository.ts',
      ),
      path.resolve(
        process.cwd(),
        'src/modules/customers/customers.controller.ts',
      ),
      path.resolve(
        process.cwd(),
        'src/modules/customers/customer-aircraft-link-tenant.repository.ts',
      ),
      path.resolve(
        process.cwd(),
        'src/modules/customers/customer-aircraft-link-tenant.service.ts',
      ),
      path.resolve(
        process.cwd(),
        'src/modules/customers/customers.service.ts',
      ),
      path.resolve(
        process.cwd(),
        'src/modules/library/serialized-component-tenant.repository.ts',
      ),
      path.resolve(
        process.cwd(),
        'src/modules/library/library.service.ts',
      ),
      path.resolve(
        process.cwd(),
        'src/modules/library/library.routes.ts',
      ),
      path.resolve(process.cwd(), 'src/modules/library/library.controller.ts'),
      path.resolve(process.cwd(), 'src/modules/library/serialized-component-reconciliation.repository.ts'),
      path.resolve(process.cwd(), 'src/modules/library/serialized-component-reconciliation.service.ts'),
      path.resolve(
        process.cwd(),
        'src/modules/aircraft/aircraft-component-tenant.repository.ts',
      ),
      path.resolve(
        process.cwd(),
        'src/modules/aircraft/aircraft-component-installation-tenant.repository.ts',
      ),
      path.resolve(
        process.cwd(),
        'src/modules/aircraft/aircraft-component.service.ts',
      ),
      path.resolve(process.cwd(), 'src/modules/aircraft/component-life-calculation.service.ts'),
      path.resolve(process.cwd(), 'src/modules/aircraft/component-limit-monitoring.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/workpack.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/workpack.controller.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/workpack-tenant.repository.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/workpack-automation.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/services/planning-session.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/services/snag.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/services/task-execution.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/services/workpack-audit.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/services/workpack-component-integration.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/services/workpack-execution.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/services/workpack-generation.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/services/workpack-lifecycle.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/services/workpack-planning.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/services/workpack-preview.service.ts'),
      path.resolve(process.cwd(), 'src/modules/workpacks/services/workpack-service-bulletin.service.ts'),
    ]);
    const discoveredProductionImports = new Set<string>();
    const operationalRoots = [
      'src/modules/aircraft',
      'src/modules/customers',
      'src/modules/library',
      'src/modules/maintenance',
      'src/modules/workpacks',
    ];
    for (const root of operationalRoots) {
      const files = fs.readdirSync(path.resolve(process.cwd(), root), {
        recursive: true,
        withFileTypes: true,
      });
      for (const entry of files) {
        if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
        const file = path.join(entry.parentPath, entry.name);
        const source = fs.readFileSync(file, 'utf8');
        if (!source.match(/tenant-query-authority/)) continue;

        // Focused tests and their support modules exercise authorised
        // infrastructure; they do not activate production authority.
        // Production consumers remain an exact allowlist.
        if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test-support.ts')) continue;
        if (
          entry.name === 'maintenance-trigger.service.ts'
          && source.includes('DORMANT_MAINTENANCE_SHARED_WRITER_DISABLED')
        ) continue;
        discoveredProductionImports.add(path.resolve(file));
        const delegatesToVerifiedWorkpackBoundaries = entry.name === 'workpack.service.ts'
          && [
            'WorkpackLifecycleService',
            'WorkpackPlanningService',
            'WorkpackServiceBulletinService',
            'TaskExecutionService',
            'SnagService',
          ].every((boundary) => source.includes(boundary));
        expect(
          source.includes('assertTenantQueryAuthority') || delegatesToVerifiedWorkpackBoundaries,
        ).toBe(true);
        expect(source).not.toMatch(
          /authority\?:\s*TenantQueryAuthority|tenantIdOrAuthority|AsyncLocalStorage|globalThis|(?:tenantAuthority|authority)\s*(?:\?\?|\|\|)[^\n]*(?:ADMIN|role|permission)|(?:ADMIN|role|permission)[^\n]*(?:tenantAuthority|authority)\s*(?:\?\?|\|\|)|if\s*\([^)]*!authority[^)]*\)[^{]*{[^}]*find(?:All|One|ByPk)/s,
        );
      }
    }
    expect([...discoveredProductionImports].sort()).toEqual(
      [...expectedProductionImports].sort(),
    );
  });
});
