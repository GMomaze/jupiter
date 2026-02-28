import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { verifyPassword } from './password.util.js';
import { UserService } from './UserService.js';

const userService = new UserService();

export function configurePassport() {
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  }, async (email, password, done) => {
    try {
      const user = await userService.findForAuth(email);

      // Rule: Reject if user doesn't exist
      if (!user) return done(null, false, { message: 'Invalid credentials.' });

      // Rule: ENFORCE is_active (Requirement 2.1)
      if (!user.is_active) {
        return done(null, false, { message: 'Account is deactivated.' });
      }

      // Rule: Verify Argon2 Hash
      const isValid = await verifyPassword(user.password_hash, password);
      if (!isValid) return done(null, false, { message: 'Invalid credentials.' });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await userService.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}