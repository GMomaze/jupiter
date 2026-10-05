import type { PlatformMutationCapability, PlatformPrincipalType } from '../platform-authority/platform-authority.js';
import { assertRepositoryIssuedPlatformAuthority, PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';

function immutableLifecyclePolicy(
  capability: PlatformMutationCapability,
): readonly [PlatformMutationCapability, readonly PlatformPrincipalType[]] {
  return Object.freeze([capability, Object.freeze(['HUMAN'] as PlatformPrincipalType[])]);
}

export const TENANT_LIFECYCLE_OPERATION_POLICY = Object.freeze({
  TENANT_PROVISION: immutableLifecyclePolicy('TENANT_PROVISION'),
  TENANT_ACTIVATE: immutableLifecyclePolicy('TENANT_ACTIVATE'),
  TENANT_SUSPEND: immutableLifecyclePolicy('TENANT_SUSPEND'),
  TENANT_REINSTATE: immutableLifecyclePolicy('TENANT_REINSTATE'),
  TENANT_ADMIN_RECOVER: immutableLifecyclePolicy('TENANT_ADMIN_RECOVER'),
  TENANT_EXPORT: immutableLifecyclePolicy('TENANT_EXPORT'),
  TENANT_INVITATION_REISSUE: immutableLifecyclePolicy('TENANT_PROVISION'),
  TENANT_ADMIN_INVITATION_CORRECT: immutableLifecyclePolicy('TENANT_PROVISION'),
} as const satisfies Record<string, readonly [PlatformMutationCapability, readonly PlatformPrincipalType[]]>);

export type TenantLifecycleOperation = keyof typeof TENANT_LIFECYCLE_OPERATION_POLICY;

export function tenantLifecycleOperationPolicy(operation: string) {
  const policy = TENANT_LIFECYCLE_OPERATION_POLICY[operation as TenantLifecycleOperation];
  if (!policy) throw new Error('UNKNOWN_TENANT_LIFECYCLE_OPERATION');
  return Object.freeze({ capability: policy[0], principalTypes: Object.freeze([...policy[1]]) });
}

export async function authorizeTenantLifecycleOperation(
  repository: PlatformAuthorityRepository,
  authority: unknown,
  operation: string,
): Promise<void> {
  assertRepositoryIssuedPlatformAuthority(authority);
  const policy = tenantLifecycleOperationPolicy(operation);
  await repository.authorizeCapability(authority, policy.capability, policy.principalTypes);
}
