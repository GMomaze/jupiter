import { Router, type RequestHandler } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { assertTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import {
  uploadDeliveryService,
  type UploadDeliveryService,
} from './upload-delivery.service.js';

function notFound(res: Parameters<RequestHandler>[1]) {
  return res.status(404).send('Not found');
}

export function createUploadDeliveryRouter(
  requireValidActiveTenantContext: RequestHandler,
  service: UploadDeliveryService = uploadDeliveryService,
) {
  const router = Router();

  router.get('/aircraft/:filename', requireAuth, requireValidActiveTenantContext, async (req, res, next) => {
    try {
      assertTenantQueryAuthority(req.tenantAuthority);
      const file = await service.aircraftPhoto(req.tenantAuthority, req.params.filename);
      if (!file) return notFound(res);
      res.set('Cache-Control', 'private, no-store');
      return res.sendFile(file.absolutePath);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/manufacturers/:filename', requireAuth, async (req, res, next) => {
    try {
      const file = await service.manufacturerLogo(req.params.filename);
      if (!file) return notFound(res);
      res.set('Cache-Control', 'private, max-age=0, must-revalidate');
      return res.sendFile(file.absolutePath);
    } catch (error) {
      return next(error);
    }
  });

  router.use((error: unknown, _req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]) => {
    if (error instanceof URIError) return notFound(res);
    return next(error);
  });
  router.use((_req, res) => notFound(res));
  return router;
}
