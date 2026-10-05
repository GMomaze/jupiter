import type {
  ActiveTenantSessionContext,
  EligibleMembershipDecision,
  EligibleTenantCandidate,
  InvalidTenantContextState,
  TenantContextDecision,
  TenantMembershipRelationship,
  TenantSelectionResolution,
  ValidActiveTenantContext,
} from './active-tenant-context.types.js';

export interface ActiveTenantContextRepository {
  findStoredMembershipRelationship(
    userId: string,
    membershipId: string
  ): Promise<TenantMembershipRelationship | null>;
  listMembershipRelationshipsForUser(
    userId: string
  ): Promise<readonly TenantMembershipRelationship[]>;
  findMembershipRelationshipForUserAndTenantPublicId(
    userId: string,
    tenantPublicId: string
  ): Promise<TenantMembershipRelationship | null>;
}

export type TenantContextClock = () => number;

const invalid = (state: InvalidTenantContextState): TenantContextDecision => Object.freeze({ state });

function eligibleCandidate(
  relationship: TenantMembershipRelationship
): EligibleTenantCandidate | null {
  const { membership, tenant } = relationship;
  if (!tenant || membership.status !== 'ACTIVE' || tenant.status !== 'ACTIVE') return null;
  if (membership.tenantId !== tenant.id) return null;

  return Object.freeze({
    membershipId: membership.id,
    tenantId: tenant.id,
    tenantPublicId: tenant.publicId,
    tenantCode: tenant.code,
    tenantDisplayName: tenant.displayName,
  });
}

export class ActiveTenantContextService {
  constructor(
    private readonly repository: ActiveTenantContextRepository,
    private readonly clock: TenantContextClock
  ) {}

  async revalidateStoredContext(
    authenticatedUserId: string,
    stored: ActiveTenantSessionContext
  ): Promise<TenantContextDecision> {
    const relationship = await this.repository.findStoredMembershipRelationship(
      authenticatedUserId,
      stored.membershipId
    );
    if (!relationship) return invalid('STALE_MEMBERSHIP');

    const { membership, tenant } = relationship;
    if (
      membership.userId !== authenticatedUserId ||
      membership.id !== stored.membershipId ||
      membership.tenantId !== stored.tenantId ||
      !tenant ||
      tenant.id !== stored.tenantId
    ) {
      return invalid('STALE_MEMBERSHIP');
    }

    if (membership.status === 'INVITED') return invalid('NO_TENANT_CONTEXT');
    if (membership.status === 'SUSPENDED') return invalid('SUSPENDED_MEMBERSHIP');
    if (membership.status === 'DISABLED') return invalid('DISABLED_MEMBERSHIP');
    if (tenant.status === 'PROVISIONING') return invalid('PROVISIONING_TENANT');
    if (tenant.status === 'SUSPENDED') return invalid('SUSPENDED_TENANT');
    if (tenant.status === 'ARCHIVED') return invalid('ARCHIVED_TENANT');

    const context: ValidActiveTenantContext = Object.freeze({
      state: 'VALID_ACTIVE_TENANT',
      tenant: Object.freeze({
        id: tenant.id,
        publicId: tenant.publicId,
        code: tenant.code,
        displayName: tenant.displayName,
        status: 'ACTIVE',
      }),
      membership: Object.freeze({
        id: membership.id,
        tenantId: membership.tenantId,
        userId: membership.userId,
        status: 'ACTIVE',
      }),
      validatedAt: this.clock(),
    });
    return context;
  }

  async listEligibleMemberships(userId: string): Promise<readonly EligibleTenantCandidate[]> {
    const relationships = await this.repository.listMembershipRelationshipsForUser(userId);
    const candidates = relationships.flatMap(relationship => {
      if (relationship.membership.userId !== userId) return [];
      const candidate = eligibleCandidate(relationship);
      return candidate ? [candidate] : [];
    });
    return Object.freeze(candidates);
  }

  async resolveTenantSelection(
    authenticatedUserId: string,
    requestedTenantPublicId: string
  ): Promise<TenantSelectionResolution> {
    const publicId = requestedTenantPublicId.trim();
    if (!publicId) return Object.freeze({ available: false });

    const relationship =
      await this.repository.findMembershipRelationshipForUserAndTenantPublicId(
        authenticatedUserId,
        publicId
      );
    if (!relationship || relationship.membership.userId !== authenticatedUserId) {
      return Object.freeze({ available: false });
    }
    const candidate = eligibleCandidate(relationship);
    return candidate
      ? Object.freeze({ available: true, candidate })
      : Object.freeze({ available: false });
  }

  decideEligibleMemberships(
    eligibleMemberships: readonly EligibleTenantCandidate[]
  ): EligibleMembershipDecision {
    const candidates = Object.freeze([...eligibleMemberships]);
    if (candidates.length === 0) {
      const none = Object.freeze([]) as readonly [];
      return Object.freeze({ kind: 'NONE', state: 'NO_TENANT_CONTEXT', candidates: none });
    }
    if (candidates.length === 1) {
      const candidate = candidates[0]!;
      const single = Object.freeze([candidate]) as readonly [EligibleTenantCandidate];
      return Object.freeze({
        kind: 'SINGLE',
        candidate,
        candidates: single,
      });
    }
    return Object.freeze({ kind: 'MULTIPLE', candidates });
  }
}
