import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const controls = vi.hoisted(() => ({
  events: [] as string[],
  passportError: null as Error | null,
}));
vi.mock('passport', () => ({
  default: {
    authenticate:
      (_strategy: string, callback: Function) =>
      (_req: unknown, _res: unknown, _next: unknown) => {
        controls.events.push('passport');
        callback(
          controls.passportError,
          controls.passportError
            ? undefined
            : { id: 'user-1', roles: [{ code: 'ADMIN' }] },
          undefined,
        );
      },
  },
}));

import { createAuthRouter } from './auth.routes.js';

function appFor(outcome: any, withSession = true, isPlatformAdministrator?: (userId: string) => Promise<boolean>) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use((req: any, _res, next) => {
    req.session = withSession ? {
      customerUser: {
        id: 'customer-user',
        customer_id: 'customer',
        email: 'customer@example.test',
        display_name: 'Customer',
      },
      regenerate: (done: Function) => done(),
      save: (done: Function) => done(),
      destroy: (done: Function) => done(),
    } : undefined;
    req.flash = vi.fn();
    req.login = (_user: unknown, _options: unknown, done: Function) => done();
    req.logout = (_options: unknown, done: Function) => done();
    next();
  });
  const orchestrate = vi.fn(async (input: any) => {
    controls.events.push('orchestrate');
    expect(input.user.id).toBe('user-1');
    return outcome;
  });
  app.use(
    '/auth',
    createAuthRouter({
      tenantContextService: {} as any,
      clock: () => 1,
      orchestrate,
      isPlatformAdministrator,
    }),
  );
  return { app, orchestrate };
}

describe('3C6 staff login Organisation integration', () => {
  beforeEach(() => {
    controls.events.splice(0);
    controls.passportError = null;
  });

  it.each([
    [{ kind: 'ORGANISATION_UNAVAILABLE' }, '/organisation/unavailable'],
    [{ kind: 'ORGANISATION_ESTABLISHED', context: {} }, '/'],
    [
      {
        kind: 'ORGANISATION_SELECTION_REQUIRED',
        candidates: Object.freeze([]),
      },
      '/organisation/select',
    ],
  ])(
    'maps %j to fixed HTML, HTMX, and JSON destinations',
    async (outcome, destination) => {
      for (const mode of ['html', 'htmx', 'json']) {
        controls.events.splice(0);
        const harness = appFor(outcome);
        let call = request(harness.app)
          .post('/auth/login')
          .type('form')
          .send({
            email: 'staff@example.test',
            password: 'x',
            tenant_id: 'ignored',
            redirect: '/foreign',
          });
        if (mode === 'htmx') call = call.set('HX-Request', 'true');
        if (mode === 'json') call = call.set('Accept', 'application/json');
        const response = await call;

        expect(controls.events).toEqual(['passport', 'orchestrate']);
        expect(harness.orchestrate).toHaveBeenCalledOnce();
        if (mode === 'html') {
          expect(response.status).toBe(303);
          expect(response.headers.location).toBe(destination);
        }
        if (mode === 'htmx') {
          expect(response.status).toBe(204);
          expect(response.headers['hx-redirect']).toBe(destination);
        }
        if (mode === 'json') {
          expect(response.status).toBe(200);
          expect(response.body).toEqual({
            success: true,
            redirect: destination,
          });
        }
      }
    },
  );

  it('routes a platform-authorized HUMAN with no organisation to /platform', async () => {
    const harness = appFor({ kind: 'ORGANISATION_UNAVAILABLE' }, true, async () => true);
    const response = await request(harness.app).post('/auth/login').type('form').send({ email: 'owner@example.test', password: 'x' });
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('/platform');
  });

  it('keeps /organisation/unavailable for a plain user with no organisation', async () => {
    const harness = appFor({ kind: 'ORGANISATION_UNAVAILABLE' }, true, async () => false);
    const response = await request(harness.app).post('/auth/login').type('form').send({ email: 'plain@example.test', password: 'x' });
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('/organisation/unavailable');
  });

  it('does not consult platform authority when an organisation is established', async () => {
    const isPlatformAdministrator = vi.fn(async () => true);
    const harness = appFor({ kind: 'ORGANISATION_ESTABLISHED', context: {} }, true, isPlatformAdministrator);
    const response = await request(harness.app).post('/auth/login').type('form').send({ email: 'tenant-admin@example.test', password: 'x' });
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('/');
    expect(isPlatformAdministrator).not.toHaveBeenCalled();
  });

  it('fails closed to /organisation/unavailable when platform-authority resolution throws', async () => {
    const harness = appFor({ kind: 'ORGANISATION_UNAVAILABLE' }, true, async () => { throw new Error('resolve failure'); });
    const response = await request(harness.app).post('/auth/login').type('form').send({ email: 'owner@example.test', password: 'x' });
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('/organisation/unavailable');
  });

  it('fails closed with only the stable response', async () => {
    const harness = appFor({ kind: 'ORGANISATION_UNAVAILABLE' });
    harness.orchestrate.mockRejectedValueOnce(
      new Error('database membership detail'),
    );
    const response = await request(harness.app)
      .post('/auth/login')
      .set('Accept', 'application/json')
      .send({});

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'Sign-in unavailable' });
    expect(response.text).not.toContain('database membership detail');
  });

  it.each(['passport', 'session'])(
    'contains %s technical failure without reporting success',
    async failure => {
      if (failure === 'passport') {
        controls.passportError = new Error('passport detail');
      }
      const harness = appFor(
        { kind: 'ORGANISATION_UNAVAILABLE' },
        failure !== 'session',
      );
      const response = await request(harness.app)
        .post('/auth/login')
        .set('Accept', 'application/json')
        .send({});
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Sign-in unavailable' });
      expect(response.text).not.toMatch(/passport detail|success/);
      expect(harness.orchestrate).not.toHaveBeenCalled();
    },
  );
});
