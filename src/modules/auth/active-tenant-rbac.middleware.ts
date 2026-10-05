import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';

type Queryable = Pick<Pool, 'query'>;

export function createActiveTenantRbacHydration(database: Queryable) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user as { id?: unknown; roles?: unknown } | undefined;
      const context = req.tenantContext;
      if (!user || typeof user.id !== 'string' || !context ||
          context.state !== 'VALID_ACTIVE_TENANT' || context.membership.userId !== user.id) {
        if (user) user.roles = [];
        return next();
      }
      const result = await database.query(
        `SELECT r.code,
                COALESCE(json_agg(json_build_object('code', p.code) ORDER BY p.code)
                  FILTER (WHERE p.id IS NOT NULL AND p.is_active = true), '[]'::json) AS permissions
           FROM tenant_memberships tm
           JOIN tenant_membership_roles tmr ON tmr.membership_id = tm.id AND tmr.revoked_at IS NULL
           JOIN rf_role r ON r.id = tmr.role_id AND r.is_active = true
           LEFT JOIN rf_role_permissions rp ON rp.role_id = r.id
           LEFT JOIN rf_permission p ON p.id = rp.permission_id
          WHERE tm.id = $1 AND tm.tenant_id = $2 AND tm.user_id = $3 AND tm.status = 'ACTIVE'
          GROUP BY r.id, r.code ORDER BY r.code`,
        [context.membership.id, context.tenant.id, user.id],
      );
      user.roles = result.rows.map((row: { code: string; permissions?: unknown }) => ({
        code: row.code,
        permissions: Array.isArray(row.permissions) ? row.permissions : [],
      }));
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
