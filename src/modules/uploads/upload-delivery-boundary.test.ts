import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(file), 'utf8');

describe('MT-4C7B mounted upload boundary', () => {
  it('removes broad static uploads and prevents public static fallback', () => {
    const app = read('src/app.ts');
    expect(app).not.toContain("app.use('/uploads', express.static(uploadsDir))");
    expect(app).toContain("req.path.startsWith('/uploads/')");
    expect(app).toContain("app.use('/uploads', uploadDeliveryRoutes)");
  });

  it('orders Aircraft authentication, active tenant, and authentic authority', () => {
    const routes = read('src/modules/uploads/upload-delivery.routes.ts');
    expect(routes).toMatch(/router\.get\('\/aircraft\/:filename', requireAuth, requireValidActiveTenantContext/);
    expect(routes).toContain('assertTenantQueryAuthority(req.tenantAuthority)');
    expect(routes).toContain('service.aircraftPhoto(req.tenantAuthority, req.params.filename)');
    expect(routes).not.toMatch(/req\.(?:query|body|headers).*tenant/i);
  });

  it('keeps Manufacturer delivery authenticated/shared and denies every unmatched upload path', () => {
    const routes = read('src/modules/uploads/upload-delivery.routes.ts');
    expect(routes).toMatch(/router\.get\('\/manufacturers\/:filename', requireAuth, async/);
    expect(routes).not.toMatch(/manufacturers\/:filename', requireAuth, requireValidActiveTenantContext/);
    expect(routes).toContain("router.use((_req, res) => notFound(res))");
    expect(routes).not.toContain('express.static');
  });
});
