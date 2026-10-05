import nodemailer from 'nodemailer';
import type { PlatformUserInvitationDelivery, PlatformUserInvitationDeliveryMessage } from '../platform-authority/platform-user-invitation.js';
import { loadSmtpConfig, normalizeAppBaseUrl } from './email-config.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPlatformUserAcceptUrl(appBaseUrl: string, token: string): string {
  return `${normalizeAppBaseUrl(appBaseUrl)}/platform/users/accept?token=${encodeURIComponent(token)}`;
}

export class SmtpPlatformUserInvitationDelivery implements PlatformUserInvitationDelivery {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async deliver(message: PlatformUserInvitationDeliveryMessage): Promise<void> {
    const config = loadSmtpConfig(this.env);
    const url = buildPlatformUserAcceptUrl(config.appBaseUrl, message.token);
    const expiry = message.expiresAt.toISOString();

    const text = [
      'Hello,',
      '',
      'You have been invited to set up a Jupiter platform account.',
      '',
      'Follow this secure, single-use link to continue:',
      url,
      '',
      `This link expires on ${expiry}.`,
      '',
      'When you follow the link you will be asked to set a password.',
      '',
      'If you were not expecting this invitation, please disregard this email.',
      '',
      'Jupiter',
    ].join('\n');

    const html = [
      '<p>Hello,</p>',
      '<p>You have been invited to set up a Jupiter platform account.</p>',
      '<p>Follow this secure, single-use link to continue:</p>',
      `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
      `<p>This link expires on ${escapeHtml(expiry)}.</p>`,
      '<p>When you follow the link you will be asked to set a password.</p>',
      '<p>If you were not expecting this invitation, please disregard this email.</p>',
      '<p>Jupiter</p>',
    ].join('\n');

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user ? { auth: { user: config.user, pass: config.password } } : {}),
    });

    await transporter.sendMail({
      from: `"${config.fromName}" <${config.from}>`,
      to: message.email,
      subject: 'Set up your Jupiter platform account',
      text,
      html,
    });
  }
}
