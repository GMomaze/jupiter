export const PLATFORM_AUTHORITY_MANAGE = 'PLATFORM_AUTHORITY_MANAGE' as const;
export const PLATFORM_AUDIT_VIEW = 'PLATFORM_AUDIT_VIEW' as const;
export const PLATFORM_MUTATION_CAPABILITIES = [
  'REFERENCE_DATA_CREATE', 'REFERENCE_DATA_UPDATE', 'REFERENCE_DATA_DEACTIVATE',
  'RBAC_DEFINITION_MANAGE', 'MANUFACTURER_MASTER_MANAGE', 'MANUFACTURER_FILE_REPLACE',
  'COMPONENT_MODEL_MASTER_MANAGE', 'MAINTENANCE_MASTER_MANAGE',
  'REGULATORY_MASTER_MANAGE', 'REGULATORY_RELATIONSHIP_MANAGE',
  'SHARED_MASTER_IMPORT', 'SERVICE_BULLETIN_SYNC_EXECUTE',
  'LIFE_LIMIT_PROPOSE', 'LIFE_LIMIT_APPROVE', 'LIFE_LIMIT_ACTIVATE',
] as const;
export const TENANT_LIFECYCLE_CAPABILITIES = [
  'TENANT_PROVISION', 'TENANT_ACTIVATE', 'TENANT_SUSPEND', 'TENANT_REINSTATE', 'TENANT_ADMIN_RECOVER', 'TENANT_EXPORT',
] as const;
export type PlatformMutationCapability =
  | typeof PLATFORM_MUTATION_CAPABILITIES[number]
  | typeof TENANT_LIFECYCLE_CAPABILITIES[number];
export type PlatformPrincipalType = 'HUMAN' | 'SERVICE';
declare const platformAuthorityBrand: unique symbol;
export interface PlatformAuthority {
  readonly principalId: string;
  readonly principalType: PlatformPrincipalType;
  readonly principalCode: string;
  readonly capabilities: ReadonlySet<string>;
  readonly [platformAuthorityBrand]: true;
}
