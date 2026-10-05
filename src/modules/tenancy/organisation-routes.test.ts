import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import type { SessionData } from 'express-session';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveTenantContextService } from './active-tenant-context.service.js';
import {
  ORGANISATION_SELECTION_ERROR,
  OrganisationSelectionService,
  type OrganisationSessionLifecycle,
} from './organisation-selection.service.js';

const controls = vi.hoisted(() => ({ order: [] as string[] }));
vi.mock('../../middleware/auth.middleware.js', () => ({
  ensureAuthenticated: (_req: unknown, _res: unknown, next: () => void) => {
    controls.order.push('auth');
    next();
  },
}));

import { createOrganisationRouter } from './organisation.routes.js';

const candidate = Object.freeze({
  membershipId: 'membership-internal',
  tenantId: 'tenant-internal',
  tenantPublicId: 'public-org',
  tenantCode: 'ORG',
  tenantDisplayName: 'Organisation',
});

const valid = Object.freeze({
  state: 'VALID_ACTIVE_TENANT' as const,
  tenant: Object.freeze({ id: 'tenant-internal', publicId: 'public-org', code: 'ORG', displayName: 'Organisation', status: 'ACTIVE' as const }),
  membership: Object.freeze({ id: 'membership-internal', tenantId: 'tenant-internal', userId: 'user-1', status: 'ACTIVE' as const }),
  validatedAt: 200,
});

function serviceHarness() {
  let session = {} as SessionData;
  const events: string[] = [];
  const authority = {
    listEligibleMemberships: vi.fn(async () => [candidate]),
    resolveTenantSelection: vi.fn(async () => Object.freeze({ available: true as const, candidate })),
    revalidateStoredContext: vi.fn(async () => valid),
  };
  const lifecycle: OrganisationSessionLifecycle = {
    getSession: vi.fn(() => session),
    save: vi.fn(async () => events.push(session.activeTenantContext ? 'save-context' : 'save-cleanup')),
    clearRequestUser: vi.fn(() => events.push('clear-user')),
    invalidate: vi.fn(async () => {
      events.push('invalidate');
      session = {} as SessionData;
    }),
  };
  return {
    authority,
    lifecycle,
    events,
    session: () => session,
    service: new OrganisationSelectionService(
      authority as unknown as ActiveTenantContextService,
      () => 100,
    ),
  };
}

function routeApp(selectionService: any, session: Record<string, unknown> = {}) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use((req: any, res, next) => {
    req.user = { id: 'user-1', roles: ['ADMIN'] };
    req.session = session;
    res.render = (view: string, data?: unknown) => res.status(200).json({ view, data });
    next();
  });
  const csrfProtection = (_req: unknown, _res: unknown, next: () => void) => {
    controls.order.push('csrf');
    next();
  };
  app.use('/organisation', createOrganisationRouter({ selectionService, csrfProtection }));
  return app;
}

describe('organisation selection service', () => {
  it('projects only immutable public candidate fields for the authenticated user', async () => {
    const h = serviceHarness();
    const options = await h.service.listOptions('user-1');
    expect(h.authority.listEligibleMemberships).toHaveBeenCalledWith('user-1');
    expect(options).toEqual([{ tenantPublicId: 'public-org', tenantCode: 'ORG', tenantDisplayName: 'Organisation' }]);
    expect(Object.isFrozen(options)).toBe(true);
    expect(Object.isFrozen(options[0])).toBe(true);
    expect(JSON.stringify(options)).not.toMatch(/membership-internal|tenant-internal/);
  });

  it('resolves and revalidates exact public selection before saving minimal context', async () => {
    const h = serviceHarness();
    const result = await h.service.select('user-1', ' public-org ', h.lifecycle);
    expect(h.authority.resolveTenantSelection).toHaveBeenCalledWith('user-1', 'public-org');
    expect(h.authority.revalidateStoredContext).toHaveBeenCalledWith('user-1', {
      tenantId: 'tenant-internal', membershipId: 'membership-internal', contextVersion: 1, selectedAt: 100, validatedAt: 100,
    });
    expect(result).toEqual({ available: true, context: {
      tenantId: 'tenant-internal', membershipId: 'membership-internal', contextVersion: 1, selectedAt: 100, validatedAt: 200,
    } });
    expect(Object.keys(h.session().activeTenantContext!)).toEqual(['tenantId', 'membershipId', 'contextVersion', 'selectedAt', 'validatedAt']);
    expect(Object.isFrozen(h.session().activeTenantContext)).toBe(true);
    expect(h.events).toEqual(['save-context']);
  });

  it.each([
    Object.freeze({ available: false as const }),
    Object.freeze({ available: true as const, candidate: { ...candidate, tenantId: 'foreign' } }),
  ])('returns neutral unavailability for unresolved or inconsistent selection %#', async (resolution) => {
    const h = serviceHarness();
    h.authority.resolveTenantSelection.mockResolvedValueOnce(resolution);
    const result = await h.service.select('user-1', 'public-org', h.lifecycle);
    expect(result).toEqual({ available: false });
    expect(h.session().activeTenantContext).toBeUndefined();
  });

  it('never replaces an existing context', async () => {
    const h = serviceHarness();
    const existing = { tenantId: 'existing', membershipId: 'existing', contextVersion: 1 as const, selectedAt: 1, validatedAt: 1 };
    h.session().activeTenantContext = existing;
    await expect(h.service.select('user-1', 'public-org', h.lifecycle)).resolves.toEqual({ available: false });
    expect(h.session().activeTenantContext).toBe(existing);
    expect(h.authority.resolveTenantSelection).not.toHaveBeenCalled();
  });

  it('returns neutral unavailability when the exact candidate does not revalidate', async () => {
    const h = serviceHarness();
    h.authority.revalidateStoredContext.mockResolvedValueOnce({ state: 'STALE_MEMBERSHIP' });
    await expect(h.service.select('user-1', 'public-org', h.lifecycle)).resolves.toEqual({ available: false });
    expect(h.session().activeTenantContext).toBeUndefined();
    expect(h.lifecycle.save).not.toHaveBeenCalled();
  });

  it('exposes only the stable service error for technical authority failures', async () => {
    const h = serviceHarness();
    h.authority.resolveTenantSelection.mockRejectedValueOnce(new Error('raw authority detail'));
    await expect(h.service.select('user-1', 'public-org', h.lifecycle)).rejects.toThrow(ORGANISATION_SELECTION_ERROR);
    expect(h.session().activeTenantContext).toBeUndefined();
  });

  it('removes only the matching context and certifies a successful cleanup save', async () => {
    const h = serviceHarness();
    vi.mocked(h.lifecycle.save)
      .mockRejectedValueOnce(new Error('first save uncertain'))
      .mockImplementationOnce(async () => h.events.push('save-cleanup'));
    await expect(h.service.select('user-1', 'public-org', h.lifecycle)).rejects.toThrow(ORGANISATION_SELECTION_ERROR);
    expect(h.session().activeTenantContext).toBeUndefined();
    expect(h.lifecycle.invalidate).not.toHaveBeenCalled();
    expect(h.events).toEqual(['save-cleanup']);
  });

  it('cleans a matching failed save and invalidates uncertain cleanup', async () => {
    const h = serviceHarness();
    vi.mocked(h.lifecycle.save).mockRejectedValue(new Error('store detail'));
    await expect(h.service.select('user-1', 'public-org', h.lifecycle)).rejects.toThrow(ORGANISATION_SELECTION_ERROR);
    expect(h.events).toEqual(['clear-user', 'invalidate']);
  });

  it('invalidates rather than deleting a concurrent context replacement', async () => {
    const h = serviceHarness();
    vi.mocked(h.lifecycle.save).mockImplementationOnce(async () => {
      h.session().activeTenantContext = {
        tenantId: 'tenant-concurrent',
        membershipId: 'membership-concurrent',
        contextVersion: 1,
        selectedAt: 300,
        validatedAt: 300,
      };
      throw new Error('save uncertain');
    });
    await expect(h.service.select('user-1', 'public-org', h.lifecycle)).rejects.toThrow(ORGANISATION_SELECTION_ERROR);
    expect(h.events).toEqual(['clear-user', 'invalidate']);
  });
});

describe('dormant organisation router and views', () => {
  beforeEach(() => controls.order.splice(0));

  it('protects listing and renders only public options', async () => {
    const selectionService = { listOptions: vi.fn(async () => [{ tenantPublicId: 'public-org', tenantCode: 'ORG', tenantDisplayName: 'Organisation' }]), select: vi.fn() };
    const response = await request(routeApp(selectionService)).get('/organisation/select').set('Accept', 'text/html');
    expect(response.status).toBe(200);
    expect(response.body.view).toBe('organisation/organisation-select');
    expect(response.text).not.toMatch(/membership-internal|tenant-internal/);
    expect(controls.order).toEqual(['auth']);
  });

  it('sends zero candidates to the neutral unavailable destination', async () => {
    const selectionService = { listOptions: vi.fn(async () => []), select: vi.fn() };
    const response = await request(routeApp(selectionService)).get('/organisation/select').set('Accept', 'text/html');
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('/organisation/unavailable');
  });

  it('requires auth then CSRF and accepts only tenant_public_id plus _csrf', async () => {
    const selectionService = { listOptions: vi.fn(), select: vi.fn(async () => ({ available: true })) };
    const app = routeApp(selectionService);
    const success = await request(app).post('/organisation/select').type('form').send({ tenant_public_id: 'public-org', _csrf: 'token' });
    expect(success.status).toBe(303);
    expect(success.headers.location).toBe('/');
    expect(controls.order).toEqual(['auth', 'csrf']);
    expect(selectionService.select).toHaveBeenCalledWith('user-1', 'public-org', expect.any(Object));

    const rejected = await request(app).post('/organisation/select').type('form').send({ tenant_public_id: 'public-org', redirect: '/foreign' });
    expect(rejected.status).toBe(303);
    expect(rejected.headers.location).toBe('/organisation/unavailable');
    expect(selectionService.select).toHaveBeenCalledOnce();
  });

  it('uses neutral HTMX and JSON contracts without internal decision leakage', async () => {
    const selectionService = { listOptions: vi.fn(), select: vi.fn(async () => ({ available: false })) };
    const app = routeApp(selectionService);
    const htmx = await request(app).post('/organisation/select').set('HX-Request', 'true').type('form').send({ tenant_public_id: 'foreign' });
    expect(htmx.status).toBe(409);
    expect(htmx.headers['hx-redirect']).toBe('/organisation/unavailable');
    expect(htmx.text).toBe('');
    const json = await request(app).post('/organisation/select').set('Accept', 'application/json').type('form').send({ tenant_public_id: 'foreign' });
    expect(json.status).toBe(403);
    expect(json.body).toEqual({ error: 'Organisation unavailable' });
  });

  it('contains rendering and service failures behind a neutral 503', async () => {
    const selectionService = {
      listOptions: vi.fn(async () => {
        throw new Error('database relationship detail');
      }),
      select: vi.fn(),
    };
    const response = await request(routeApp(selectionService))
      .get('/organisation/select')
      .set('Accept', 'application/json');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'Organisation unavailable' });
    expect(response.text).not.toContain('database relationship detail');
  });

  it('keeps content generic and mounts the approved selector and switch routers', () => {
    const selectView = readFileSync(resolve(process.cwd(), 'src/views/organisation/organisation-select.ejs'), 'utf8');
    const unavailableView = readFileSync(resolve(process.cwd(), 'src/views/organisation/organisation-unavailable.ejs'), 'utf8');
    const app = readFileSync(resolve(process.cwd(), 'src/app.ts'), 'utf8');
    const authRoutes = readFileSync(resolve(process.cwd(), 'src/modules/auth/auth.routes.ts'), 'utf8');
    const customerRoutes = readFileSync(resolve(process.cwd(), 'src/modules/customer-auth/customer-auth.routes.ts'), 'utf8');
    const customerPortal = readFileSync(resolve(process.cwd(), 'src/modules/customer-portal/customer-portal.routes.ts'), 'utf8');

    expect(selectView).toContain('name="tenant_public_id"');
    expect(selectView).not.toMatch(/membershipId|membership_id|tenantId|tenant_id|partials\/header|href="\/library|href="\/aircraft/);
    expect(unavailableView).toContain('Organisation unavailable');
    expect(unavailableView).toContain('/auth/logout');
    expect(unavailableView).not.toMatch(/membership|tenant status|partials\/header|href="\/library|href="\/aircraft/i);
    expect(app).toMatch(/createOrganisationRouter/);
    expect(app).toContain("app.use('/organisation', organisationRoutes)");
    expect(app).toMatch(/createOrganisationSwitchRouter/);
    expect(app).toContain("app.use('/organisation', organisationSwitchRoutes)");
    expect(app).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
    expect(authRoutes).not.toMatch(/createOrganisationRouter|organisation-selection/);
    expect(customerRoutes).not.toMatch(/createOrganisationRouter|OrganisationSelectionService/);
    expect(customerPortal).not.toMatch(/createOrganisationRouter|OrganisationSelectionService/);
  });
});
