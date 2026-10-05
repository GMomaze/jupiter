import type { PlatformAuthority, PlatformMutationCapability, PlatformPrincipalType } from './platform-authority.js';
import { assertRepositoryIssuedPlatformAuthority, PlatformAuthorityRepository } from './platform-authority.repository.js';

function immutablePolicy(
  capability: PlatformMutationCapability,
  principalTypes: readonly PlatformPrincipalType[],
): readonly [PlatformMutationCapability, readonly PlatformPrincipalType[]] {
  return Object.freeze([capability, Object.freeze([...principalTypes])]);
}

export const SHARED_OPERATION_POLICY = Object.freeze({
  REFERENCE_CREATE: immutablePolicy('REFERENCE_DATA_CREATE', ['HUMAN']),
  REFERENCE_UPDATE: immutablePolicy('REFERENCE_DATA_UPDATE', ['HUMAN']),
  REFERENCE_DEACTIVATE: immutablePolicy('REFERENCE_DATA_DEACTIVATE', ['HUMAN']),
  RBAC_DEFINITION_MANAGE: immutablePolicy('RBAC_DEFINITION_MANAGE', ['HUMAN']),
  MANUFACTURER_CREATE: immutablePolicy('MANUFACTURER_MASTER_MANAGE', ['HUMAN']),
  MANUFACTURER_UPDATE: immutablePolicy('MANUFACTURER_MASTER_MANAGE', ['HUMAN']),
  MANUFACTURER_FILE_REPLACE: immutablePolicy('MANUFACTURER_FILE_REPLACE', ['HUMAN']),
  COMPONENT_MODEL_CREATE: immutablePolicy('COMPONENT_MODEL_MASTER_MANAGE', ['HUMAN']),
  COMPONENT_MODEL_UPDATE: immutablePolicy('COMPONENT_MODEL_MASTER_MANAGE', ['HUMAN']),
  MAINTENANCE_MASTER_CREATE: immutablePolicy('MAINTENANCE_MASTER_MANAGE', ['HUMAN']),
  MAINTENANCE_MASTER_UPDATE: immutablePolicy('MAINTENANCE_MASTER_MANAGE', ['HUMAN']),
  MAINTENANCE_MASTER_DELETE: immutablePolicy('MAINTENANCE_MASTER_MANAGE', ['HUMAN']),
  REGULATORY_MASTER_CREATE: immutablePolicy('REGULATORY_MASTER_MANAGE', ['HUMAN']),
  REGULATORY_MASTER_UPDATE: immutablePolicy('REGULATORY_MASTER_MANAGE', ['HUMAN']),
  REGULATORY_RELATIONSHIP_MUTATE: immutablePolicy('REGULATORY_RELATIONSHIP_MANAGE', ['HUMAN']),
  SHARED_MASTER_IMPORT: immutablePolicy('SHARED_MASTER_IMPORT', ['HUMAN']),
  SERVICE_BULLETIN_SYNC: immutablePolicy('SERVICE_BULLETIN_SYNC_EXECUTE', ['HUMAN', 'SERVICE']),
  LIFE_LIMIT_PROPOSE: immutablePolicy('LIFE_LIMIT_PROPOSE', ['HUMAN']),
  LIFE_LIMIT_APPROVE: immutablePolicy('LIFE_LIMIT_APPROVE', ['HUMAN']),
  LIFE_LIMIT_ACTIVATE: immutablePolicy('LIFE_LIMIT_ACTIVATE', ['HUMAN']),
} as const satisfies Record<string, readonly [PlatformMutationCapability, readonly PlatformPrincipalType[]]>);

export type SharedMutationOperation = keyof typeof SHARED_OPERATION_POLICY;
export type ReferenceMutationOperation = 'CREATE' | 'UPDATE' | 'DEACTIVATE';

const ORDINARY_REFERENCE_TABLES = Object.freeze([
  'rf_asset_type', 'rf_component_condition', 'rf_aircraft_category', 'rf_component_type',
] as const);
const RBAC_REFERENCE_TABLES = Object.freeze([
  'rf_role', 'rf_permission', 'rf_role_permissions', 'rf_task_state',
  'rf_workpack_status', 'rf_workpack_type', 'rf_signoff_role',
] as const);

export const REFERENCE_OPERATION_POLICY = Object.freeze({
  ordinaryTables: ORDINARY_REFERENCE_TABLES,
  rbacTables: RBAC_REFERENCE_TABLES,
  operations: Object.freeze({ CREATE: 'REFERENCE_CREATE', UPDATE: 'REFERENCE_UPDATE', DEACTIVATE: 'REFERENCE_DEACTIVATE' }),
});

export function sharedOperationPolicy(operation: string) {
  const policy = SHARED_OPERATION_POLICY[operation as SharedMutationOperation];
  if (!policy) throw new Error('UNKNOWN_SHARED_MUTATION_OPERATION');
  return Object.freeze({ capability: policy[0], principalTypes: Object.freeze([...policy[1]]) });
}

export function referenceOperationPolicy(tableName: string, operation: ReferenceMutationOperation) {
  if ((RBAC_REFERENCE_TABLES as readonly string[]).includes(tableName)) return sharedOperationPolicy('RBAC_DEFINITION_MANAGE');
  if (!(ORDINARY_REFERENCE_TABLES as readonly string[]).includes(tableName)) throw new Error('UNKNOWN_REFERENCE_MUTATION_TABLE');
  return sharedOperationPolicy(REFERENCE_OPERATION_POLICY.operations[operation]);
}

export async function authorizeSharedOperation(repository: PlatformAuthorityRepository, authority: unknown, operation: string) {
  assertRepositoryIssuedPlatformAuthority(authority);
  const policy = sharedOperationPolicy(operation);
  await repository.authorizeCapability(authority, policy.capability, policy.principalTypes);
}
