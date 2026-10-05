import type { SessionData } from 'express-session';
import { createActiveTenantSessionContext } from './staff-login-organisation-orchestration.js';
import type {
  ActiveTenantContextService,
  TenantContextClock,
} from './active-tenant-context.service.js';
import type {
  ActiveTenantSessionContext,
  TenantContextDecision,
} from './active-tenant-context.types.js';

type SelectionAuthority = Pick<
  ActiveTenantContextService,
  'listEligibleMemberships' | 'resolveTenantSelection' | 'revalidateStoredContext'
>;

export interface OrganisationOption {
  readonly tenantPublicId: string;
  readonly tenantCode: string;
  readonly tenantDisplayName: string;
}

export interface OrganisationSessionLifecycle {
  getSession(): SessionData;
  save(): Promise<void>;
  clearRequestUser(): void;
  invalidate(): Promise<void>;
}

export type OrganisationSelectionResult =
  | Readonly<{ available: false }>
  | Readonly<{
      available: true;
      context: ActiveTenantSessionContext;
    }>;

export const ORGANISATION_SELECTION_ERROR = 'Organisation selection failed.';

const unavailable = (): OrganisationSelectionResult =>
  Object.freeze({ available: false });

function sameContext(
  current: ActiveTenantSessionContext | undefined,
  expected: ActiveTenantSessionContext,
): boolean {
  return Boolean(
    current &&
      current.tenantId === expected.tenantId &&
      current.membershipId === expected.membershipId &&
      current.contextVersion === expected.contextVersion &&
      current.selectedAt === expected.selectedAt &&
      current.validatedAt === expected.validatedAt,
  );
}

async function invalidateUncertainSession(
  lifecycle: OrganisationSessionLifecycle,
): Promise<void> {
  try {
    lifecycle.clearRequestUser();
  } catch {
    // Continue with session invalidation when request cleanup fails.
  }

  try {
    await lifecycle.invalidate();
  } catch {
    // Cleanup failure must remain a stable failed outcome.
  }
}

async function cleanFailedSave(
  lifecycle: OrganisationSessionLifecycle,
  context: ActiveTenantSessionContext,
): Promise<void> {
  try {
    const session = lifecycle.getSession();
    if (!sameContext(session.activeTenantContext, context)) {
      await invalidateUncertainSession(lifecycle);
      return;
    }

    delete session.activeTenantContext;
    try {
      await lifecycle.save();
    } catch {
      await invalidateUncertainSession(lifecycle);
    }
  } catch {
    await invalidateUncertainSession(lifecycle);
  }
}

export class OrganisationSelectionService {
  constructor(
    private readonly authority: SelectionAuthority,
    private readonly clock: TenantContextClock,
  ) {}

  async listOptions(userId: string): Promise<readonly OrganisationOption[]> {
    let candidates;
    try {
      candidates = await this.authority.listEligibleMemberships(userId);
    } catch {
      throw new Error(ORGANISATION_SELECTION_ERROR);
    }

    return Object.freeze(
      candidates.map((candidate) =>
        Object.freeze({
          tenantPublicId: candidate.tenantPublicId,
          tenantCode: candidate.tenantCode,
          tenantDisplayName: candidate.tenantDisplayName,
        }),
      ),
    );
  }

  async select(
    userId: string,
    tenantPublicId: string,
    lifecycle: OrganisationSessionLifecycle,
  ): Promise<OrganisationSelectionResult> {
    if (lifecycle.getSession().activeTenantContext) {
      return unavailable();
    }

    const requestedPublicId = tenantPublicId.trim();
    if (!requestedPublicId) return unavailable();

    let resolution;
    try {
      resolution = await this.authority.resolveTenantSelection(
        userId,
        requestedPublicId,
      );
    } catch {
      throw new Error(ORGANISATION_SELECTION_ERROR);
    }
    if (!resolution.available) return unavailable();

    const selectedAt = this.clock();
    const provisional: ActiveTenantSessionContext = Object.freeze({
      tenantId: resolution.candidate.tenantId,
      membershipId: resolution.candidate.membershipId,
      contextVersion: 1,
      selectedAt,
      validatedAt: selectedAt,
    });

    let validated: TenantContextDecision;
    try {
      validated = await this.authority.revalidateStoredContext(userId, provisional);
    } catch {
      throw new Error(ORGANISATION_SELECTION_ERROR);
    }

    if (
      validated.state !== 'VALID_ACTIVE_TENANT' ||
      validated.tenant.publicId !== requestedPublicId ||
      validated.tenant.id !== resolution.candidate.tenantId ||
      validated.membership.id !== resolution.candidate.membershipId ||
      validated.membership.userId !== userId ||
      validated.membership.tenantId !== resolution.candidate.tenantId
    ) {
      return unavailable();
    }

    let context: ActiveTenantSessionContext;
    try {
      context = createActiveTenantSessionContext(validated, selectedAt);
      lifecycle.getSession().activeTenantContext = context;
      await lifecycle.save();
    } catch {
      if (typeof context! !== 'undefined') {
        await cleanFailedSave(lifecycle, context!);
      }
      throw new Error(ORGANISATION_SELECTION_ERROR);
    }

    return Object.freeze({ available: true, context });
  }
}
