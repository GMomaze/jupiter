import { Request, Response, NextFunction } from "express";
import { User, Role, Permission } from "../models/index.js";

export const refreshRBAC = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user: any = req.user;

    if (!user) {
      return next();
    }

    /**
     * Reload roles + permissions from DB
     * This ensures session RBAC never becomes stale
     */
    const freshUser = await User.findByPk(user.id, {
      include: [
        {
          model: Role,
          through: { attributes: [] },
          include: [
            {
              model: Permission,
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!freshUser) {
      return next();
    }

    const normalizedRoles =
      freshUser.Roles?.map((role: any) => ({
        code: role.code,
        permissions:
          role.Permissions?.map((perm: any) => ({
            code: perm.code,
          })) || [],
      })) || [];

    req.user = {
      id: freshUser.id,
      email: freshUser.email,
      full_name: freshUser.full_name,
      roles: normalizedRoles,
    };

    next();
  } catch (err) {
    console.error("RBAC refresh error:", err);
    next();
  }
};