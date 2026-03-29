import { Request, Response, NextFunction } from 'express';

const normalizeRoleCode = (role: any): string | null => {
  if (typeof role === 'string') return role;
  if (role && typeof role.code === 'string') return role.code;
  return null;
};

const normalizePermissions = (role: any): any[] => {
  if (role && Array.isArray(role.permissions)) return role.permissions;
  if (role && Array.isArray(role.Permissions)) return role.Permissions;
  return [];
};

const buildRoleAccessMessage = (acceptedRoleCodes: string[]) => {
  const normalized = [...acceptedRoleCodes].sort().join(',');

  if (normalized === 'ENGINEER,MECHANIC') {
    return {
      eyebrow: 'Workpack Access Restricted',
      title: 'Execution Access Limited',
      message: 'This workpack is currently in execution. Only engineers and mechanics can access it and perform tasks.',
      detail: 'If you need to make changes, reopen the workpack or contact your planner.'
    };
  }

  return {
    eyebrow: 'Access Restricted',
    title: '403 Forbidden',
    message: `Access Denied: Requires one of ${acceptedRoleCodes.join(', ')}`,
    detail: null
  };
};

export const requirePermission = (permissionCode: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user: any = req.user;
    
    const roles = user?.roles || [];
    const roleCodes = roles
      .map((role: any) => normalizeRoleCode(role))
      .filter(Boolean);

    if (roleCodes.includes('ADMIN')) {
      return next();
    }

    const permissions = roles.flatMap((role: any) => normalizePermissions(role));
    const hasPerm = permissions.some((perm: any) => {
      if (typeof perm === 'string') return perm === permissionCode;
      return perm?.code === permissionCode;
    });

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
    const roleCodes = roles
      .map((role: any) => normalizeRoleCode(role))
      .filter(Boolean);
    const hasRole =
      roleCodes.includes('ADMIN') ||
      roleCodes.includes(roleCode);
    
    if (!hasRole) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ error: `Requires ${roleCode} role` });
      }
      return res.status(403).render('errors/403', { message: `Access Denied: Requires ${roleCode}` });
    }
    next();
  };
};

export const requireAnyRole = (...acceptedRoleCodes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user: any = req.user;
    const roles = user?.roles || [];
    const roleCodes = roles
      .map((role: any) => normalizeRoleCode(role))
      .filter(Boolean);

    const hasRole =
      roleCodes.includes('ADMIN') ||
      acceptedRoleCodes.some((roleCode) => roleCodes.includes(roleCode));

    if (!hasRole) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          error: `Requires one of: ${acceptedRoleCodes.join(', ')}`,
        });
      }
      const viewModel = buildRoleAccessMessage(acceptedRoleCodes);
      return res.status(403).render('errors/403', {
        ...viewModel,
      });
    }

    next();
  };
};

export default { requireRole, requireAnyRole, requirePermission };
