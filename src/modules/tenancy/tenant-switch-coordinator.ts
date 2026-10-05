import type { StaffSessionLifecycle } from '../auth/staff-session-regeneration.js';
import { establishStaffSession } from '../auth/staff-session-regeneration.js';
import { createActiveTenantSessionContext } from './staff-login-organisation-orchestration.js';
import type { ActiveTenantContextService } from './active-tenant-context.service.js';
import type {
  ActiveTenantSessionContext,
  TenantContextDecision,
  ValidActiveTenantContext,
} from './active-tenant-context.types.js';
import type { PostgresTenantSwitchAdvisoryLock } from './tenant-switch-advisory-lock.js';
import type {
  ExpectedTenantContextToken,
  TenantSwitchResultContract,
  TenantSwitchRejectionReason,
} from './tenant-switch-contracts.js';
import type { TenantSwitchPersistenceRepository } from './tenant-switch-persistence.repository.js';
import type { TenantSwitchTokenCodec } from './tenant-switch-token.js';

type TenantSwitchAuthority = Pick<
  ActiveTenantContextService,
  'resolveTenantSelection' | 'revalidateStoredContext'
>;
type TenantSwitchLock = Pick<PostgresTenantSwitchAdvisoryLock, 'withUserLock'>;
type TenantSwitchPersistence = Pick<
  TenantSwitchPersistenceRepository,
  'createPending' | 'finalizeSwitched' | 'finalizeRejected' | 'finalizeFailed'
>;
type EstablishSession = typeof establishStaffSession;

export interface TenantSwitchSessionLifecycle<TUser>
  extends StaffSessionLifecycle<TUser> {
  getSessionId(): string;
  reload(): Promise<void>;
}

export interface TenantSwitchCoordinatorDependencies {
  readonly tenantContextService: TenantSwitchAuthority;
  readonly advisoryLock: TenantSwitchLock;
  readonly persistence: TenantSwitchPersistence;
  readonly tokenCodec: TenantSwitchTokenCodec;
  readonly clock: () => number;
  readonly idFactory: () => string;
  readonly establishSession?: EstablishSession;
}

export interface TenantSwitchCoordinatorInput<TUser extends Readonly<{ id: string }>> {
  readonly user: TUser;
  readonly tenantPublicId: string;
  readonly expectedContextToken: ExpectedTenantContextToken;
  readonly sessionLifecycle: TenantSwitchSessionLifecycle<TUser>;
}

const rejected = (): TenantSwitchResultContract =>
  Object.freeze({ outcome: 'REJECTED', message: 'Organisation unavailable' });
const failed = (): TenantSwitchResultContract =>
  Object.freeze({
    outcome: 'FAILED',
    message: 'Organisation switching is temporarily unavailable',
  });

function sameTarget(
  context: ActiveTenantSessionContext | undefined,
  tenantId: string,
  membershipId: string,
): boolean {
  return Boolean(
    context &&
      (context.tenantId === tenantId || context.membershipId === membershipId),
  );
}

function matchingValidatedTarget(
  decision: TenantContextDecision,
  userId: string,
  tenantPublicId: string,
  tenantId: string,
  membershipId: string,
): decision is ValidActiveTenantContext {
  return Boolean(
    decision.state === 'VALID_ACTIVE_TENANT' &&
      decision.tenant.publicId === tenantPublicId &&
      decision.tenant.id === tenantId &&
      decision.membership.id === membershipId &&
      decision.membership.userId === userId &&
      decision.membership.tenantId === tenantId,
  );
}

async function containFailure<TUser>(
  lifecycle: TenantSwitchSessionLifecycle<TUser>,
): Promise<void> {
  try {
    lifecycle.clearRequestUser();
  } catch {
    // Continue containment when in-memory request cleanup fails.
  }
  try {
    delete lifecycle.getSession().activeTenantContext;
  } catch {
    // Continue to durable session invalidation.
  }
  try {
    await lifecycle.invalidate();
  } catch {
    // Uncertain invalidation must remain a failed result.
  }
}

export class TenantSwitchCoordinator {
  private readonly establishSession: EstablishSession;

  constructor(private readonly dependencies: TenantSwitchCoordinatorDependencies) {
    this.establishSession = dependencies.establishSession ?? establishStaffSession;
  }

  async switchTenant<TUser extends Readonly<{ id: string }>>(
    input: TenantSwitchCoordinatorInput<TUser>,
  ): Promise<TenantSwitchResultContract> {
    const userId = input.user.id;
    const tenantPublicId = input.tenantPublicId.trim();
    if (!userId || !tenantPublicId) return rejected();

    let preliminary;

    try {
      preliminary = await this.dependencies.tenantContextService.resolveTenantSelection(
        userId,
        tenantPublicId,
      );
    } catch {
      return failed();
    }
    if (!preliminary.available) return rejected();
    if (
      sameTarget(
        input.sessionLifecycle.getSession().activeTenantContext,
        preliminary.candidate.tenantId,
        preliminary.candidate.membershipId,
      )
    ) {
      return rejected();
    }

    try {
      return await this.dependencies.advisoryLock.withUserLock(userId, async () =>
        this.switchUnderLock(input, tenantPublicId),
      );
    } catch {
      return failed();
    }
  }

  private async switchUnderLock<TUser extends Readonly<{ id: string }>>(
    input: TenantSwitchCoordinatorInput<TUser>,
    tenantPublicId: string,
  ): Promise<TenantSwitchResultContract> {
    const { user, sessionLifecycle } = input;
    const userId = user.id;

    try {
      await sessionLifecycle.reload();
    } catch {
      return rejected();
    }

    const oldSessionId = sessionLifecycle.getSessionId();
    const stored = sessionLifecycle.getSession().activeTenantContext;
    if (!oldSessionId || !stored) return rejected();
    if (
      !this.dependencies.tokenCodec.verifyExpectedContextToken(
        input.expectedContextToken,
        { authenticatedUserId: userId, context: stored },
      )
    ) {
      return rejected();
    }

    let current: TenantContextDecision;
    try {
      current = await this.dependencies.tenantContextService.revalidateStoredContext(
        userId,
        stored,
      );
    } catch {
      return failed();
    }
    if (current.state !== 'VALID_ACTIVE_TENANT') return rejected();

    const requestCorrelation = this.dependencies.tokenCodec.createCorrelationHash(
      'REQUEST',
      JSON.stringify([
        userId,
        oldSessionId,
        input.expectedContextToken,
        tenantPublicId,
      ]),
    );
    const previousSessionCorrelation =
      this.dependencies.tokenCodec.createCorrelationHash('SESSION', oldSessionId);

    let targetResolution;
    try {
      targetResolution =
        await this.dependencies.tenantContextService.resolveTenantSelection(
          userId,
          tenantPublicId,
        );
    } catch {
      return failed();
    }
    if (!targetResolution.available) {
      return this.rejectWithAudit(
        userId,
        tenantPublicId,
        'ORGANISATION_UNAVAILABLE',
        current,
        requestCorrelation,
        previousSessionCorrelation,
      );
    }
    if (
      current.tenant.id === targetResolution.candidate.tenantId ||
      current.membership.id === targetResolution.candidate.membershipId
    ) {
      return this.rejectWithAudit(
        userId,
        tenantPublicId,
        'SAME_ORGANISATION',
        current,
        requestCorrelation,
        previousSessionCorrelation,
        targetResolution.candidate,
      );
    }

    const selectedAt = this.dependencies.clock();
    const provisional: ActiveTenantSessionContext = Object.freeze({
      tenantId: targetResolution.candidate.tenantId,
      membershipId: targetResolution.candidate.membershipId,
      contextVersion: 1,
      selectedAt,
      validatedAt: selectedAt,
    });
    let target: TenantContextDecision;
    try {
      target = await this.dependencies.tenantContextService.revalidateStoredContext(
        userId,
        provisional,
      );
    } catch {
      return failed();
    }
    if (
      !matchingValidatedTarget(
        target,
        userId,
        tenantPublicId,
        targetResolution.candidate.tenantId,
        targetResolution.candidate.membershipId,
      )
    ) {
      return this.rejectWithAudit(
        userId,
        tenantPublicId,
        'ORGANISATION_UNAVAILABLE',
        current,
        requestCorrelation,
        previousSessionCorrelation,
        targetResolution.candidate,
      );
    }

    const attemptId = this.dependencies.idFactory();
    try {
      const pending = await this.dependencies.persistence.createPending({
        attemptId,
        actorUserId: userId,
        previousTenantId: current.tenant.id,
        previousMembershipId: current.membership.id,
        targetTenantId: target.tenant.id,
        targetMembershipId: target.membership.id,
        requestCorrelation,
        previousSessionCorrelation,
        occurredAt: new Date(this.dependencies.clock()),
      });
      if (!pending.created) return rejected();
    } catch {
      return failed();
    }

    let failureCategory: 'SESSION_PERSISTENCE' | 'AUDIT_PERSISTENCE' = 'SESSION_PERSISTENCE';

    try {
      await this.establishSession(sessionLifecycle, user, this.dependencies.clock);
      const regeneratedSessionId = sessionLifecycle.getSessionId();
      if (!regeneratedSessionId || regeneratedSessionId === oldSessionId) {
        throw new Error('uncertified regenerated session');
      }
      const context = createActiveTenantSessionContext(target, selectedAt);
      sessionLifecycle.getSession().activeTenantContext = context;
      await sessionLifecycle.save();
      const regeneratedSessionCorrelation =
        this.dependencies.tokenCodec.createCorrelationHash(
          'SESSION',
          regeneratedSessionId,
        );
      failureCategory = 'AUDIT_PERSISTENCE';
      await this.dependencies.persistence.finalizeSwitched({
        attemptId,
        actorUserId: userId,
        eventId: this.dependencies.idFactory(),
        regeneratedSessionCorrelation,
        finalizedAt: new Date(this.dependencies.clock()),
      });
      return Object.freeze({ outcome: 'SWITCHED', destination: '/', context });
    } catch {
      await containFailure(sessionLifecycle);
      try {
        await this.dependencies.persistence.finalizeFailed({
          attemptId,
          actorUserId: userId,
          failureCategory,
          finalizedAt: new Date(this.dependencies.clock()),
        });
      } catch {
        // PENDING evidence remains when FAILED finalization cannot be certified.
      }
      return failed();
    }
  }

  private async rejectWithAudit(
    userId: string,
    tenantPublicId: string,
    reason: TenantSwitchRejectionReason,
    current: ValidActiveTenantContext,
    requestCorrelation: ReturnType<TenantSwitchTokenCodec['createCorrelationHash']>,
    previousSessionCorrelation: ReturnType<
      TenantSwitchTokenCodec['createCorrelationHash']
    >,
    resolvedTarget?: Readonly<{ tenantId: string; membershipId: string }>,
  ): Promise<TenantSwitchResultContract> {
    const attemptId = this.dependencies.idFactory();
    const rejectedTarget = this.dependencies.tokenCodec.createRejectedTargetMetadata(
      tenantPublicId,
      reason,
    );
    try {
      const pending = await this.dependencies.persistence.createPending({
        attemptId,
        actorUserId: userId,
        previousTenantId: current.tenant.id,
        previousMembershipId: current.membership.id,
        ...(resolvedTarget
          ? {
              targetTenantId: resolvedTarget.tenantId,
              targetMembershipId: resolvedTarget.membershipId,
            }
          : {}),
        rejectedTarget,
        requestCorrelation,
        previousSessionCorrelation,
        occurredAt: new Date(this.dependencies.clock()),
      });
      if (!pending.created) return rejected();
      await this.dependencies.persistence.finalizeRejected({
        attemptId,
        actorUserId: userId,
        eventId: this.dependencies.idFactory(),
        finalizedAt: new Date(this.dependencies.clock()),
      });
      return rejected();
    } catch {
      return failed();
    }
  }
}
