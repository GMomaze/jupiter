import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { verifyPassword } from './password.util.js';
import { UserService } from './UserService.js';

const userService = new UserService();

export function configurePassport() {

  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email, password, done) => {

      try {

        const user = await userService.findForAuth(email);

        if (!user) {
          return done(null, false, { message: 'Invalid credentials.' });
        }

        if (!user.is_active) {
          return done(null, false, { message: 'Account is deactivated.' });
        }

        const valid = await verifyPassword(user.password_hash, password);

        if (!valid) {
          return done(null, false, { message: 'Invalid credentials.' });
        }

        /**
         * Build permission list
         */
        const permissions = [];

        if (user.Roles) {
          for (const role of user.Roles) {

            if (role.Permissions) {

              for (const perm of role.Permissions) {

                permissions.push(perm.code);

              }

            }

          }
        }

        const sessionUser = {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          roles: user.Roles?.map(r => r.code) || [],
          permissions
        };

        return done(null, sessionUser);

      } catch (err) {

        return done(err);

      }

    }
  ));

  passport.serializeUser((user, done) => {

    done(null, user);

  });

  passport.deserializeUser(async (user, done) => {

    done(null, user);

  });

}