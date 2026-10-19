import { describe, expect, it } from 'vitest';
import {
  SYSTEM_OWNER_USER_ID,
  SYSTEM_OWNER_EMAIL,
  SYSTEM_OWNER_DISPLAY_NAME,
  SYSTEM_OWNER_CAPABILITY_CODES,
  buildSystemOwnerConfirmationToken,
  buildSystemOwnerReconciliationToken,
} from './systemOwnerCanonical.js';

describe('canonical initial System Owner identity', () => {
  it('defines the fixed canonical identity', () => {
    expect(SYSTEM_OWNER_USER_ID).toBe('a5319d4e-eac5-4936-8824-b6ed94cc5d8f');
    expect(SYSTEM_OWNER_EMAIL).toBe('systemowner@jupiter.local');
    expect(SYSTEM_OWNER_DISPLAY_NAME).toBe('Jupiter System Owner');
  });

  it('defines exactly the twenty-three canonical capability codes without wildcard', () => {
    expect(SYSTEM_OWNER_CAPABILITY_CODES).toHaveLength(23);
    expect(new Set(SYSTEM_OWNER_CAPABILITY_CODES).size).toBe(23);
    expect([...SYSTEM_OWNER_CAPABILITY_CODES].sort()).toEqual([
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
    expect(SYSTEM_OWNER_CAPABILITY_CODES).not.toContain('*');
    expect(SYSTEM_OWNER_CAPABILITY_CODES).not.toContain('ALL');
  });

  it('builds the exact bootstrap confirmation token', () => {
    expect(buildSystemOwnerConfirmationToken('jupiter_db')).toBe(
      'BOOTSTRAP:jupiter_db:a5319d4e-eac5-4936-8824-b6ed94cc5d8f:systemowner@jupiter.local',
    );
  });

  it('builds a deterministic reconciliation confirmation token', () => {
    const token = buildSystemOwnerReconciliationToken('jupiter_test');
    expect(token).toBe(
      `RECONCILE:jupiter_test:${SYSTEM_OWNER_USER_ID}:${[...SYSTEM_OWNER_CAPABILITY_CODES]
        .sort()
        .join(',')}`,
    );
    expect(buildSystemOwnerReconciliationToken('jupiter_test')).toBe(token);
  });
});
