import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SessionData } from 'express-session';
import { describe, expect, it, vi } from 'vitest';
import type { StaffSessionLifecycle } from '../auth/staff-session-regeneration.js';
import { ActiveTenantContextService } from './active-tenant-context.service.js';
import type {
  EligibleTenantCandidate,
  TenantContextDecision,
} from './active-tenant-context.types.js';
import {
  STAFF_ORGANISATION_ESTABLISHMENT_ERROR,
  createActiveTenantSessionContext,
  orchestrateStaffLoginOrganisation,
} from './staff-login-organisation-orchestration.js';

type TestUser = { id: string; roles?: readonly string[] };

const candidate = Object.freeze({
  membershipId: 'membership-1',
  tenantId: 'tenant-1',
  tenantPublicId: 'public-1',
  tenantCode: 'ORG',
  tenantDisplayName: 'Organisation',
});

const validDecision = Object.freeze({
  state: 'VALID_ACTIVE_TENANT' as const,
  tenant: Object.freeze({
    id: 'tenant-1',
    publicId: 'public-1',
    code: 'ORG',
    displayName: 'Organisation',
    status: 'ACTIVE' as const,
  }),
  membership: Object.freeze({
    id: 'membership-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    status: 'ACTIVE' as const,
  }),
  validatedAt: 200,
});

function harness(candidates: readonly EligibleTenantCandidate[] = []) {
  let session = { customerUser: { marker: 'untouched' } } as unknown as SessionData;
  const events: string[] = [];
  const lifecycle: StaffSessionLifecycle<TestUser> = {
    getSession: vi.fn(() => session),
    regenerate: vi.fn(async () => undefined),
    login: vi.fn(async () => undefined),
    save: vi.fn(async () => {
      events.push(session.activeTenantContext ? 'save-context' : 'save-cleanup');
    }),
    invalidate: vi.fn(async () => {
      events.push('invalidate');
      session = {} as SessionData;
    }),
    clearRequestUser: vi.fn(() => events.push('clear-user')),
  };
  const service = {
    listEligibleMemberships: vi.fn(async () => candidates),
    decideEligibleMemberships: vi.fn((values: readonly EligibleTenantCandidate[]) => {
      if (values.length === 0) {
        return Object.freeze({ kind: 'NONE' as const, state: 'NO_TENANT_CONTEXT' as const, candidates: Object.freeze([]) as readonly [] });
      }
      if (values.length === 1) {
        return Object.freeze({ kind: 'SINGLE' as const, candidate: values[0]!, candidates: Object.freeze([values[0]!]) as readonly [EligibleTenantCandidate] });
      }
      return Object.freeze({ kind: 'MULTIPLE' as const, candidates: Object.freeze([...values]) });
    }),
    revalidateStoredContext: vi.fn(async () => validDecision as TenantContextDecision),
  };
  const establishSession = vi.fn(async () => events.push('establish'));
  const clock = vi.fn(() => 100);

  return {
    lifecycle,
    service,
    establishSession,
    clock,
    events,
    session: () => session,
  };
}

describe('staff login organisation orchestration', () => {
  it('establishes the staff session before user-scoped membership lookup', async () => {
    const h = harness();
    h.service.listEligibleMemberships.mockImplementationOnce(async (userId) => {
      h.events.push(`list:${userId}`);
      return [];
    });

    await orchestrateStaffLoginOrganisation(
      { user: { id: 'user-1' }, sessionLifecycle: h.lifecycle },
      { tenantContextService: h.service, clock: h.clock, establishSession: h.establishSession },
    );

    expect(h.events).toEqual(['establish', 'list:user-1']);
  });

  it('stops before lookup when staff-session establishment fails', async () => {
    const h = harness();
    h.establishSession.mockRejectedValueOnce(new Error('Staff session establishment failed.'));

    await expect(orchestrateStaffLoginOrganisation(
      { user: { id: 'user-1' }, sessionLifecycle: h.lifecycle },
      { tenantContextService: h.service, clock: h.clock, establishSession: h.establishSession },
    )).rejects.toThrow('Staff session establishment failed.');
    expect(h.service.listEligibleMemberships).not.toHaveBeenCalled();
  });

  it('returns unavailable with no context for zero memberships', async () => {
    const h = harness();

    const outcome = await orchestrateStaffLoginOrganisation(
      { user: { id: 'user-1' }, sessionLifecycle: h.lifecycle },
      { tenantContextService: h.service, clock: h.clock, establishSession: h.establishSession },
    );

    expect(outcome).toEqual({ kind: 'ORGANISATION_UNAVAILABLE' });
    expect(h.session().activeTenantContext).toBeUndefined();
    expect(h.lifecycle.save).not.toHaveBeenCalled();
  });

  it('returns immutable candidates and never selects from multiple memberships', async () => {
    const h = harness([candidate, { ...candidate, membershipId: 'membership-2', tenantId: 'tenant-2' }]);

    const outcome = await orchestrateStaffLoginOrganisation(
      { user: { id: 'user-1' }, sessionLifecycle: h.lifecycle },
      { tenantContextService: h.service, clock: h.clock, establishSession: h.establishSession },
    );

    expect(outcome.kind).toBe('ORGANISATION_SELECTION_REQUIRED');
    if (outcome.kind === 'ORGANISATION_SELECTION_REQUIRED') {
      expect(Object.isFrozen(outcome)).toBe(true);
      expect(Object.isFrozen(outcome.candidates)).toBe(true);
      expect(outcome.candidates).toHaveLength(2);
    }
    expect(h.service.revalidateStoredContext).not.toHaveBeenCalled();
    expect(h.session().activeTenantContext).toBeUndefined();
  });

  it('revalidates the exact single candidate and saves the minimal frozen context', async () => {
    const h = harness([candidate]);

    const outcome = await orchestrateStaffLoginOrganisation(
      { user: { id: 'user-1' }, sessionLifecycle: h.lifecycle },
      { tenantContextService: h.service, clock: h.clock, establishSession: h.establishSession },
    );

    expect(h.service.revalidateStoredContext).toHaveBeenCalledWith('user-1', {
      tenantId: 'tenant-1',
      membershipId: 'membership-1',
      contextVersion: 1,
      selectedAt: 100,
      validatedAt: 100,
    });
    expect(outcome).toEqual({
      kind: 'ORGANISATION_ESTABLISHED',
      context: {
        tenantId: 'tenant-1',
        membershipId: 'membership-1',
        contextVersion: 1,
        selectedAt: 100,
        validatedAt: 200,
      },
    });
    expect(Object.isFrozen(h.session().activeTenantContext)).toBe(true);
    expect(h.events).toEqual(['establish', 'save-context']);
  });

  it.each([
    { state: 'STALE_MEMBERSHIP' as const },
    { ...validDecision, membership: { ...validDecision.membership, id: 'other' } },
    { ...validDecision, tenant: { ...validDecision.tenant, id: 'other' } },
    { ...validDecision, membership: { ...validDecision.membership, userId: 'other' } },
  ])('returns unavailable when the listed candidate does not revalidate %#', async (decision) => {
    const h = harness([candidate]);
    h.service.revalidateStoredContext.mockResolvedValueOnce(decision as TenantContextDecision);

    const outcome = await orchestrateStaffLoginOrganisation(
      { user: { id: 'user-1' }, sessionLifecycle: h.lifecycle },
      { tenantContextService: h.service, clock: h.clock, establishSession: h.establishSession },
    );

    expect(outcome).toEqual({ kind: 'ORGANISATION_UNAVAILABLE' });
    expect(h.session().activeTenantContext).toBeUndefined();
  });

  it.each(['lookup', 'revalidation'] as const)('uses a stable error for %s failure', async (point) => {
    const h = harness(point === 'lookup' ? [] : [candidate]);
    if (point === 'lookup') h.service.listEligibleMemberships.mockRejectedValueOnce(new Error('raw lookup secret'));
    else h.service.revalidateStoredContext.mockRejectedValueOnce(new Error('raw validation secret'));

    await expect(orchestrateStaffLoginOrganisation(
      { user: { id: 'user-1' }, sessionLifecycle: h.lifecycle },
      { tenantContextService: h.service, clock: h.clock, establishSession: h.establishSession },
    )).rejects.toThrow(STAFF_ORGANISATION_ESTABLISHMENT_ERROR);
    expect(h.session().activeTenantContext).toBeUndefined();
  });

  it('removes the matching context and certifies cleanup when its save fails', async () => {
    const h = harness([candidate]);
    vi.mocked(h.lifecycle.save)
      .mockRejectedValueOnce(new Error('save secret'))
      .mockImplementationOnce(async () => h.events.push('save-cleanup'));

    await expect(orchestrateStaffLoginOrganisation(
      { user: { id: 'user-1' }, sessionLifecycle: h.lifecycle },
      { tenantContextService: h.service, clock: h.clock, establishSession: h.establishSession },
    )).rejects.toThrow(STAFF_ORGANISATION_ESTABLISHMENT_ERROR);

    expect(h.session().activeTenantContext).toBeUndefined();
    expect(h.lifecycle.invalidate).not.toHaveBeenCalled();
    expect(h.events).toEqual(['establish', 'save-cleanup']);
  });

  it('invalidates when cleanup save cannot be certified', async () => {
    const h = harness([candidate]);
    vi.mocked(h.lifecycle.save).mockRejectedValue(new Error('store unavailable'));

    await expect(orchestrateStaffLoginOrganisation(
      { user: { id: 'user-1' }, sessionLifecycle: h.lifecycle },
      { tenantContextService: h.service, clock: h.clock, establishSession: h.establishSession },
    )).rejects.toThrow(STAFF_ORGANISATION_ESTABLISHMENT_ERROR);

    expect(h.events).toEqual(['establish', 'clear-user', 'invalidate']);
  });

  it('invalidates rather than deleting a concurrent replacement', async () => {
    const h = harness([candidate]);
    vi.mocked(h.lifecycle.save).mockImplementationOnce(async () => {
      h.session().activeTenantContext = {
        tenantId: 'tenant-2',
        membershipId: 'membership-2',
        contextVersion: 1,
        selectedAt: 300,
        validatedAt: 300,
      };
      throw new Error('save uncertain');
    });

    await expect(orchestrateStaffLoginOrganisation(
      { user: { id: 'user-1' }, sessionLifecycle: h.lifecycle },
      { tenantContextService: h.service, clock: h.clock, establishSession: h.establishSession },
    )).rejects.toThrow(STAFF_ORGANISATION_ESTABLISHMENT_ERROR);
    expect(h.events).toEqual(['establish', 'clear-user', 'invalidate']);
  });

  it('gives ADMIN no bypass and never inspects customer session state', async () => {
    const h = harness();
    const customer = h.session().customerUser;

    await orchestrateStaffLoginOrganisation(
      { user: { id: 'user-1', roles: ['ADMIN'] }, sessionLifecycle: h.lifecycle },
      { tenantContextService: h.service, clock: h.clock, establishSession: h.establishSession },
    );

    expect(h.service.listEligibleMemberships).toHaveBeenCalledWith('user-1');
    expect(h.session().customerUser).toBe(customer);
  });

  it('creates context without roles, permissions, or authority snapshots', () => {
    const context = createActiveTenantSessionContext(validDecision, 100);
    expect(Object.keys(context)).toEqual([
      'tenantId',
      'membershipId',
      'contextVersion',
      'selectedAt',
      'validatedAt',
    ]);
  });

  it('mounts context resolution without RBAC or operational tenant-gate activation', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/modules/tenancy/staff-login-organisation-orchestration.ts'), 'utf8');
    const authRoutes = readFileSync(resolve(process.cwd(), 'src/modules/auth/auth.routes.ts'), 'utf8');
    const app = readFileSync(resolve(process.cwd(), 'src/app.ts'), 'utf8');

    expect(source).not.toMatch(/sequelize|postgres|database|tenant_membership_roles|user_roles/i);
    expect(source).not.toMatch(/requireRole|requirePermission|Router|RequestHandler|app\.use|customerUser/);
    expect(authRoutes).toMatch(
      /staff-login-organisation-orchestration|orchestrateStaffLoginOrganisation/,
    );
    expect(app).toMatch(/createAuthRouter/);
    expect(app).toMatch(/const\s*{\s*resolveTenantContext,\s*requireValidActiveTenantContext\s*}\s*=\s*createActiveTenantContextMiddleware/);
    expect(app).toMatch(/app\.use\(resolveTenantContext\)/);
    expect(app).not.toMatch(/app\.use\(requireValidActiveTenantContext\)/);
  });
});
