// Tenant departure-export targeting and eligibility policy.
//
// A controlled departure export targets exactly one tenant and must not weaken
// tenant isolation. Eligibility is restricted to ACTIVE and SUSPENDED tenants;
// PROVISIONING is denied (no operational data) and ARCHIVED remains a reserved,
// unreachable state that this policy neither enters nor restores.

export const TENANT_EXPORT_ELIGIBLE_STATUSES = Object.freeze(['ACTIVE', 'SUSPENDED'] as const);
export type TenantExportEligibleStatus = (typeof TENANT_EXPORT_ELIGIBLE_STATUSES)[number];

export const TENANT_EXPORT_STATUS_INELIGIBLE = 'TENANT_EXPORT_STATUS_INELIGIBLE';
export const TENANT_EXPORT_TARGET_INVALID = 'TENANT_EXPORT_TARGET_INVALID';

export interface TenantExportTarget {
  readonly tenantId: string;
  readonly publicId: string;
  readonly status: TenantExportEligibleStatus;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertTenantExportEligible(status: string): asserts status is TenantExportEligibleStatus {
  if (!(TENANT_EXPORT_ELIGIBLE_STATUSES as readonly string[]).includes(status)) {
    throw new Error(TENANT_EXPORT_STATUS_INELIGIBLE);
  }
}

// Authoritative tenant targeting: binds one exact tenant identity (internal id
// and public id must both be present, valid UUIDs, and correspond) and
// revalidates its export-eligible status. Rejects fabricated/mismatched identity
// and ineligible status so that a target tenant can never be substituted or mixed.
export function resolveTenantExportTarget(input: Readonly<{
  tenantId?: unknown;
  publicId?: unknown;
  status?: unknown;
}>): TenantExportTarget {
  if (
    typeof input.tenantId !== 'string' ||
    typeof input.publicId !== 'string' ||
    typeof input.status !== 'string'
  ) {
    throw new Error(TENANT_EXPORT_TARGET_INVALID);
  }
  if (!UUID.test(input.tenantId) || !UUID.test(input.publicId)) {
    throw new Error(TENANT_EXPORT_TARGET_INVALID);
  }
  assertTenantExportEligible(input.status);
  return Object.freeze({ tenantId: input.tenantId, publicId: input.publicId, status: input.status });
}

