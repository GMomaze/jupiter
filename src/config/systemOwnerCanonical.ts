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
  'PLATFORM_AUTHORITY_MANAGE',
  'PLATFORM_AUDIT_VIEW',
  'TENANT_PROVISION',
  'TENANT_ACTIVATE',
  'TENANT_SUSPEND',
  'TENANT_REINSTATE',
]);

export function buildSystemOwnerConfirmationToken(database: string): string {
  return `BOOTSTRAP:${database}:${SYSTEM_OWNER_USER_ID}:${SYSTEM_OWNER_EMAIL.trim().toLowerCase()}`;
}
