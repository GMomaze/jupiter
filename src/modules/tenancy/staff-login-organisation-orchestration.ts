import type { StaffSessionLifecycle } from '../auth/staff-session-regeneration.js';
import { establishStaffSession } from '../auth/staff-session-regeneration.js';
import type {
  ActiveTenantContextService,
  TenantContextClock,
} from './active-tenant-context.service.js';
import type {
  ActiveTenantSessionContext,
  EligibleTenantCandidate,
  ValidActiveTenantContext,
} from './active-tenant-context.types.js';

type OrganisationDecisionService = Pick<
  ActiveTenantContextService,
  'listEligibleMemberships' | 'decideEligibleMemberships' | 'revalidateStoredContext'
>;

type EstablishStaffSession = typeof establishStaffSession;

export interface StaffLoginOrganisationDependencies {
  readonly tenantContextService: OrganisationDecisionService;
  readonly clock: TenantContextClock;
  readonly establishSession?: EstablishStaffSession;
}

export type StaffLoginOrganisationOutcome =
  | Readonly<{ kind: 'ORGANISATION_UNAVAILABLE' }>
  | Readonly<{
      kind: 'ORGANISATION_ESTABLISHED';
      context: ActiveTenantSessionContext;
    }>
  | Readonly<{
      kind: 'ORGANISATION_SELECTION_REQUIRED';
      candidates: readonly EligibleTenantCandidate[];
    }>;

export const STAFF_ORGANISATION_ESTABLISHMENT_ERROR =
  'Staff organisation establishment failed.';

const unavailable = (): StaffLoginOrganisationOutcome =>
  Object.freeze({ kind: 'ORGANISATION_UNAVAILABLE' });

export function createActiveTenantSessionContext(
  valid: ValidActiveTenantContext,
  selectedAt: number,
): ActiveTenantSessionContext {
  if (valid.membership.tenantId !== valid.tenant.id) {
    throw new Error(STAFF_ORGANISATION_ESTABLISHMENT_ERROR);
  }

  return Object.freeze({
    tenantId: valid.tenant.id,
    membershipId: valid.membership.id,
    contextVersion: 1,
    selectedAt,
    validatedAt: valid.validatedAt,
  });
}

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

async function invalidateUncertainSession<TUser>(
  lifecycle: StaffSessionLifecycle<TUser>,
): Promise<void> {
  try {
    lifecycle.clearRequestUser();
  } catch {
    // Continue with invalidation when in-memory cleanup fails.
  }

  try {
    await lifecycle.invalidate();
  } catch {
    // The orchestration still returns only the stable failed outcome.
  }
}

async function cleanFailedContextSave<TUser>(
  lifecycle: StaffSessionLifecycle<TUser>,
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

export async function orchestrateStaffLoginOrganisation<
  TUser extends Readonly<{ id: string }>,
>(
  input: Readonly<{
    user: TUser;
    sessionLifecycle: StaffSessionLifecycle<TUser>;
  }>,
  dependencies: StaffLoginOrganisationDependencies,
): Promise<StaffLoginOrganisationOutcome> {
  const establishSession = dependencies.establishSession ?? establishStaffSession;
  await establishSession(input.sessionLifecycle, input.user, dependencies.clock);

  let eligible: readonly EligibleTenantCandidate[];
  try {
    eligible = await dependencies.tenantContextService.listEligibleMemberships(
      input.user.id,
    );
  } catch {
    throw new Error(STAFF_ORGANISATION_ESTABLISHMENT_ERROR);
  }

  const decision = dependencies.tenantContextService.decideEligibleMemberships(eligible);
  if (decision.kind === 'NONE') {
    return unavailable();
  }

  if (decision.kind === 'MULTIPLE') {
    return Object.freeze({
      kind: 'ORGANISATION_SELECTION_REQUIRED',
      candidates: Object.freeze([...decision.candidates]),
    });
  }

  const selectedAt = dependencies.clock();
  const provisionalContext: ActiveTenantSessionContext = Object.freeze({
    tenantId: decision.candidate.tenantId,
    membershipId: decision.candidate.membershipId,
    contextVersion: 1,
    selectedAt,
    validatedAt: selectedAt,
  });

  let validated: Awaited<
    ReturnType<OrganisationDecisionService['revalidateStoredContext']>
  >;
  try {
    validated = await dependencies.tenantContextService.revalidateStoredContext(
      input.user.id,
      provisionalContext,
    );
  } catch {
    throw new Error(STAFF_ORGANISATION_ESTABLISHMENT_ERROR);
  }

  if (
    validated.state !== 'VALID_ACTIVE_TENANT' ||
    validated.tenant.id !== decision.candidate.tenantId ||
    validated.membership.id !== decision.candidate.membershipId ||
    validated.membership.userId !== input.user.id ||
    validated.membership.tenantId !== decision.candidate.tenantId
  ) {
    return unavailable();
  }

  let context: ActiveTenantSessionContext;
  try {
    context = createActiveTenantSessionContext(validated, selectedAt);
    input.sessionLifecycle.getSession().activeTenantContext = context;
    await input.sessionLifecycle.save();
  } catch {
    if (typeof context! !== 'undefined') {
      await cleanFailedContextSave(input.sessionLifecycle, context!);
    }
    throw new Error(STAFF_ORGANISATION_ESTABLISHMENT_ERROR);
  }

  return Object.freeze({ kind: 'ORGANISATION_ESTABLISHED', context });
}
