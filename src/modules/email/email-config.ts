export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
  appBaseUrl: string;
}

const APP_BASE_URL_PATTERN = /^https?:\/\/[^\s/]+(?::\d+)?(?:\/[^\s]*)?$/i;

export function normalizeAppBaseUrl(value: string | undefined): string {
  const v = (value ?? '').trim().replace(/\/+$/, '');
  if (!v || !APP_BASE_URL_PATTERN.test(v)) {
    throw new Error('APP_BASE_URL_INVALID');
  }
  return v;
}

export function loadSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig {
  const host = (env.SMTP_HOST ?? '').trim();
  const portRaw = (env.SMTP_PORT ?? '').trim();
  const port = portRaw === '' ? 0 : Number(portRaw);
  const secure = env.SMTP_SECURE === 'true' || env.SMTP_SECURE === '1';
  const user = (env.SMTP_USER ?? '').trim();
  const password = env.SMTP_PASSWORD ?? '';
  const from = (env.SMTP_FROM ?? '').trim();
  const fromName = (env.SMTP_FROM_NAME ?? '').trim() || 'Jupiter';
  const appBaseUrl = normalizeAppBaseUrl(env.APP_BASE_URL);

  if (!host) throw new Error('SMTP_HOST_REQUIRED');
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('SMTP_PORT_INVALID');
  if (!from) throw new Error('SMTP_FROM_REQUIRED');

  return { host, port, secure, user, password, from, fromName, appBaseUrl };
}

export function buildInvitationAcceptUrl(
  appBaseUrl: string,
  token: string,
  tenantId: string,
): string {
  return `${appBaseUrl}/auth/staff-invitations/accept?token=${encodeURIComponent(
    token,
  )}&tenant=${encodeURIComponent(tenantId)}`;
}

const NOTIFICATION_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Resolves the operational System Owner notification recipient from the
 * environment. This is a delivery-only address: it grants no platform or
 * tenant authority and does not affect the canonical System Owner login
 * identity.
 *
 * Returns `undefined` when unset (the caller falls back to the canonical
 * System Owner identity) and throws `SYSTEM_OWNER_NOTIFICATION_EMAIL_INVALID`
 * when set but malformed, so the caller can fail safely without sending to an
 * invalid address or rolling back authoritative onboarding state.
 */
export function loadSystemOwnerNotificationEmail(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const raw = (env.SYSTEM_OWNER_NOTIFICATION_EMAIL ?? '').trim();
  if (!raw) return undefined;
  if (!NOTIFICATION_EMAIL_PATTERN.test(raw)) {
    throw new Error('SYSTEM_OWNER_NOTIFICATION_EMAIL_INVALID');
  }
  return raw.toLowerCase();
}
