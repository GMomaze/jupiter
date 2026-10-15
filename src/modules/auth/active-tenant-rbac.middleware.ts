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
        `SELECT role_code, permissions FROM public.resolve_authenticated_membership_roles($1, $2, $3)`,
        [user.id, context.membership.id, context.tenant.id],
      );
      user.roles = result.rows.map((row: { role_code: string; permissions?: unknown }) => ({
        code: row.role_code,
        permissions: Array.isArray(row.permissions) ? row.permissions : [],
      }));
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
