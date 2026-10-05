import { describe, expect, it, vi } from 'vitest';
import { createActiveOrganisationUiMiddleware } from './active-organisation-ui.middleware.js';

const stored = Object.freeze({
  tenantId: 'tenant-current', membershipId: 'membership-current',
  contextVersion: 1 as const, selectedAt: 10, validatedAt: 20,
});
const validated = Object.freeze({
  state: 'VALID_ACTIVE_TENANT' as const,
  tenant: Object.freeze({ id: 'tenant-current', publicId: 'public-current', code: 'CURRENT', displayName: 'Current Organisation', status: 'ACTIVE' as const }),
  membership: Object.freeze({ id: 'membership-current', tenantId: 'tenant-current', userId: 'user-1', status: 'ACTIVE' as const }),
  validatedAt: 30,
});

function harness(options: object[] = []) {
  const listOptions = vi.fn(async () => options);
  const createExpectedContextToken = vi.fn(() => 'v1.opaque-token' as any);
  const middleware = createActiveOrganisationUiMiddleware({
    selectionService: { listOptions } as any,
    tokenCodec: { createExpectedContextToken },
  });
  const req: any = {
    user: { id: 'user-1', roles: [{ code: 'ADMIN' }] },
    tenantContext: validated,
    session: { activeTenantContext: stored },
  };
  const res: any = { locals: {} };
  const next = vi.fn();
  return { middleware, req, res, next, listOptions, createExpectedContextToken };
}

describe('active Organisation UI middleware', () => {
  it('projects a freshly validated current Organisation and only public alternatives', async () => {
    const h = harness([
      { tenantPublicId: 'public-current', tenantCode: 'CURRENT', tenantDisplayName: 'Current Organisation' },
      { tenantPublicId: 'public-next', tenantCode: 'NEXT', tenantDisplayName: 'Next Organisation' },
    ]);
    await h.middleware(h.req, h.res, h.next);
    expect(h.listOptions).toHaveBeenCalledWith('user-1');
    expect(h.res.locals.activeOrganisationUi).toEqual({
      current: { tenantCode: 'CURRENT', tenantDisplayName: 'Current Organisation' },
      alternatives: [{ tenantPublicId: 'public-next', tenantCode: 'NEXT', tenantDisplayName: 'Next Organisation' }],
      expectedContextToken: 'v1.opaque-token',
    });
    expect(JSON.stringify(h.res.locals.activeOrganisationUi)).not.toMatch(/tenant-current|membership-current/);
    expect(Object.isFrozen(h.res.locals.activeOrganisationUi)).toBe(true);
  });

  it('hides switching when no eligible alternative exists', async () => {
    const h = harness([{ tenantPublicId: 'public-current', tenantCode: 'CURRENT', tenantDisplayName: 'Current Organisation' }]);
    await h.middleware(h.req, h.res, h.next);
    expect(h.res.locals.activeOrganisationUi.alternatives).toEqual([]);
    expect(h.res.locals.activeOrganisationUi.expectedContextToken).toBeUndefined();
    expect(h.createExpectedContextToken).not.toHaveBeenCalled();
  });

  it('does no lookup without a matching freshly validated context', async () => {
    const h = harness();
    delete h.req.tenantContext;
    await h.middleware(h.req, h.res, h.next);
    expect(h.listOptions).not.toHaveBeenCalled();
    expect(h.res.locals.activeOrganisationUi).toBeUndefined();
  });

  it('fails closed by retaining current display but hiding alternatives', async () => {
    const h = harness();
    h.listOptions.mockRejectedValueOnce(new Error('authority detail'));
    await h.middleware(h.req, h.res, h.next);
    expect(h.res.locals.activeOrganisationUi).toEqual({
      current: { tenantCode: 'CURRENT', tenantDisplayName: 'Current Organisation' },
      alternatives: [],
    });
  });

  it('gives ADMIN-shaped users no bypass or additional authority', async () => {
    const h = harness();
    h.req.tenantContext = { ...validated, membership: { ...validated.membership, userId: 'another-user' } };
    await h.middleware(h.req, h.res, h.next);
    expect(h.listOptions).not.toHaveBeenCalled();
    expect(h.res.locals.activeOrganisationUi).toBeUndefined();
  });
});
