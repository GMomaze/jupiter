import { Request, Response, NextFunction } from 'express';

/**
 * Permission-based access control
 */
export const requirePermission = (permissionCode: string) => {
  return (req: Request, res: Response, next: NextFunction) => {

    const user: any = req.user;

    if (!user) {
      return res.status(401).send("Not authenticated");
    }

    const roles = user.roles || [];

    /**
     * Flatten permissions once
     */
    const permissions = roles.flatMap((r: any) => r.permissions || []);

    const hasPerm = permissions.some((p: any) => p.code === permissionCode);

    if (!hasPerm) {

      console.warn(
        `>>> [RBAC] Access Denied: User ${user.id} lacks ${permissionCode}`
      );

      /**
       * JSON / API request
       */
      if (req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          error: `Missing permission: ${permissionCode}`
        });
      }

      /**
       * HTMX request
       */
      if (req.headers['hx-request']) {
        return res.status(403).send(`
          <div class="p-4 bg-red-50 border-2 border-red-200 rounded-lg shadow-sm">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[10px] font-black text-red-700 uppercase tracking-widest">
                Permission Denied
              </span>
            </div>
            <p class="text-[11px] text-red-600 font-medium">
              Your account lacks the 
              <span class="font-bold underline">${permissionCode}</span>
              permission.
            </p>
          </div>
        `);
      }

      /**
       * Normal browser request
       */
      return res.status(403).render('errors/403', {
        permission: permissionCode,
        message: 'Insufficient Permissions'
      });

    }

    next();
  };
};

/**
 * Role-based access control
 */
export const requireRole = (roleCode: string) => {
  return (req: Request, res: Response, next: NextFunction) => {

    const user: any = req.user;

    if (!user) {
      return res.status(401).send("Not authenticated");
    }

    const roles = user.roles || [];

    const hasRole = roles.some((r: any) => r.code === roleCode);

    if (!hasRole) {

      console.warn(
        `>>> [RBAC] Access Denied: User ${user.id} lacks role ${roleCode}`
      );

      if (req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          error: `Requires ${roleCode} role`
        });
      }

      if (req.headers['hx-request']) {
        return res.status(403).send(`
          <div class="p-4 bg-red-50 border-2 border-red-200 rounded-lg shadow-sm">
            <span class="text-[10px] font-black text-red-700 uppercase tracking-widest block mb-1">
              Role Restricted
            </span>
            <p class="text-[11px] text-red-600">
              Requires role: ${roleCode}
            </p>
          </div>
        `);
      }

      return res.status(403).render('errors/403', {
        permission: roleCode,
        message: `Access Denied: Requires ${roleCode}`
      });
    }

    next();
  };
};

export default { requireRole, requirePermission };