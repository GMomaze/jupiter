import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import flash from 'connect-flash';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from 'passport';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

import { pool } from './config/database.js';
import { sequelize } from './models/index.js';

// ===============================
// Auth & Core Setup
// ===============================
import { setupAuth } from './modules/auth/auth.config.js';
// FIX: Updated to the consolidated middleware file
import { ensureAuthenticated } from './middleware/auth.middleware.js';

// ===============================
// Domain Routes
// ===============================
import referenceRoutes from './modules/reference/reference.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import staffRoutes from './modules/auth/staff.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import aircraftRoutes from './modules/aircraft/aircraft.routes.js';
import workpackRoutes from './modules/workpacks/workpack.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import mainRouter from './routes/index.js';
import libraryRoutes from './modules/library/library.routes.js';
import projectionRoutes from './modules/projection/projection.routes.js';
import { sessionTimeout } from './middleware/sessionTimeout.js';

// ===============================
// Path Resolution
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ===============================
// View Engine
// ===============================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ===============================
// Core Middleware
// ===============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// ===============================
// Session Setup
// ===============================
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'sessions',
      pruneSessionInterval: 60 * 15,
    }),
    name: 'jupiter.sid',
    secret: process.env.SESSION_SECRET || 'jupiter_dev_secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ===============================
// Passport Setup (MUST be before custom health checks)
// ===============================
setupAuth();
app.use(passport.initialize());
app.use(passport.session());

// ===============================
// Auto-Destroy Corrupted Sessions
// ===============================
app.use((req: any, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();

  try {
    if (req.session && req.session.passport && !req.user) {
      console.warn('⚠️ Invalid passport session detected. Destroying.');
      return req.session.destroy(() => {
        res.clearCookie('jupiter.sid');
        return res.redirect('/auth/login');
      });
    }
    next();
  } catch (err) {
    console.warn('⚠️ Session parse failure. Destroying.');
    if (req.session) {
      return req.session.destroy(() => {
        res.clearCookie('jupiter.sid');
        return res.redirect('/auth/login');
      });
    }
    next();
  }
});

// ===============================
// Flash & Timeout
// ===============================
app.use(flash());
app.use(sessionTimeout);

// ===============================
// CSRF Protection
// ===============================
const csrfProtection = csrf();

app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === 'test' ||
    req.path === '/ping' ||
    req.path.startsWith('/test-sync/')
  ) {
    return next();
  }
  return csrfProtection(req, res, next);
});

// ===============================
// res.locals
// ===============================
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  res.locals.user = req.user || null;
  res.locals.csrfToken =
    process.env.NODE_ENV === 'test'
      ? 'test-token'
      : typeof req.csrfToken === 'function'
      ? req.csrfToken()
      : null;
  next();
});

// ===============================
// Rate Limiting
// ===============================
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    skip: () => process.env.NODE_ENV === 'test',
  })
);

// ===============================
// Public Routes
// ===============================
app.get('/ping', (_req, res) => res.send('PONG'));
app.get('/login', (_req, res) => res.redirect('/auth/login'));

app.use('/auth', authRoutes);
app.use('/auth/staff', staffRoutes);

// ===============================
// Protected Routes
// ===============================
app.use('/library', ensureAuthenticated, libraryRoutes);
app.use('/aircraft', ensureAuthenticated, aircraftRoutes);
app.use('/projection', ensureAuthenticated, projectionRoutes);
app.use('/reference', ensureAuthenticated, referenceRoutes);
app.use('/workpacks', ensureAuthenticated, workpackRoutes);
app.use('/inventory', ensureAuthenticated, inventoryRoutes);
app.use('/audit', ensureAuthenticated, auditRoutes);

app.use('/', mainRouter);

// ===============================
// HTTPS Enforcement (Production)
// ===============================
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Log DB User for context
sequelize.query('SELECT current_user').then(([rows]) => {
  console.log('DB USER:', rows);
});

export default app;