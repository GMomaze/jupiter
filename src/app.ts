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
import { ensureAuthenticated } from './middleware/auth.middleware.js';
import { refreshRBAC } from './middleware/rbacRefresh.middleware.js';

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
// Trust proxy
// ===============================
app.set('trust proxy', 1);

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
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15,
    }),
    name: 'jupiter.sid',
    secret: process.env.SESSION_SECRET || 'jupiter_dev_secret',
    resave: false,
    saveUninitialized: true,
    rolling: true,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === 'production' &&
        process.env.HTTPS === 'true',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ===============================
// Session Safety Middleware
// Prevent Passport crash if session missing
// ===============================
app.use((req: any, res, next) => {
  if (!req.session) {
    console.warn('⚠️ Request without session detected');
  }
  next();
});

// ===============================
// Passport Setup
// ===============================
setupAuth();

app.use(passport.initialize());
app.use(passport.session());

// ===============================
// RBAC Refresh Middleware
// Ensures permissions are always fresh
// ===============================
app.use(refreshRBAC);

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
app.use((req: any, res, next) => {
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
// HTTPS Enforcement
// ===============================
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ===============================
// DB Identity Logging
// ===============================
sequelize.query('SELECT current_user, session_user').then(([rows]) => {
  console.log('DB IDENTITY-:', rows);
});

export default app;