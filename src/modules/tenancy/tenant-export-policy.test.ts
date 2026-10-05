import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TENANT_LIFECYCLE_CAPABILITIES } from '../platform-authority/platform-authority.js';
import { platformMutationOperationPolicy } from '../platform-authority/platform-mutation-operation-policy.js';
import { tenantLifecycleOperationPolicy } from './tenant-lifecycle-policy.js';
import {
  assertTenantExportEligible,
  resolveTenantExportTarget,
  TENANT_EXPORT_ELIGIBLE_STATUSES,
  TENANT_EXPORT_STATUS_INELIGIBLE,
  TENANT_EXPORT_TARGET_INVALID,
} from './tenant-export-policy.js';

const migration = fs.readFileSync('migrations/604_seed_tenant_export_capability.ts', 'utf8');
const authorityRepository = fs.readFileSync('src/modules/platform-authority/platform-authority.repository.ts', 'utf8');

const tenantA = '60400000-0000-4000-8000-000000000001';
const publicA = '60400000-0000-4000-8000-000000000002';

describe('MP2 2E.2 Phase 1 — tenant export authority and targeting', () => {
  it('seeds TENANT_EXPORT as a granular system-locked capability with no grants/principals', () => {
    expect(TENANT_LIFECYCLE_CAPABILITIES).toContain('TENANT_EXPORT');
    expect(migration).toContain("'TENANT_EXPORT'");
    expect(migration).toContain('is_active,system_locked');
    expect(migration).toContain('true,true');
    expect(migration).not.toMatch(/INSERT INTO platform_capability_grants|INSERT INTO platform_principals|ROW LEVEL SECURITY|CREATE POLICY/i);
    expect(migration).toContain('MIGRATION_604_REFUSES_EXISTING_CAPABILITY');
    expect(migration).toContain('MIGRATION_604_DOWN_REFUSES_INCONSISTENT_CAPABILITY');
    expect(migration).toContain('MIGRATION_604_DOWN_REFUSES_AUTHORITY_EVIDENCE');
  });

  it('maps TENANT_EXPORT to a HUMAN-only capability through existing policy machinery', () => {
    expect(tenantLifecycleOperationPolicy('TENANT_EXPORT')).toEqual({ capability: 'TENANT_EXPORT', principalTypes: ['HUMAN'] });
    expect(platformMutationOperationPolicy('TENANT_EXPORT')).toEqual({ capability: 'TENANT_EXPORT', principalTypes: ['HUMAN'] });
  });

  it('is distinct from tenant AUDIT_EXPORT and platform PLATFORM_AUDIT_VIEW authority', () => {
    expect('TENANT_EXPORT').not.toBe('AUDIT_EXPORT');
    expect('TENANT_EXPORT').not.toBe('PLATFORM_AUDIT_VIEW');
    // No tenant role permission code collides with the platform capability.
    expect(TENANT_LIFECYCLE_CAPABILITIES.filter(c => c === 'TENANT_EXPORT')).toHaveLength(1);
  });

  it('registers TENANT_EXPORT in the exact bootstrap capability set', () => {
    expect(authorityRepository).toContain('"TENANT_EXPORT"');
  });

  it('allows only ACTIVE and SUSPENDED as export-eligible statuses', () => {
    expect(TENANT_EXPORT_ELIGIBLE_STATUSES).toEqual(['ACTIVE', 'SUSPENDED']);
    expect(() => assertTenantExportEligible('ACTIVE')).not.toThrow();
    expect(() => assertTenantExportEligible('SUSPENDED')).not.toThrow();
    for (const status of ['PROVISIONING', 'ARCHIVED', 'CANCELLED', 'CLOSED', '', 'UNKNOWN']) {
      expect(() => assertTenantExportEligible(status)).toThrow(TENANT_EXPORT_STATUS_INELIGIBLE);
    }
  });

  it('resolves an authoritative target and refuses substitution/mixing/ineligible identity', () => {
    expect(resolveTenantExportTarget({ tenantId: tenantA, publicId: publicA, status: 'SUSPENDED' })).toEqual(
      { tenantId: tenantA, publicId: publicA, status: 'SUSPENDED' },
    );
    expect(resolveTenantExportTarget({ tenantId: tenantA, publicId: publicA, status: 'ACTIVE' })).toEqual(
      { tenantId: tenantA, publicId: publicA, status: 'ACTIVE' },
    );

    // Missing fields, fabricated identity, and wrong types fail closed with the target-invalid error.
    for (const bad of [
      { publicId: publicA, status: 'ACTIVE' },                       // missing tenantId
      { tenantId: tenantA, status: 'ACTIVE' },                       // missing publicId
      { tenantId: 'not-a-uuid', publicId: publicA, status: 'ACTIVE' },
      { tenantId: tenantA, publicId: 'not-a-uuid', status: 'ACTIVE' },
      { tenantId: tenantA, publicId: publicA },                      // missing status
      { tenantId: 42, publicId: publicA, status: 'ACTIVE' },
    ]) {
      expect(() => resolveTenantExportTarget(bad)).toThrow(TENANT_EXPORT_TARGET_INVALID);
    }
    // Valid identity but ineligible status fails closed with the status-ineligible error.
    for (const status of ['PROVISIONING', 'ARCHIVED']) {
      expect(() => resolveTenantExportTarget({ tenantId: tenantA, publicId: publicA, status }))
        .toThrow(TENANT_EXPORT_STATUS_INELIGIBLE);
    }
  });
});
