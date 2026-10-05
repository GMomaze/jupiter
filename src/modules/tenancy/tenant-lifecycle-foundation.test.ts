import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { TENANT_LIFECYCLE_CAPABILITIES } from '../platform-authority/platform-authority.js';
import { platformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { platformMutationOperationPolicy } from '../platform-authority/platform-mutation-operation-policy.js';
import {
  acquireTenantLifecycleLock,
  acquireTenantWorkLock,
} from './tenant-lifecycle-coordination.js';
import {
  assertTenantLifecycleTransition,
  TENANT_LIFECYCLE_TRANSITIONS,
} from './tenant-lifecycle-contracts.js';
import {
  authorizeTenantLifecycleOperation,
  tenantLifecycleOperationPolicy,
  TENANT_LIFECYCLE_OPERATION_POLICY,
} from './tenant-lifecycle-policy.js';

const migration = fs.readFileSync('migrations/601_create_tenant_lifecycle_foundation.ts', 'utf8');
const tenantId = '60100000-0000-4000-8000-000000000001';
const migration601LifecycleCapabilities = ['TENANT_PROVISION', 'TENANT_ACTIVATE', 'TENANT_SUSPEND', 'TENANT_REINSTATE'] as const;

describe('L3-1 lifecycle capability and persistence foundation', () => {
  it('seeds exactly four locked 601 lifecycle capabilities without grants, principals, RLS, or tenant deletion', () => {
    for (const capability of migration601LifecycleCapabilities) {
      expect(migration.match(new RegExp(`\\['${capability}'`, 'g'))).toHaveLength(1);
    }
    expect(migration601LifecycleCapabilities).toHaveLength(4);
    expect(migration).toContain("'TENANT_LIFECYCLE',true,true");
    expect(migration).not.toMatch(/INSERT INTO platform_capability_grants|INSERT INTO platform_principals|ROW LEVEL SECURITY|CREATE POLICY/i);
    expect(migration).toContain('TENANT_DELETION_PROHIBITED');
    expect(migration).toContain('REVOKE DELETE ON TABLE public.tenants FROM jupiter_app');
  });

  it('recognizes later additive lifecycle capabilities from migrations 602 and 604', () => {
    expect([...TENANT_LIFECYCLE_CAPABILITIES]).toEqual([
      ...migration601LifecycleCapabilities,
      'TENANT_ADMIN_RECOVER',
      'TENANT_EXPORT',
    ]);
  });

  it('allows only the three defined state transitions and reserves ARCHIVED', () => {
    expect(TENANT_LIFECYCLE_TRANSITIONS).toEqual({
      TENANT_ACTIVATE: { from: 'PROVISIONING', to: 'ACTIVE' },
      TENANT_SUSPEND: { from: 'ACTIVE', to: 'SUSPENDED' },
      TENANT_REINSTATE: { from: 'SUSPENDED', to: 'ACTIVE' },
    });
    for (const transition of Object.values(TENANT_LIFECYCLE_TRANSITIONS)) {
      expect(() => assertTenantLifecycleTransition(transition.from, transition.to)).not.toThrow();
    }
    for (const [from, to] of [['ACTIVE', 'ARCHIVED'], ['SUSPENDED', 'PROVISIONING'], ['ACTIVE', 'ACTIVE']]) {
      expect(() => assertTenantLifecycleTransition(from!, to!)).toThrow('TENANT_LIFECYCLE_TRANSITION_PROHIBITED');
    }
  });

  it('maps every lifecycle operation to the same-named HUMAN-only capability and is immutable', () => {
    expect(Object.keys(TENANT_LIFECYCLE_OPERATION_POLICY)).toEqual([...TENANT_LIFECYCLE_CAPABILITIES]);
    for (const capability of TENANT_LIFECYCLE_CAPABILITIES) {
      expect(tenantLifecycleOperationPolicy(capability)).toEqual({ capability, principalTypes: ['HUMAN'] });
      expect(platformMutationOperationPolicy(capability)).toEqual({ capability, principalTypes: ['HUMAN'] });
    }
    expect(() => tenantLifecycleOperationPolicy('TENANT_DELETE')).toThrow('UNKNOWN_TENANT_LIFECYCLE_OPERATION');
    expect(() => (TENANT_LIFECYCLE_OPERATION_POLICY.TENANT_SUSPEND[1] as any).push('SERVICE')).toThrow(TypeError);
  });

  it('reuses repository-issued Level-2 authority and live capability revalidation', async () => {
    const calls: string[] = [];
    const query = vi.fn(async (sql: string) => {
      calls.push(sql);
      if (sql.includes('FROM platform_principals pp LEFT JOIN')) {
        return { rows: [{ id: 'principal', principal_type: 'HUMAN', principal_code: 'user', capabilities: ['TENANT_SUSPEND'] }], rowCount: 1 };
      }
      if (sql.includes('JOIN platform_capability_grants')) return { rows: [{}], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const client = { query, release: vi.fn() };
    const repository = new PlatformAuthorityRepository({ query, connect: vi.fn(async () => client) } as any);
    const authority = await repository.resolveHuman('user');
    await expect(authorizeTenantLifecycleOperation(repository, authority, 'TENANT_SUSPEND')).resolves.toBeUndefined();
    expect(platformMutationEvidence(authority, ['TENANT_SUSPEND'], {
      reason: 'L3 foundation integration',
      correlationId: tenantId,
      source: { kind: 'TEST' },
      resourceType: 'tenant',
      resourceId: tenantId,
    }).operations).toEqual(['TENANT_SUSPEND']);
    expect(calls).toEqual(expect.arrayContaining(['BEGIN', 'COMMIT']));
    await expect(authorizeTenantLifecycleOperation(repository, { tenantId }, 'TENANT_SUSPEND')).rejects.toThrow('PLATFORM_AUTHORITY_REQUIRED');
  });

  it('uses one tenant-keyed transaction lock namespace with shared work and exclusive lifecycle modes', async () => {
    const query = vi.fn(async () => undefined);
    const executor = { query };
    await acquireTenantWorkLock(executor, tenantId);
    await acquireTenantLifecycleLock(executor, tenantId);
    expect(query.mock.calls[0]?.[0]).toContain('pg_advisory_xact_lock_shared');
    expect(query.mock.calls[1]?.[0]).toContain('pg_advisory_xact_lock(');
    expect(query.mock.calls[0]?.[0]).toContain('7290185754895614303');
    expect(query.mock.calls[1]?.[0]).toContain('7290185754895614303');
    expect(query.mock.calls[0]?.[1]).toEqual({ replacements: { tenantId } });
    expect(query.mock.calls[1]?.[1]).toEqual({ replacements: { tenantId } });
    await expect(acquireTenantWorkLock(executor, 'not-a-tenant')).rejects.toThrow('TENANT_LIFECYCLE_LOCK_KEY_INVALID');
  });

  it('guards DOWN after grants/audit and incompatible tenant states', () => {
    expect(migration).toContain('MIGRATION_601_DOWN_REFUSES_INCONSISTENT_SEEDS');
    expect(migration).toContain('MIGRATION_601_DOWN_REFUSES_LIFECYCLE_EVIDENCE');
    expect(migration).toContain('MIGRATION_601_DOWN_REFUSES_INCOMPATIBLE_TENANT_STATE');
  });
});
