const customerPortalQueryAuthorityBrand: unique symbol = Symbol(
  'CustomerPortalQueryAuthority',
);
const issuedAuthorities = new WeakSet<object>();

export interface CustomerPortalQueryAuthority {
  readonly customerUserId: string;
  readonly customerId: string;
  readonly tenantId: string;
  readonly [customerPortalQueryAuthorityBrand]: true;
}

export function assertCustomerPortalQueryAuthority(
  value: unknown,
): asserts value is CustomerPortalQueryAuthority {
  if (typeof value !== 'object' || value === null || !issuedAuthorities.has(value)) {
    throw new Error('CUSTOMER_PORTAL_AUTHORITY_REQUIRED');
  }
}

export function createCustomerPortalQueryAuthority(input: {
  customerUserId: string;
  customerId: string;
  tenantId: string;
}): CustomerPortalQueryAuthority {
  if (!input.customerUserId || !input.customerId || !input.tenantId) {
    throw new Error('CUSTOMER_PORTAL_AUTHORITY_INVALID');
  }

  const authority = {
    customerUserId: input.customerUserId,
    customerId: input.customerId,
    tenantId: input.tenantId,
  } as CustomerPortalQueryAuthority;
  Object.defineProperty(authority, customerPortalQueryAuthorityBrand, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  issuedAuthorities.add(authority);
  return Object.freeze(authority);
}
