import { Router, type RequestHandler } from 'express';
import { AuditService } from './audit.service.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { assertTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';

function tableFilter(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function createAuditRouter(requireValidActiveTenantContext: RequestHandler) {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    requirePermission('AUDIT_VIEW'),
    requireValidActiveTenantContext,
    async (req, res, next) => {
      try {
        assertTenantQueryAuthority(req.tenantAuthority);
        const filters = { table: tableFilter(req.query.table) };
        const logs = await AuditService.getLogs(
          req.tenantAuthority,
          filters.table ? { table_name: filters.table } : {},
        );
        res.render('audit/index', { logs, title: 'System Audit Log', filters });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/export',
    requireAuth,
    requirePermission('AUDIT_EXPORT'),
    requireValidActiveTenantContext,
    async (req, res, next) => {
      try {
        assertTenantQueryAuthority(req.tenantAuthority);
        const table = tableFilter(req.query.table);
        const logs = await AuditService.getLogs(
          req.tenantAuthority,
          table ? { table_name: table } : {},
        );
        res.json(logs);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

export default createAuditRouter;
