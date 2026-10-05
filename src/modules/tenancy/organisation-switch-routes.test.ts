import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const controls = vi.hoisted(() => ({ order: [] as string[] }));
vi.mock('../../middleware/auth.middleware.js', () => ({
  ensureAuthenticated: (_req: unknown, _res: unknown, next: () => void) => {
    controls.order.push('auth');
    next();
  },
}));
import { createOrganisationSwitchRouter } from './organisation-switch.routes.js';

function appFor(result: object) {
  const coordinator = { switchTenant: vi.fn(async () => result) };
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use((req: any, _res, next) => {
    req.user = { id: 'user-1', roles: ['ADMIN'] };
    req.sessionID = 'sid';
    req.session = {};
    next();
  });
  const csrfProtection = (_req: unknown, _res: unknown, next: () => void) => {
    controls.order.push('csrf');
    next();
  };
  app.use('/organisation', createOrganisationSwitchRouter({ coordinator: coordinator as any, csrfProtection }));
  return { app, coordinator };
}

describe('organisation switch router', () => {
  beforeEach(() => controls.order.splice(0));

  it('runs authentication then CSRF and accepts only approved fields', async () => {
    const h = appFor({ outcome: 'SWITCHED', destination: '/', context: {} });
    const response = await request(h.app).post('/organisation/switch').type('form').send({ tenant_public_id: 'org-b', expected_context_token: 'token', _csrf: 'csrf' });
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('/');
    expect(controls.order).toEqual(['auth', 'csrf']);
    expect(h.coordinator.switchTenant).toHaveBeenCalledOnce();

    const invalid = await request(h.app).post('/organisation/switch').type('form').send({ tenant_public_id: 'org-b', expected_context_token: 'token', redirect: '/foreign' });
    expect(invalid.status).toBe(303);
    expect(invalid.headers.location).toBe('/organisation/unavailable');
    expect(h.coordinator.switchTenant).toHaveBeenCalledOnce();
  });

  it('returns fixed HTMX and JSON success without arbitrary redirect', async () => {
    const h = appFor({ outcome: 'SWITCHED', destination: '/', context: {} });
    const htmx = await request(h.app).post('/organisation/switch').set('HX-Request', 'true').type('form').send({ tenant_public_id: 'org-b', expected_context_token: 'token' });
    expect(htmx.status).toBe(204);
    expect(htmx.headers['hx-redirect']).toBe('/');
    const json = await request(h.app).post('/organisation/switch').set('Accept', 'application/json').type('form').send({ tenant_public_id: 'org-b', expected_context_token: 'token' });
    expect(json.status).toBe(200);
    expect(json.body).toEqual({ success: true });
  });

  it('keeps rejection and technical failures neutral', async () => {
    const rejected = appFor({ outcome: 'REJECTED', message: 'Organisation unavailable' });
    const rejection = await request(rejected.app).post('/organisation/switch').set('Accept', 'application/json').type('form').send({ tenant_public_id: 'foreign', expected_context_token: 'token' });
    expect(rejection.status).toBe(409);
    expect(rejection.body).toEqual({ error: 'Organisation unavailable' });
    const failed = appFor({ outcome: 'FAILED', message: 'Organisation switching is temporarily unavailable' });
    const failure = await request(failed.app).post('/organisation/switch').set('Accept', 'application/json').type('form').send({ tenant_public_id: 'org-b', expected_context_token: 'token' });
    expect(failure.status).toBe(503);
    expect(failure.body).toEqual({ error: 'Organisation switching is temporarily unavailable' });
  });

  it('is mounted without introducing RBAC, customer, migration, RLS, or operational gating', () => {
    const app = readFileSync(resolve('src/app.ts'), 'utf8');
    const auth = readFileSync(resolve('src/modules/auth/auth.routes.ts'), 'utf8');
    const customer = readFileSync(resolve('src/modules/customer-auth/customer-auth.routes.ts'), 'utf8');
    const route = readFileSync(resolve('src/modules/tenancy/organisation-switch.routes.ts'), 'utf8');
    const coordinator = readFileSync(resolve('src/modules/tenancy/tenant-switch-coordinator.ts'), 'utf8');
    expect(app).toMatch(/createOrganisationSwitchRouter/);
    expect(app).toContain("app.use('/organisation', organisationSwitchRoutes)");
    expect(app).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
    expect(auth).not.toMatch(/organisation-switch|TenantSwitchCoordinator/);
    expect(customer).not.toMatch(/organisation-switch|TenantSwitchCoordinator/);
    expect(`${route}\n${coordinator}`).not.toMatch(/requireRole|\bADMIN\b|user_roles|tenant_membership_roles|CREATE POLICY|ROW LEVEL SECURITY/);
  });
});
