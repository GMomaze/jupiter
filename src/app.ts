import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import flash from 'connect-flash';
import path from 'path';
import fs from 'fs';
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
import serviceBulletinRoutes from './modules/service-bulletins/service-bulletin.routes.js';
import serviceBulletinSyncRoutes from './modules/service-bulletins/service-bulletin-sync.routes.js';
import { sessionTimeout } from './middleware/sessionTimeout.js';

console.log('IP_WHITELIST_ENABLED:', process.env.IP_WHITELIST_ENABLED);

// ===============================
// Path Resolution
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '..', 'uploads');
const publicDir = path.resolve(__dirname, '..', 'public');
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;

// ✅ FIXED
const remoteTestMode = process.env.REMOTE_TEST_MODE === 'true';

const remoteTestUser = process.env.REMOTE_TEST_USER;
const remoteTestPass = process.env.REMOTE_TEST_PASS;

// ===============================
// 🔒 ENV-DRIVEN SAFE IP WHITELIST
// ===============================
const ipWhitelistEnabled = process.env.IP_WHITELIST_ENABLED === 'true';

const allowedIPs = (process.env.ALLOWED_IPS || '')
  .split(',')
  .map(ip => ip.trim())
  .filter(Boolean);

function getClientIP(req: express.Request) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.toString().split(',')[0]?.trim() || '';
  }
  return req.socket.remoteAddress || '';
}

function isLocalRequest(req: express.Request) {
  const forwardedHost = req.headers['x-forwarded-host'];
  const hostHeader = String(
    Array.isArray(forwardedHost)
      ? forwardedHost[0]
      : forwardedHost || req.headers.host || ''
  );
  const hostname = hostHeader.split(':')[0]?.toLowerCase() || '';

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

if (isProduction && (!sessionSecret || sessionSecret === 'jupiter_dev_secret')) {
  throw new Error('SESSION_SECRET must be set to a strong value in production.');
}

if (
  remoteTestMode &&
  (!remoteTestUser || !remoteTestPass) &&
  isProduction
) {
  throw new Error(
    'REMOTE_TEST_USER and REMOTE_TEST_PASS must be set when REMOTE_TEST_MODE=true in production.'
  );
}

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const app = express();

app.set('trust proxy', 1);

// ===============================
// View Engine
// ===============================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/uploads', express.static(uploadsDir));
app.use(express.static(publicDir));

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

const sessionStore = new PgSession({
  pool,
  tableName: 'sessions',
  pruneSessionInterval: 60 * 15,
});

// Add error handler to session store
sessionStore.on('error', (err) => {
  console.error('❌ Session Store Error:', err);
});

app.use(
  session({
    store: sessionStore,
    name: 'jupiter.sid',
    secret: sessionSecret || 'jupiter_dev_secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: isProduction,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ===============================
// Passport Setup
// ===============================
setupAuth();
app.use(passport.initialize());
app.use(passport.session());

// ===============================
// Session Diagnostic Middleware
// ===============================
app.use((req: any, res, next) => {
  if (!req.session) {
    console.warn('⚠️ WARNING: Session not initialized for request:', req.path);
  }
  next();
});

// ===============================
// 🔒 IP WHITELIST (FIXED POSITION)
// ===============================
app.use((req, res, next) => {
  if (!ipWhitelistEnabled) return next();

  const ip = getClientIP(req);

  if (allowedIPs.length === 0) return next();

  if (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.')
  ) {
    return next();
  }

  if (allowedIPs.includes(ip)) {
    return next();
  }

  console.warn('🚫 Blocked IP:', ip, 'URL:', req.originalUrl);

  return res.status(403).send('Access denied');
});

// ===============================
// REMOTE TEST MODE
// ===============================
if (remoteTestMode) {
  app.use((req, res, next) => {
    const host =
      req.headers['x-forwarded-host'] ||
      req.headers.host ||
      '';

    if (
      req.path === '/ping' ||
      req.path === '/offline' ||
      isLocalRequest(req) ||
      (typeof host === 'string' && host.includes('ngrok'))
    ) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Basic ')) {
      const encoded = authHeader.slice(6);
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const separatorIndex = decoded.indexOf(':');
      const username =
        separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : decoded;
      const password =
        separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : '';

      if (username === remoteTestUser && password === remoteTestPass) {
        return next();
      }
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Jupiter Remote Test"');
    return res.status(401).send('Remote test authentication required.');
  });
}

// ===============================
// Session Cleanup
// ===============================
app.use((req: any, res, next) => {
  if (process.env.NODE_ENV === 'test') return next();

  if (!req.session) {
    return next();
  }

  try {
    if (req.session && req.session.passport && !req.user) {
      return req.session.destroy(() => {
        res.clearCookie('jupiter.sid');
        return res.redirect('/auth/login');
      });
    }
    next();
  } catch {
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
// CSRF
// ===============================
const csrfProtection = csrf();

app.use((req, res, next) => {
  const host =
    req.headers['x-forwarded-host'] ||
    req.headers.host ||
    '';

  if (
    process.env.NODE_ENV === 'test' ||
    req.path === '/ping' ||
    req.path === '/offline' ||
    req.path.startsWith('/test-sync/') ||
    (typeof host === 'string' && host.includes('ngrok'))
  ) {
    return next();
  }

  return csrfProtection(req, res, next);
});

// ===============================
// Locals
// ===============================
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  res.locals.user = req.user || null;
  res.locals.remoteTestMode = remoteTestMode;
  res.locals.csrfToken =
    process.env.NODE_ENV === 'test'
      ? 'test-token'
      : typeof req.csrfToken === 'function'
      ? req.csrfToken()
      : null;
  next();
});

// ===============================
// Rate Limit
// ===============================
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    skip: (req: any) =>
      process.env.NODE_ENV === 'test' ||
      Boolean(req.user),
  })
);

// ===============================
// Routes
// ===============================
app.get('/ping', (_req, res) => res.send('PONG'));

app.get('/offline', (_req, res) => {
  res.send('<h2>Jupiter Offline</h2>');
});

app.use('/auth', authRoutes);
app.use('/auth/staff', staffRoutes);

app.use('/library', ensureAuthenticated, libraryRoutes);
app.use('/service-bulletins', ensureAuthenticated, serviceBulletinRoutes);
app.use('/sb', ensureAuthenticated, serviceBulletinSyncRoutes);
app.use('/aircraft', ensureAuthenticated, aircraftRoutes);
app.use('/projection', ensureAuthenticated, projectionRoutes);
app.use('/reference', ensureAuthenticated, referenceRoutes);
app.use('/workpacks', ensureAuthenticated, workpackRoutes);
app.use('/inventory', ensureAuthenticated, inventoryRoutes);
app.use('/audit', ensureAuthenticated, auditRoutes);

app.use('/', mainRouter);

// ===============================
// HTTPS (Production)
// ===============================
if (isProduction) {
  app.use((req, res, next) => {
    if (isLocalRequest(req)) {
      return next();
    }

    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

sequelize.query('SELECT current_user').then(([rows]) => {
  console.log('DB USER:', rows);
});

export default app;
