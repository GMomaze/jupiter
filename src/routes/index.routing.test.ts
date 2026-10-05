import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../modules/dashboard/dashboard-metrics.service.live.js', () => ({
  dashboardMetricsService: { load: vi.fn(async () => ({ title: 'Dashboard' })) },
}));

import { createMainRouter } from './index.js';

function makeApp(opts: { platformAdmin: boolean; activeTenant: boolean }) {
  const app = express();
  app.use((req: any, res: any, next: any) => {
    (req as any).isAuthenticated = () => true;
    res.locals.canPlatformAdmin = opts.platformAdmin;
    (req as any).session = { activeTenantContext: opts.activeTenant ? { tenantId: 't', membershipId: 'm' } : undefined };
    next();
  });
  const gate = vi.fn((_req: any, _res: any, next: any) => next());
  app.use('/', createMainRouter(gate as any));
  return { app, gate };
}

describe('GET / platform-administrator routing repair', () => {
  it('redirects a platform administrator with no tenant context to /platform', async () => {
    const { app, gate } = makeApp({ platformAdmin: true, activeTenant: false });
    const res = await request(app).get('/');
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/platform');
    expect(gate).not.toHaveBeenCalled();
  });

  it('does not force /platform for a platform administrator with an active tenant context', async () => {
    const { app, gate } = makeApp({ platformAdmin: true, activeTenant: true });
    const res = await request(app).get('/');
    expect(res.headers.location).not.toBe('/platform');
    expect(gate).toHaveBeenCalled();
  });

  it('does not redirect an ordinary tenant user to /platform', async () => {
    const { app, gate } = makeApp({ platformAdmin: false, activeTenant: false });
    const res = await request(app).get('/');
    expect(res.headers.location).not.toBe('/platform');
    expect(gate).toHaveBeenCalled();
  });
});

