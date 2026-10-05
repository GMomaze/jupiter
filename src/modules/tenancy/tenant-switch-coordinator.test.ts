import type { SessionData } from 'express-session';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveTenantSessionContext } from './active-tenant-context.types.js';
import type {
  ExpectedTenantContextToken,
  OpaqueTenantSwitchCorrelationHash,
  RejectedTargetFingerprint,
} from './tenant-switch-contracts.js';
import { TenantSwitchCoordinator } from './tenant-switch-coordinator.js';

const token = 'v1.test' as ExpectedTenantContextToken;
const hash = 'A'.repeat(43) as OpaqueTenantSwitchCorrelationHash;
const oldContext: ActiveTenantSessionContext = Object.freeze({
  tenantId: 'tenant-a', membershipId: 'membership-a', contextVersion: 1,
  selectedAt: 1, validatedAt: 2,
});
const targetCandidate = Object.freeze({
  tenantId: 'tenant-b', membershipId: 'membership-b',
  tenantPublicId: 'org-b', tenantCode: 'B', tenantDisplayName: 'B',
});
const currentValid = Object.freeze({
  state: 'VALID_ACTIVE_TENANT' as const,
  tenant: Object.freeze({ id: 'tenant-a', publicId: 'org-a', code: 'A', displayName: 'A', status: 'ACTIVE' as const }),
  membership: Object.freeze({ id: 'membership-a', tenantId: 'tenant-a', userId: 'user-1', status: 'ACTIVE' as const }),
  validatedAt: 10,
});
const targetValid = Object.freeze({
  state: 'VALID_ACTIVE_TENANT' as const,
  tenant: Object.freeze({ id: 'tenant-b', publicId: 'org-b', code: 'B', displayName: 'B', status: 'ACTIVE' as const }),
  membership: Object.freeze({ id: 'membership-b', tenantId: 'tenant-b', userId: 'user-1', status: 'ACTIVE' as const }),
  validatedAt: 20,
});

function harness() {
  const events: string[] = [];
  let session = {
    activeTenantContext: oldContext,
    customerUser: { id: 'c', customer_id: 'c1', email: 'c@x', display_name: 'C', unsafe: 'drop' },
    unmatchedModels: ['drop'],
    adImportState: { token: 'drop' },
  } as unknown as SessionData;
  let sid = 'old-sid';
  const lifecycle = {
    getSession: vi.fn(() => session),
    getSessionId: vi.fn(() => sid),
    reload: vi.fn(async () => events.push('reload')),
    regenerate: vi.fn(async () => {
      events.push('regenerate');
      session = {} as SessionData;
      sid = 'new-sid';
    }),
    login: vi.fn(async () => events.push('login')),
    save: vi.fn(async () => events.push(session.activeTenantContext ? 'save-context' : 'save-session')),
    invalidate: vi.fn(async () => {
      events.push('invalidate');
      session = {} as SessionData;
    }),
    clearRequestUser: vi.fn(() => events.push('clear-user')),
  };
  const authority = {
    resolveTenantSelection: vi.fn(async () => Object.freeze({ available: true as const, candidate: targetCandidate })),
    revalidateStoredContext: vi.fn()
      .mockImplementationOnce(async () => currentValid)
      .mockImplementationOnce(async () => targetValid),
  };
  const persistence = {
    createPending: vi.fn(async () => {
      events.push('pending');
      return Object.freeze({ created: true as const });
    }),
    finalizeSwitched: vi.fn(async () => events.push('switched-audit')),
    finalizeRejected: vi.fn(async () => events.push('rejected-audit')),
    finalizeFailed: vi.fn(async () => events.push('failed-attempt')),
  };
  const tokenCodec = {
    createExpectedContextToken: vi.fn(),
    verifyExpectedContextToken: vi.fn(() => {
      events.push('token');
      return true;
    }),
    createRejectedTargetMetadata: vi.fn((raw: string, reason: any) => Object.freeze({
      fingerprint: 'B'.repeat(43) as RejectedTargetFingerprint,
      boundedInputLength: raw.length,
      inputLengthCapped: false,
      reason,
    })),
    createCorrelationHash: vi.fn(() => hash),
  };
  let time = 100;
  let id = 0;
  const lock = { withUserLock: vi.fn(async (_userId: string, work: () => Promise<unknown>) => {
    events.push('lock');
    return work();
  }) };
  const coordinator = new TenantSwitchCoordinator({
    tenantContextService: authority,
    advisoryLock: lock,
    persistence,
    tokenCodec,
    clock: () => ++time,
    idFactory: () => `id-${++id}`,
  });
  return { coordinator, lifecycle, authority, persistence, tokenCodec, lock, events, session: () => session };
}

describe('TenantSwitchCoordinator', () => {
  it('executes the guarded sequence and creates the exact frozen context', async () => {
    const h = harness();
    const result = await h.coordinator.switchTenant({ user: { id: 'user-1' }, tenantPublicId: 'org-b', expectedContextToken: token, sessionLifecycle: h.lifecycle });
    expect(result.outcome).toBe('SWITCHED');
    expect(h.events).toEqual(['lock', 'reload', 'token', 'pending', 'regenerate', 'login', 'save-session', 'save-context', 'switched-audit']);
    expect(h.authority.resolveTenantSelection).toHaveBeenCalledTimes(2);
    expect(h.authority.revalidateStoredContext).toHaveBeenNthCalledWith(1, 'user-1', oldContext);
    expect(h.persistence.createPending).toHaveBeenCalledBefore(h.lifecycle.regenerate);
    expect(h.lifecycle.save).toHaveBeenCalledBefore(h.persistence.finalizeSwitched);
    const context = h.session().activeTenantContext!;
    expect(Object.keys(context)).toEqual(['tenantId', 'membershipId', 'contextVersion', 'selectedAt', 'validatedAt']);
    expect(context).toMatchObject({ tenantId: 'tenant-b', membershipId: 'membership-b', contextVersion: 1, validatedAt: 20 });
    expect(Object.isFrozen(context)).toBe(true);
    expect(h.session().unmatchedModels).toBeUndefined();
    expect(h.session().adImportState).toBeUndefined();
    expect(h.session().customerUser).toEqual({ id: 'c', customer_id: 'c1', email: 'c@x', display_name: 'C' });
  });

  it('checks token only after lock and authoritative reload', async () => {
    const h = harness();
    h.tokenCodec.verifyExpectedContextToken.mockImplementationOnce(() => {
      h.events.push('token');
      return false;
    });
    await expect(h.coordinator.switchTenant({ user: { id: 'user-1', roles: ['ADMIN'] }, tenantPublicId: 'org-b', expectedContextToken: token, sessionLifecycle: h.lifecycle })).resolves.toMatchObject({ outcome: 'REJECTED' });
    expect(h.events).toEqual(['lock', 'reload', 'token']);
    expect(h.authority.revalidateStoredContext).not.toHaveBeenCalled();
    expect(h.persistence.createPending).not.toHaveBeenCalled();
  });

  it('handles typed duplicates neutrally before regeneration', async () => {
    const h = harness();
    h.persistence.createPending.mockImplementationOnce(async () => {
      h.events.push('pending');
      return Object.freeze({ created: false as const, reason: 'DUPLICATE_REQUEST' as const });
    });
    const result = await h.coordinator.switchTenant({ user: { id: 'user-1' }, tenantPublicId: 'org-b', expectedContextToken: token, sessionLifecycle: h.lifecycle });
    expect(result).toMatchObject({ outcome: 'REJECTED', message: 'Organisation unavailable' });
    expect(h.lifecycle.regenerate).not.toHaveBeenCalled();
    expect(h.persistence.finalizeSwitched).not.toHaveBeenCalled();
  });

  it('keeps technical pending failures distinct from duplicates', async () => {
    const h = harness();
    h.persistence.createPending.mockRejectedValueOnce(new Error('technical detail'));
    const result = await h.coordinator.switchTenant({ user: { id: 'user-1' }, tenantPublicId: 'org-b', expectedContextToken: token, sessionLifecycle: h.lifecycle });
    expect(result).toMatchObject({ outcome: 'FAILED' });
    expect(JSON.stringify(result)).not.toContain('technical detail');
    expect(h.lifecycle.regenerate).not.toHaveBeenCalled();
  });

  it('audits post-lock target rejection using fingerprint only', async () => {
    const h = harness();
    h.authority.resolveTenantSelection.mockResolvedValueOnce({ available: true, candidate: targetCandidate }).mockResolvedValueOnce({ available: false });
    const result = await h.coordinator.switchTenant({ user: { id: 'user-1' }, tenantPublicId: 'foreign-public-id', expectedContextToken: token, sessionLifecycle: h.lifecycle });
    expect(result.outcome).toBe('REJECTED');
    const persisted = h.persistence.createPending.mock.calls[0][0];
    expect(persisted).not.toHaveProperty('tenantPublicId');
    expect(JSON.stringify(persisted)).not.toContain('foreign-public-id');
    expect(h.persistence.finalizeRejected).toHaveBeenCalledOnce();
  });

  it.each(['regeneration', 'context save', 'switched audit'])('contains %s failure and never returns success', async failure => {
    const h = harness();
    if (failure === 'regeneration') h.lifecycle.regenerate.mockRejectedValueOnce(new Error('fail'));
    if (failure === 'context save') h.lifecycle.save.mockImplementationOnce(async () => h.events.push('save-session')).mockRejectedValueOnce(new Error('fail'));
    if (failure === 'switched audit') h.persistence.finalizeSwitched.mockRejectedValueOnce(new Error('fail'));
    const result = await h.coordinator.switchTenant({ user: { id: 'user-1' }, tenantPublicId: 'org-b', expectedContextToken: token, sessionLifecycle: h.lifecycle });
    expect(result.outcome).toBe('FAILED');
    expect(h.lifecycle.clearRequestUser).toHaveBeenCalled();
    expect(h.lifecycle.invalidate).toHaveBeenCalled();
    expect(h.persistence.finalizeFailed).toHaveBeenCalled();
    expect(h.persistence.finalizeFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        failureCategory:
          failure === 'switched audit' ? 'AUDIT_PERSISTENCE' : 'SESSION_PERSISTENCE',
      }),
    );
  });

  it('remains failed when invalidation and FAILED finalization also fail', async () => {
    const h = harness();
    h.persistence.finalizeSwitched.mockRejectedValueOnce(new Error('audit fail'));
    h.lifecycle.invalidate.mockRejectedValueOnce(new Error('invalidate fail'));
    h.persistence.finalizeFailed.mockRejectedValueOnce(new Error('finalize fail'));
    await expect(h.coordinator.switchTenant({ user: { id: 'user-1' }, tenantPublicId: 'org-b', expectedContextToken: token, sessionLifecycle: h.lifecycle })).resolves.toMatchObject({ outcome: 'FAILED' });
  });
});
