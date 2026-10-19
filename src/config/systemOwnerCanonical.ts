/**
 * Canonical initial System Owner identity for a fresh development jupiter_db.
 * These values are the single source of truth for the guarded development
 * user-creation and bootstrap orchestration. They are intentionally constants:
 * the initial System Owner identity is fixed, not operator-supplied.
 */

export const SYSTEM_OWNER_USER_ID = 'a5319d4e-eac5-4936-8824-b6ed94cc5d8f';

export const SYSTEM_OWNER_EMAIL = 'systemowner@jupiter.local';

export const SYSTEM_OWNER_DISPLAY_NAME = 'Jupiter System Owner';

export const SYSTEM_OWNER_CAPABILITY_CODES: readonly string[] = Object.freeze([
  'COMPONENT_MODEL_MASTER_MANAGE',
  'LIFE_LIMIT_ACTIVATE',
  'LIFE_LIMIT_APPROVE',
  'LIFE_LIMIT_PROPOSE',
  'MAINTENANCE_MASTER_MANAGE',
  'MANUFACTURER_FILE_REPLACE',
  'MANUFACTURER_MASTER_MANAGE',
  'PLATFORM_AUDIT_VIEW',
  'PLATFORM_AUTHORITY_MANAGE',
  'RBAC_DEFINITION_MANAGE',
  'REFERENCE_DATA_CREATE',
  'REFERENCE_DATA_DEACTIVATE',
  'REFERENCE_DATA_UPDATE',
  'REGULATORY_MASTER_MANAGE',
  'REGULATORY_RELATIONSHIP_MANAGE',
  'SERVICE_BULLETIN_SYNC_EXECUTE',
  'SHARED_MASTER_IMPORT',
  'TENANT_ACTIVATE',
  'TENANT_ADMIN_RECOVER',
  'TENANT_EXPORT',
  'TENANT_PROVISION',
  'TENANT_REINSTATE',
  'TENANT_SUSPEND',
]);

export function buildSystemOwnerConfirmationToken(database: string): string {
  return `BOOTSTRAP:${database}:${SYSTEM_OWNER_USER_ID}:${SYSTEM_OWNER_EMAIL.trim().toLowerCase()}`;
}

export function buildSystemOwnerReconciliationToken(database: string): string {
  return `RECONCILE:${database}:${SYSTEM_OWNER_USER_ID}:${[...SYSTEM_OWNER_CAPABILITY_CODES].sort().join(',')}`;
}
