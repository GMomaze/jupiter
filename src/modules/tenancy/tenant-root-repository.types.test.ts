import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TenantQueryAuthority } from './tenant-query-authority.js';
import {
  TENANT_REPOSITORY_ERROR_CODES,
  type SharedReferenceRepository,
  type TenantBusinessInput,
  type TenantOwnedRootRepository,
} from './tenant-root-repository.types.js';

interface Row { readonly id: string }
interface CreateInput { readonly registration: string; readonly tenant_id: string }
interface UpdateInput { readonly registration?: string; readonly custodian_tenant_id?: string }
interface Filter { readonly status?: string }
interface Search { readonly term: string }

type Repository = TenantOwnedRootRepository<
  Row,
  CreateInput,
  UpdateInput,
  Filter,
  Search,
  number,
  string,
  { readonly transactionId: string }
>;

describe('tenant root repository contracts', () => {
  it('requires TenantQueryAuthority as the first argument for every operation', () => {
    type RequiredAuthority = Parameters<Repository['getById']>[0];
    type BareStringAccepted = string extends RequiredAuthority ? true : false;
    type OptionalAuthority = undefined extends RequiredAuthority ? true : false;
    const bareStringAccepted: BareStringAccepted = false;
    const optionalAuthority: OptionalAuthority = false;
    expect(bareStringAccepted).toBe(false);
    expect(optionalAuthority).toBe(false);

    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/tenancy/tenant-root-repository.types.ts'),
      'utf8',
    );
    const methodCount = [...source.matchAll(/\n  (?:getById|findOne|list|search|count|listPage|create|updateById|deleteById|updateMany|deleteMany|aggregate)\(/g)].length;
    const authorityCount = [...source.matchAll(/authority: TenantQueryAuthority/g)].length;
    expect(methodCount).toBe(12);
    expect(authorityCount).toBe(12);
  });

  it('keeps create/update ownership out of business input', () => {
    type Input = TenantBusinessInput<CreateInput>;
    type TenantId = Input['tenant_id'];
    type CustodianId = TenantBusinessInput<UpdateInput>['custodian_tenant_id'];
    const tenantId: TenantId = undefined;
    const custodianId: CustodianId = undefined;
    expect(tenantId).toBeUndefined();
    expect(custodianId).toBeUndefined();
  });

  it('keeps transaction options separate and exposes no arbitrary include contract', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/tenancy/tenant-root-repository.types.ts'),
      'utf8',
    );
    expect(source).toContain('options?: TenantRepositoryOptions<TTransaction>');
    expect(source).not.toMatch(/include(?:s)?\??:/i);
    expect(source).not.toMatch(/authority\?:|tenantId\?:/);
  });

  it('covers reads, mutations, bulk operations, count, pagination, and aggregate', () => {
    const methods: readonly (keyof Repository)[] = [
      'getById', 'findOne', 'list', 'search', 'count', 'listPage', 'create',
      'updateById', 'deleteById', 'updateMany', 'deleteMany', 'aggregate',
    ];
    expect(methods).toHaveLength(12);
  });

  it('defines fail-closed unique-ID mutation cardinality', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/tenancy/tenant-root-repository.types.ts'),
      'utf8',
    );
    expect(source).toContain('0 affected rows to UNAVAILABLE');
    expect(source).toContain('1 to CHANGED');
    expect(source).toContain('more than 1 affected row as TENANT_QUERY_FAILED');
  });

  it('separates tenant-owned and shared-reference repository contracts', () => {
    type TenantScope = Repository['repositoryScope'];
    type SharedScope = SharedReferenceRepository['repositoryScope'];
    const tenantScope: TenantScope = 'TENANT_OWNED_ROOT';
    const sharedScope: SharedScope = 'SHARED_REFERENCE';
    expect(tenantScope).not.toBe(sharedScope);
  });

  it('defines only the approved stable repository error categories', () => {
    expect(TENANT_REPOSITORY_ERROR_CODES).toEqual([
      'TENANT_AUTHORITY_REQUIRED',
      'TENANT_RESOURCE_UNAVAILABLE',
      'TENANT_QUERY_FAILED',
    ]);
  });

  it('has no operational model, DB, raw SQL, request, session, or global-context dependency', () => {
    const combined = [
      'src/modules/tenancy/tenant-query-scope.ts',
      'src/modules/tenancy/tenant-root-repository.types.ts',
    ].map((file) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')).join('\n');
    expect(combined).not.toMatch(
      /from ['"]pg['"]|database\.js|sequelize\.query|pool\.query|Aircraft\.find|Customer\.find|SerializedComponent\.find|PlanningSession\.find|Workpack\.find|\bRequest\b|\bSession(?:Data)?\b|AsyncLocalStorage|globalThis|requireValidActiveTenantContext/,
    );
  });

  it('remains dormant with no migration 591', () => {
    const app = fs.readFileSync(path.resolve(process.cwd(), 'src/app.ts'), 'utf8');
    expect(app).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
    expect(
      fs.readdirSync(path.resolve(process.cwd(), 'migrations')).some((name) =>
        name.startsWith('591_'),
      ),
    ).toBe(false);
  });
});
