import { Router } from 'express';
import { AuditService } from './audit.service.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

const router = Router();

/**
 * GET /audit
 * Display the audit log table
 */
router.get(
  '/',
  requireAuth,
  requirePermission('AUDIT_VIEW'),
  async (req, res, next) => {
    try {
      const filters = {
        table: req.query.table || ''
      };

      const logs = await AuditService.getLogs(
        filters.table ? { table_name: filters.table as string } : {}
      );

      res.render('audit/index', {
        logs,
        title: 'System Audit Log',
        filters
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /audit/export
 * Export logs as JSON/CSV
 */
router.get(
  '/export',
  requireAuth,
  requirePermission('AUDIT_EXPORT'),
  async (req, res, next) => {
    try {
      const logs = await AuditService.getLogs();
      res.json(logs);
    } catch (error) {
      next(error);
    }
  }
);

export default router;