import {
  SHARED_OPERATION_POLICY,
  sharedOperationPolicy,
  type SharedMutationOperation,
} from './shared-operation-policy.js';
import {
  TENANT_LIFECYCLE_OPERATION_POLICY,
  tenantLifecycleOperationPolicy,
  type TenantLifecycleOperation,
} from '../tenancy/tenant-lifecycle-policy.js';

export type PlatformMutationOperation = SharedMutationOperation | TenantLifecycleOperation;

export function platformMutationOperationPolicy(operation: string) {
  if (operation in SHARED_OPERATION_POLICY) return sharedOperationPolicy(operation);
  if (operation in TENANT_LIFECYCLE_OPERATION_POLICY) return tenantLifecycleOperationPolicy(operation);
  throw new Error('UNKNOWN_PLATFORM_MUTATION_OPERATION');
}
