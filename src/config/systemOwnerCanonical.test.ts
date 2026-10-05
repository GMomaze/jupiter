import { describe, expect, it } from 'vitest';
import {
  SYSTEM_OWNER_USER_ID,
  SYSTEM_OWNER_EMAIL,
  SYSTEM_OWNER_DISPLAY_NAME,
  SYSTEM_OWNER_CAPABILITY_CODES,
  buildSystemOwnerConfirmationToken,
} from './systemOwnerCanonical.js';

describe('canonical initial System Owner identity', () => {
  it('defines the fixed canonical identity', () => {
    expect(SYSTEM_OWNER_USER_ID).toBe('a5319d4e-eac5-4936-8824-b6ed94cc5d8f');
    expect(SYSTEM_OWNER_EMAIL).toBe('systemowner@jupiter.local');
    expect(SYSTEM_OWNER_DISPLAY_NAME).toBe('Jupiter System Owner');
  });

  it('defines exactly the six canonical capability codes', () => {
    expect([...SYSTEM_OWNER_CAPABILITY_CODES].sort()).toEqual([
      'PLATFORM_AUDIT_VIEW',
      'PLATFORM_AUTHORITY_MANAGE',
      'TENANT_ACTIVATE',
      'TENANT_PROVISION',
      'TENANT_REINSTATE',
      'TENANT_SUSPEND',
    ]);
    expect(SYSTEM_OWNER_CAPABILITY_CODES).toHaveLength(6);
  });

  it('builds the exact bootstrap confirmation token', () => {
    expect(buildSystemOwnerConfirmationToken('jupiter_db')).toBe(
      'BOOTSTRAP:jupiter_db:a5319d4e-eac5-4936-8824-b6ed94cc5d8f:systemowner@jupiter.local',
    );
  });
});
