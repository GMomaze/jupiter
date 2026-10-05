import { describe, expect, it } from 'vitest';
import {
  ActiveTenantContextService,
  type ActiveTenantContextRepository,
} from './active-tenant-context.service.js';
import type {
  ActiveTenantSessionContext,
  TenantContextMembershipStatus,
  TenantContextTenantStatus,
  TenantMembershipRelationship,
} from './active-tenant-context.types.js';

const stored: ActiveTenantSessionContext = {
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  contextVersion: 1,
  selectedAt: 100,
  validatedAt: 101,
};

function relationship(
  membershipStatus: TenantContextMembershipStatus = 'ACTIVE',
  tenantStatus: TenantContextTenantStatus = 'ACTIVE',
  overrides: Partial<{
    membershipId: string;
    membershipTenantId: string;
    userId: string;
    tenantId: string;
    publicId: string;
  }> = {}
): TenantMembershipRelationship {
  return {
    membership: {
      id: overrides.membershipId ?? 'membership-1',
      tenantId: overrides.membershipTenantId ?? 'tenant-1',
      userId: overrides.userId ?? 'user-1',
      status: membershipStatus,
    },
    tenant: {
      id: overrides.tenantId ?? 'tenant-1',
      publicId: overrides.publicId ?? 'public-1',
      code: 'ORG_ONE',
      displayName: 'Organisation One',
      status: tenantStatus,
    },
  };
}

function repository(overrides: Partial<ActiveTenantContextRepository> = {}): ActiveTenantContextRepository {
  return {
    findStoredMembershipRelationship: async () => relationship(),
    listMembershipRelationshipsForUser: async () => [relationship()],
    findMembershipRelationshipForUserAndTenantPublicId: async () => relationship(),
    ...overrides,
  };
}

describe('ActiveTenantContextService dormant decisions', () => {
  it('returns a readonly valid context with deterministic validatedAt', async () => {
    const calls: Array<readonly [string, string]> = [];
    const service = new ActiveTenantContextService(repository({
      findStoredMembershipRelationship: async (userId, membershipId) => {
        calls.push([userId, membershipId]);
        return relationship();
      },
    }), () => 123456);
    const result = await service.revalidateStoredContext('user-1', stored);

    expect(result).toEqual({
      state: 'VALID_ACTIVE_TENANT',
      tenant: {
        id: 'tenant-1', publicId: 'public-1', code: 'ORG_ONE',
        displayName: 'Organisation One', status: 'ACTIVE',
      },
      membership: {
        id: 'membership-1', tenantId: 'tenant-1', userId: 'user-1', status: 'ACTIVE',
      },
      validatedAt: 123456,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.state === 'VALID_ACTIVE_TENANT' && Object.isFrozen(result.tenant)).toBe(true);
    expect(result.state === 'VALID_ACTIVE_TENANT' && Object.isFrozen(result.membership)).toBe(true);
    expect(calls).toEqual([['user-1', 'membership-1']]);
  });

  it.each([
    ['missing membership', null, 'STALE_MEMBERSHIP'],
    ['wrong user', relationship('ACTIVE', 'ACTIVE', { userId: 'user-2' }), 'STALE_MEMBERSHIP'],
    ['wrong membership id', relationship('ACTIVE', 'ACTIVE', { membershipId: 'membership-2' }), 'STALE_MEMBERSHIP'],
    ['wrong membership tenant', relationship('ACTIVE', 'ACTIVE', { membershipTenantId: 'tenant-2' }), 'STALE_MEMBERSHIP'],
    ['wrong tenant identity', relationship('ACTIVE', 'ACTIVE', { tenantId: 'tenant-2' }), 'STALE_MEMBERSHIP'],
    ['invited membership', relationship('INVITED'), 'NO_TENANT_CONTEXT'],
    ['suspended membership', relationship('SUSPENDED'), 'SUSPENDED_MEMBERSHIP'],
    ['disabled membership', relationship('DISABLED'), 'DISABLED_MEMBERSHIP'],
    ['provisioning tenant', relationship('ACTIVE', 'PROVISIONING'), 'PROVISIONING_TENANT'],
    ['suspended tenant', relationship('ACTIVE', 'SUSPENDED'), 'SUSPENDED_TENANT'],
    ['archived tenant', relationship('ACTIVE', 'ARCHIVED'), 'ARCHIVED_TENANT'],
  ])('classifies %s without returning operational context', async (_label, value, state) => {
    const service = new ActiveTenantContextService(
      repository({ findStoredMembershipRelationship: async () => value }),
      () => 999
    );
    const result = await service.revalidateStoredContext('user-1', stored);
    expect(result).toEqual({ state });
    expect('tenant' in result).toBe(false);
    expect('membership' in result).toBe(false);
  });

  it('filters eligible memberships by authenticated user and active relationship', async () => {
    const service = new ActiveTenantContextService(repository({
      listMembershipRelationshipsForUser: async () => [
        relationship(),
        relationship('ACTIVE', 'ACTIVE', { membershipId: 'foreign', userId: 'user-2' }),
        relationship('INVITED'),
        relationship('SUSPENDED'),
        relationship('ACTIVE', 'SUSPENDED'),
        relationship('ACTIVE', 'ACTIVE', { membershipId: 'mismatch', membershipTenantId: 'tenant-2' }),
      ],
    }), () => 1);
    const result = await service.listEligibleMemberships('user-1');
    expect(result).toEqual([{
      membershipId: 'membership-1', tenantId: 'tenant-1', tenantPublicId: 'public-1',
      tenantCode: 'ORG_ONE', tenantDisplayName: 'Organisation One',
    }]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([
    ['foreign membership', relationship('ACTIVE', 'ACTIVE', { userId: 'user-2' })],
    ['inactive membership', relationship('SUSPENDED')],
    ['inactive tenant', relationship('ACTIVE', 'SUSPENDED')],
    ['relationship mismatch', relationship('ACTIVE', 'ACTIVE', { membershipTenantId: 'tenant-2' })],
    ['nonexistent public id', null],
  ])('collapses %s selection to the same neutral rejection', async (_label, value) => {
    const service = new ActiveTenantContextService(repository({
      findMembershipRelationshipForUserAndTenantPublicId: async () => value,
    }), () => 1);
    await expect(service.resolveTenantSelection('user-1', 'requested-public')).resolves.toEqual({
      available: false,
    });
  });

  it('resolves selection only through the authenticated user repository contract', async () => {
    const calls: Array<readonly [string, string]> = [];
    const service = new ActiveTenantContextService(repository({
      findMembershipRelationshipForUserAndTenantPublicId: async (userId, publicId) => {
        calls.push([userId, publicId]);
        return relationship();
      },
    }), () => 1);
    const result = await service.resolveTenantSelection('user-1', ' public-1 ');
    expect(calls).toEqual([['user-1', 'public-1']]);
    expect(result).toEqual({ available: true, candidate: expect.objectContaining({ tenantPublicId: 'public-1' }) });
  });

  it('decides zero, one, and multiple eligible membership flows without side effects', () => {
    const service = new ActiveTenantContextService(repository(), () => 1);
    const candidate = {
      membershipId: 'm1', tenantId: 't1', tenantPublicId: 'p1',
      tenantCode: 'ONE', tenantDisplayName: 'One',
    } as const;
    expect(service.decideEligibleMemberships([])).toEqual({
      kind: 'NONE', state: 'NO_TENANT_CONTEXT', candidates: [],
    });
    expect(service.decideEligibleMemberships([candidate])).toEqual({
      kind: 'SINGLE', candidate, candidates: [candidate],
    });
    expect(service.decideEligibleMemberships([candidate, { ...candidate, membershipId: 'm2' }])).toEqual({
      kind: 'MULTIPLE', candidates: [candidate, { ...candidate, membershipId: 'm2' }],
    });
  });
});
