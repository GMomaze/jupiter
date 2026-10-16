import nodemailer from 'nodemailer';
import type {
  PasswordResetDelivery,
  PasswordResetDeliveryMessage,
} from '../auth/password-recovery.js';
import { buildPasswordResetUrl, loadSmtpConfig } from './email-config.js';
import { sanitizeSmtpDiagnostic } from './smtp-staff-invitation-delivery.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class SmtpPasswordResetDelivery implements PasswordResetDelivery {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async deliver(message: PasswordResetDeliveryMessage): Promise<void> {
    const config = loadSmtpConfig(this.env);
    const url = buildPasswordResetUrl(config.appBaseUrl, message.token);
    const expiry = message.expiresAt.toISOString();

    const text = [
      'Hello,',
      '',
      'A password reset was requested for your Jupiter account.',
      '',
      'Follow this secure, single-use link to choose a new password:',
      url,
      '',
      `This link expires on ${expiry}.`,
      '',
      'If you did not request a password reset, you can safely ignore this email.',
      '',
      'Jupiter',
    ].join('\n');

    const html = [
      '<p>Hello,</p>',
      '<p>A password reset was requested for your Jupiter account.</p>',
      '<p>Follow this secure, single-use link to choose a new password:</p>',
      `<p><a href="${escapeHtml(url)}">Reset my password</a></p>`,
      `<p>This link expires on ${escapeHtml(expiry)}.</p>`,
      '<p>If you did not request a password reset, you can safely ignore this email.</p>',
      '<p>Jupiter</p>',
    ].join('\n');

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
        subject: 'Jupiter password reset',
        text,
        html,
      });
    } catch (error) {
      console.error('[SMTP_PASSWORD_RESET_FAILED] ' + JSON.stringify(sanitizeSmtpDiagnostic(error)));
      throw error;
    }
  }
}
