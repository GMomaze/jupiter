import type { ValidActiveTenantContext } from './active-tenant-context.types.js';

const tenantQueryAuthorityBrand: unique symbol = Symbol('TenantQueryAuthority');
const issuedTenantQueryAuthorities = new WeakSet<object>();

export interface TenantQueryAuthority {
  readonly tenantId: string;
  readonly [tenantQueryAuthorityBrand]: true;
}

export function assertTenantQueryAuthority(
  value: unknown,
): asserts value is TenantQueryAuthority {
  if (
    typeof value !== 'object' ||
    value === null ||
    !issuedTenantQueryAuthorities.has(value)
  ) {
    throw new Error('TENANT_AUTHORITY_REQUIRED');
  }
}

export function createTenantQueryAuthority(
  context: ValidActiveTenantContext,
): TenantQueryAuthority {
  if (
    context.state !== 'VALID_ACTIVE_TENANT' ||
    context.tenant.status !== 'ACTIVE' ||
    context.membership.status !== 'ACTIVE' ||
    !context.tenant.id ||
    !context.membership.id ||
    !context.membership.userId ||
    context.membership.tenantId !== context.tenant.id
  ) {
    throw new Error('TENANT_QUERY_AUTHORITY_INVALID');
  }

  const authority = { tenantId: context.tenant.id } as TenantQueryAuthority;
  Object.defineProperty(authority, tenantQueryAuthorityBrand, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  issuedTenantQueryAuthorities.add(authority);
  return Object.freeze(authority);
}
