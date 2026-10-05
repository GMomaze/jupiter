import nodemailer from 'nodemailer';
import type {
  InvitationDeliveryMessage,
  StaffInvitationDelivery,
} from '../auth/staff-membership-administration.js';
import { buildInvitationAcceptUrl, loadSmtpConfig } from './email-config.js';

interface EmailBody {
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExpiry(expiresAt: Date): string {
  return expiresAt.toISOString();
}

function sanitizeCommand(value: string): string {
  // AUTH commands may carry a base64 credential payload; redact any trailing blob.
  return value
    .replace(/\s[A-Za-z0-9+/]{16,}={0,2}\b/g, ' [REDACTED]')
    .slice(0, 120);
}

function sanitizeResponse(value: string): string {
  return value
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export function sanitizeSmtpDiagnostic(error: unknown): Readonly<Record<string, unknown>> {
  const diagnostic: Record<string, unknown> = {};
  if (error instanceof Error) {
    diagnostic.name = error.name || 'Error';
    const e = error as Error & { code?: unknown; responseCode?: unknown; command?: unknown; response?: unknown };
    if (typeof e.code === 'string' && e.code) diagnostic.code = e.code;
    if (typeof e.responseCode === 'number') diagnostic.responseCode = e.responseCode;
    else if (typeof e.responseCode === 'string' && e.responseCode) diagnostic.responseCode = e.responseCode;
    if (typeof e.command === 'string' && e.command) diagnostic.command = sanitizeCommand(e.command);
    if (typeof e.response === 'string' && e.response) diagnostic.response = sanitizeResponse(e.response);
  } else {
    diagnostic.name = 'NonError';
  }
  return Object.freeze(diagnostic);
}

function logSmtpFailure(error: unknown): void {
  console.error('[SMTP_DELIVERY_FAILED] ' + JSON.stringify(sanitizeSmtpDiagnostic(error)));
}

export class SmtpStaffInvitationDelivery implements StaffInvitationDelivery {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async deliver(message: InvitationDeliveryMessage): Promise<void> {
    const config = loadSmtpConfig(this.env);
    const url = buildInvitationAcceptUrl(config.appBaseUrl, message.token, message.tenantId);
    const subject = message.initialAdmin
      ? `Set up your Jupiter account for ${message.tenantName}`
      : `You have been invited to join ${message.tenantName} in Jupiter`;
    const body = this.buildBody(message, url);

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user ? { auth: { user: config.user, pass: config.password } } : {}),
    });

    try {
      await transporter.sendMail({
        from: `"${config.fromName}" <${config.from}>`,
        to: message.email,
        subject,
        text: body.text,
        html: body.html,
      });
    } catch (error) {
      logSmtpFailure(error);
      throw error;
    }
  }

  private buildBody(message: InvitationDeliveryMessage, url: string): EmailBody {
    const company = message.tenantName || 'your company';
    const expiry = formatExpiry(message.expiresAt);
    const role = message.initialAdmin
      ? 'the initial administrator account'
      : 'a staff account';

    const text = [
      'Hello,',
      '',
      `You have been invited to set up ${role} for ${company} in Jupiter.`,
      '',
      `Follow this secure, single-use link to continue:`,
      url,
      '',
      `This link expires on ${expiry}.`,
      '',
      message.initialAdmin
        ? 'When you follow the link you will be asked to create your account and set a password.'
        : 'When you follow the link you will be asked to complete your account setup.',
      '',
      'If you were not expecting this invitation, please disregard this email.',
      '',
      'Jupiter',
    ].join('\n');

    const html = [
      `<p>Hello,</p>`,
      `<p>You have been invited to set up ${escapeHtml(role)} for <strong>${escapeHtml(company)}</strong> in Jupiter.</p>`,
      `<p>Follow this secure, single-use link to continue:</p>`,
      `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
      `<p>This link expires on ${escapeHtml(expiry)}.</p>`,
      message.initialAdmin
        ? `<p>When you follow the link you will be asked to create your account and set a password.</p>`
        : `<p>When you follow the link you will be asked to complete your account setup.</p>`,
      `<p>If you were not expecting this invitation, please disregard this email.</p>`,
      `<p>Jupiter</p>`,
    ].join('\n');

    return { text, html };
  }
}
