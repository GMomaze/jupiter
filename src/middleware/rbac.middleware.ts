import { Request, Response, NextFunction } from 'express';

export const requirePermission = (permissionCode: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user: any = req.user;
    
    // Roles are eager-loaded by Sequelize, available on `user.roles`
    const roles = user?.roles || [];
    
    // Permissions are nested inside each role
    const permissions = roles.flatMap((r: any) => r.permissions || []);
    
    const hasPerm = permissions.some((p: any) => p.code === permissionCode);

    if (!hasPerm) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ error: `Missing permission: ${permissionCode}` });
      }
      return res.status(403).render('errors/403', { message: 'Insufficient Permissions' });
    }
    next();
  };
};

export const requireRole = (roleCode: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user: any = req.user;
    const roles = user?.roles || [];
    const hasRole = roles.some((r: any) => r.code === roleCode);
    
    if (!hasRole) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ error: `Requires ${roleCode} role` });
      }
      return res.status(403).render('errors/403', { message: `Access Denied: Requires ${roleCode}` });
    }
    next();
  };
};

export default { requireRole, requirePermission };