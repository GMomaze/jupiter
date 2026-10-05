import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import flash from 'connect-flash';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import passport from 'passport';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

import { pool } from './config/database.js';
import { sequelize, Tenant, TenantMembership } from './models/index.js';

// ===============================
// Auth & Core Setup
// ===============================
import { setupAuth } from './modules/auth/auth.config.js';
import { ensureAuthenticated } from './middleware/auth.middleware.js';

// ===============================
// Domain Routes
// ===============================
import referenceRoutes from './modules/reference/reference.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createStaffRouter } from './modules/auth/staff.routes.js';
import customerAuthRoutes from './modules/customer-auth/customer-auth.routes.js';
import customerPortalRoutes from './modules/customer-portal/customer-portal.routes.js';
import { createAuditRouter } from './modules/audit/audit.routes.js';
import { createAircraftRouter } from './modules/aircraft/aircraft.routes.js';
import { createCustomersRouter } from './modules/customers/customers.routes.js';
import { createWorkpackRouter } from './modules/workpacks/workpack.routes.js';
import { createInventoryRouter } from './modules/inventory/inventory.routes.js';
import { createMainRouter } from './routes/index.js';
import { createLibraryRouter } from './modules/library/library.routes.js';
import { createProjectionRouter } from './modules/projection/projection.routes.js';
import serviceBulletinRoutes from './modules/service-bulletins/service-bulletin.routes.js';
import serviceBulletinSyncRoutes from './modules/service-bulletins/service-bulletin-sync.routes.js';
import { PlatformAuthorityRepository } from './modules/platform-authority/platform-authority.repository.js';
import { requireMountedHumanPlatformGate } from './modules/platform-authority/mounted-human-platform-gate.js';
import { sessionTimeout } from './middleware/sessionTimeout.js';
import { formatModelDisplay } from './utils/model-display.js';
import { SequelizeActiveTenantContextRepository } from './modules/tenancy/active-tenant-context.repository.js';
import { ActiveTenantContextService } from './modules/tenancy/active-tenant-context.service.js';
import { OrganisationSelectionService } from './modules/tenancy/organisation-selection.service.js';
import { createOrganisationRouter } from './modules/tenancy/organisation.routes.js';
import { requireTenantSwitchTokenSecret } from './config/tenantSwitchRuntimeSafety.js';
import { createActiveTenantContextMiddleware } from './modules/tenancy/active-tenant-context.middleware.js';
import { createActiveTenantRbacHydration } from './modules/auth/active-tenant-rbac.middleware.js';
import { createActiveOrganisationUiMiddleware } from './modules/tenancy/active-organisation-ui.middleware.js';
import { createTenantSwitchTokenCodec } from './modules/tenancy/tenant-switch-token.js';
import { PostgresTenantSwitchAdvisoryLock } from './modules/tenancy/tenant-switch-advisory-lock.js';
import { TenantSwitchPersistenceRepository } from './modules/tenancy/tenant-switch-persistence.repository.js';
import { TenantSwitchCoordinator } from './modules/tenancy/tenant-switch-coordinator.js';
import { createOrganisationSwitchRouter } from './modules/tenancy/organisation-switch.routes.js';
import { createUploadDeliveryRouter } from './modules/uploads/upload-delivery.routes.js';
import { TenantLifecycleCommandRepository } from './modules/tenancy/tenant-lifecycle-command.repository.js';
import { TenantLifecycleCommandService } from './modules/tenancy/tenant-lifecycle-command.service.js';
import { createTenantLifecycleCommandRouter } from './modules/tenancy/tenant-lifecycle-command.routes.js';
import { TenantAdminRecoveryRepository } from './modules/tenancy/tenant-admin-recovery.js';
import { createStaffInvitationAcceptanceRouter } from './modules/auth/staff-invitation.routes.js';
import { StaffInvitationService, StaffMembershipAdministrationRepository } from './modules/auth/staff-membership-administration.js';
import { SmtpStaffInvitationDelivery } from './modules/email/smtp-staff-invitation-delivery.js';
import { SmtpSystemOwnerNotificationDelivery } from './modules/email/smtp-system-owner-notification-delivery.js';
import { SmtpTenantActivationDelivery } from './modules/email/smtp-tenant-activation-delivery.js';
import { loadSystemOwnerNotificationEmail } from './modules/email/email-config.js';
import { TenantSuspensionAccessCoordinator } from './modules/tenancy/tenant-suspension-access-coordinator.js';
import { createCustomerPortalSuspensionMiddleware } from './modules/customer-portal/customer-portal-suspension.middleware.js';
import { createPlatformAdministrationRouter } from './modules/platform-authority/platform-administration.routes.js';
import { PlatformUserInvitationRepository, PlatformUserInvitationService } from './modules/platform-authority/platform-user-invitation.js';
import { createPlatformUserInvitationAcceptanceRouter } from './modules/platform-authority/platform-user-invitation.routes.js';
import { SmtpPlatformUserInvitationDelivery } from './modules/email/smtp-platform-user-invitation-delivery.js';
import { createHealthRouter } from './modules/observability/health.routes.js';
import { assertProductionRuntimeSafety } from './config/productionRuntimeSafety.js';
import { emitOperationalEvent } from './modules/observability/operational-event.js';

console.log('IP_WHITELIST_ENABLED:', process.env.IP_WHITELIST_ENABLED);
assertProductionRuntimeSafety();
const platformAuthorityRepository = new PlatformAuthorityRepository(pool);

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

app.set('trust proxy', isProduction ? Number(process.env.TRUST_PROXY) : 1);

// ===============================
// View Engine
// ===============================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const publicStatic = express.static(publicDir);
app.use((req, res, next) => {
  if (req.path === '/uploads' || req.path.startsWith('/uploads/')) return next();
  return publicStatic(req, res, next);
});

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
      secure: isProduction,
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

function isMultipartCsrfHandledAtRoute(req: express.Request) {
  if (!req.is('multipart/form-data')) {
    return false;
  }

  if (req.method === 'POST' && /^\/aircraft(?:\/[^/]+)?$/.test(req.path)) {
    return true;
  }

  if (req.method === 'PATCH' && /^\/aircraft\/[^/]+$/.test(req.path)) {
    return true;
  }

  if (req.method === 'POST') {
    return [
      /^\/library\/tasks\/import\/map$/,
      /^\/library\/ads\/import\/preview$/,
      /^\/library\/sbs\/import\/preview$/,
      /^\/library\/manufacturers$/,
      /^\/library\/manufacturers\/[^/]+\/update$/,
      /^\/library\/model\/[^/]+\/sids\/import$/,
      /^\/sb\/sync$/,
      /^\/workpacks\/templates\/import$/,
    ].some((pattern) => pattern.test(req.path));
  }

  return false;
}

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

  if (isMultipartCsrfHandledAtRoute(req)) {
    return next();
  }

  return csrfProtection(req, res, next);
});

const tenantContextRepository = new SequelizeActiveTenantContextRepository(
  sequelize,
);
const tenantContextService = new ActiveTenantContextService(
  tenantContextRepository,
  Date.now,
);
const organisationSelectionService = new OrganisationSelectionService(
  tenantContextService,
  Date.now,
);
const tenantSwitchTokenCodec = createTenantSwitchTokenCodec(
  requireTenantSwitchTokenSecret(),
);
const tenantSuspensionAccessCoordinator = new TenantSuspensionAccessCoordinator(pool);
const { resolveTenantContext, requireValidActiveTenantContext } = createActiveTenantContextMiddleware(
  tenantContextService,
  tenantSuspensionAccessCoordinator,
);
const activeOrganisationUi = createActiveOrganisationUiMiddleware({
  selectionService: organisationSelectionService,
  tokenCodec: tenantSwitchTokenCodec,
});

app.use(resolveTenantContext);
app.use(createActiveTenantRbacHydration(pool));

// ===============================
// Locals
// ===============================
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  res.locals.user = req.user || null;
  res.locals.customerUser = req.session?.customerUser || null;
  res.locals.remoteTestMode = remoteTestMode;
  res.locals.formatModelDisplay = formatModelDisplay;
  res.locals.csrfToken =
    process.env.NODE_ENV === 'test'
      ? 'test-token'
      : typeof req.csrfToken === 'function'
      ? req.csrfToken()
      : null;
  next();
});

app.use(async (req, res, next) => {
  res.locals.canPlatformAdmin = false;
  const userId = (req.user as { id?: unknown } | undefined)?.id;
  if (typeof userId !== 'string') return next();
  try {
    const authority = await platformAuthorityRepository.resolveHuman(userId);
    res.locals.canPlatformAdmin = Boolean(authority?.principalType === 'HUMAN' &&
      authority.capabilities.size > 0);
  } catch {
    res.locals.canPlatformAdmin = false;
  }
  return next();
});

app.use(activeOrganisationUi);

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
const authRoutes = createAuthRouter({
  tenantContextService,
  clock: Date.now,
  isPlatformAdministrator: async (userId) => {
    try {
      const authority = await platformAuthorityRepository.resolveHuman(userId);
      return Boolean(
        authority?.principalType === 'HUMAN' &&
        authority.capabilities.size > 0,
      );
    } catch {
      return false;
    }
  },
});
const organisationRoutes = createOrganisationRouter({
  selectionService: organisationSelectionService,
  csrfProtection,
});
const tenantSwitchCoordinator = new TenantSwitchCoordinator({
  tenantContextService,
  advisoryLock: new PostgresTenantSwitchAdvisoryLock(pool, {
    acquisitionTimeoutMs: 2_000,
    retryIntervalMs: 50,
  }),
  persistence: new TenantSwitchPersistenceRepository(pool),
  tokenCodec: tenantSwitchTokenCodec,
  clock: Date.now,
  idFactory: randomUUID,
});
const organisationSwitchRoutes = createOrganisationSwitchRouter({
  coordinator: tenantSwitchCoordinator,
  csrfProtection,
});
const mainRoutes = createMainRouter(requireValidActiveTenantContext);
const projectionRoutes = createProjectionRouter(requireValidActiveTenantContext);
const auditRoutes = createAuditRouter(requireValidActiveTenantContext);
const uploadDeliveryRoutes = createUploadDeliveryRouter(requireValidActiveTenantContext);
const libraryRoutes = createLibraryRouter(requireValidActiveTenantContext);
const aircraftRoutes = createAircraftRouter(requireValidActiveTenantContext);
const customersRoutes = createCustomersRouter(requireValidActiveTenantContext);
const workpackRoutes = createWorkpackRouter(requireValidActiveTenantContext);
const inventoryRoutes = createInventoryRouter(requireValidActiveTenantContext);
const staffMembershipAdministration = new StaffMembershipAdministrationRepository(pool);
const invitationDelivery = new SmtpStaffInvitationDelivery();
const systemOwnerNotificationDelivery = new SmtpSystemOwnerNotificationDelivery();
const staffInvitationService = new StaffInvitationService(
  staffMembershipAdministration,
  invitationDelivery,
  Date.now,
  {
    delivery: systemOwnerNotificationDelivery,
    recipient: {
      resolve: async () => {
        const configured = loadSystemOwnerNotificationEmail();
        if (configured) return configured;
        return platformAuthorityRepository.resolveSystemOwnerNotificationEmail();
      },
    },
  },
);
const staffRoutes = createStaffRouter(requireValidActiveTenantContext, { administration: staffMembershipAdministration, invitationService: staffInvitationService });
const platformUserInvitationRepository = new PlatformUserInvitationRepository(pool);
const platformUserInvitationService = new PlatformUserInvitationService(platformUserInvitationRepository, new SmtpPlatformUserInvitationDelivery());
const tenantLifecycleCommandRoutes = createTenantLifecycleCommandRouter(
  platformAuthorityRepository,
  new TenantLifecycleCommandService(new TenantLifecycleCommandRepository(), invitationDelivery, new SmtpTenantActivationDelivery()),
  new TenantAdminRecoveryRepository(pool),
);

app.get('/ping', (_req, res) => res.send('PONG'));
app.use('/health', createHealthRouter(pool));

app.get('/offline', (_req, res) => {
  res.send('<h2>Jupiter Offline</h2>');
});

app.use('/auth', authRoutes);
app.use('/auth/staff', staffRoutes);
app.use('/auth/staff-invitations', createStaffInvitationAcceptanceRouter(staffInvitationService));
app.use('/customer-auth', customerAuthRoutes);
app.use('/customer-portal', createCustomerPortalSuspensionMiddleware(tenantSuspensionAccessCoordinator), customerPortalRoutes);
app.use('/organisation', organisationRoutes);
app.use('/organisation', organisationSwitchRoutes);
app.use('/uploads', uploadDeliveryRoutes);
app.use('/platform/users/accept', createPlatformUserInvitationAcceptanceRouter(platformUserInvitationService));
app.use('/platform/tenants', ensureAuthenticated, tenantLifecycleCommandRoutes);
app.use('/platform', ensureAuthenticated, createPlatformAdministrationRouter(platformAuthorityRepository, pool, platformUserInvitationService));

app.get('/compliance-maintenance-data', ensureAuthenticated, (_req, res) => {
  res.render('compliance-maintenance-data/index', {
    title: 'Compliance / Maintenance Data',
  });
});

app.use('/library', ensureAuthenticated, requireMountedHumanPlatformGate(platformAuthorityRepository, 'LIBRARY'), libraryRoutes);
app.use('/service-bulletins', ensureAuthenticated, requireMountedHumanPlatformGate(platformAuthorityRepository, 'SERVICE_BULLETINS'), serviceBulletinRoutes);
app.use('/sb', ensureAuthenticated, requireMountedHumanPlatformGate(platformAuthorityRepository, 'SB_SYNC'), serviceBulletinSyncRoutes);
app.use('/aircraft', ensureAuthenticated, aircraftRoutes);
app.use('/customers', ensureAuthenticated, customersRoutes);
app.use('/projection', ensureAuthenticated, projectionRoutes);
app.use('/reference', ensureAuthenticated, requireMountedHumanPlatformGate(platformAuthorityRepository, 'REFERENCE'), referenceRoutes);
app.use('/workpacks', ensureAuthenticated, workpackRoutes);
app.use('/inventory', ensureAuthenticated, inventoryRoutes);
app.use('/audit', ensureAuthenticated, auditRoutes);

app.use('/', mainRoutes);

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

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const csrfFailure = error instanceof Error && (error as Error & { code?: string }).code === 'EBADCSRFTOKEN';
  emitOperationalEvent({code:csrfFailure?'CSRF_REFUSED':'APPLICATION_FAILURE',severity:csrfFailure?'WARN':'ERROR',outcome:csrfFailure?'DENIED':'FAILED',operation:csrfFailure?'CSRF':'HTTP_REQUEST',error});
  return csrfFailure ? res.status(403).send('Request unavailable.') : res.status(500).send('Internal server error.');
});

export default app;
