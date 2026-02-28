import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { verifyPassword } from './password.util.js';

import { User, Role, Permission } from '../../models/index.js';

export function setupAuth() {
  /* ============================================================
     Local Strategy
  ============================================================ */

  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        try {
          const user = await User.findOne({
            where: { email: email.toLowerCase().trim() },
          });

          if (!user || !user.is_active) {
            return done(null, false, { message: 'Invalid credentials.' });
          }

          const isValid = await verifyPassword(
            user.password_hash,
            password
          );

          if (!isValid) {
            return done(null, false, { message: 'Invalid credentials.' });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  /* ============================================================
     Serialize
  ============================================================ */

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  /* ============================================================
     Deserialize (Hydrated RBAC Version)
  ============================================================ */

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findByPk(id, {
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

      if (!user || !user.is_active) {
        return done(null, false);
      }

      // Normalize RBAC shape for middleware
      const normalizedRoles =
        user.Roles?.map((role: any) => ({
          code: role.code,
          permissions:
            role.Permissions?.map((perm: any) => ({
              code: perm.code,
            })) || [],
        })) || [];

      return done(null, {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        roles: normalizedRoles,
      });
    } catch (err) {
      return done(err);
    }
  });
}