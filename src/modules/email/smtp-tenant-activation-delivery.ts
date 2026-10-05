import nodemailer from 'nodemailer';
import type {
  TenantActivationDelivery,
  TenantActivationDeliveryMessage,
} from '../tenancy/tenant-lifecycle-command.service.js';
import { loadSmtpConfig } from './email-config.js';
import { sanitizeSmtpDiagnostic } from './smtp-staff-invitation-delivery.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Delivers the "company activated" notification to the initial tenant
 * administrator after activation has committed. Delivery is best-effort: the
 * authoritative activation is already committed, and a delivery failure is
 * logged (without secrets) but never rolls back or invalidates activation.
 */
export class SmtpTenantActivationDelivery implements TenantActivationDelivery {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async deliver(message: TenantActivationDeliveryMessage): Promise<void> {
    const config = loadSmtpConfig(this.env);
    const company = message.companyDisplayName || 'Your company';
    const signInUrl = `${config.appBaseUrl}/auth/login`;

    const subject = `${company} has been activated in Jupiter`;

    const text = [
      `${company} has been activated in Jupiter.`,
      '',
      'Your company administrator account is now active and you can sign in and start using Jupiter.',
      '',
      'Sign in:',
      signInUrl,
      '',
      'Jupiter',
    ].join('\n');

    const html = [
      `<p><strong>${escapeHtml(company)}</strong> has been activated in Jupiter.</p>`,
      '<p>Your company administrator account is now active and you can sign in and start using Jupiter.</p>',
      `<p>Sign in:<br><a href="${escapeHtml(signInUrl)}">${escapeHtml(signInUrl)}</a></p>`,
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
        subject,
        text,
        html,
      });
    } catch (error) {
      console.error('[TENANT_ACTIVATION_DELIVERY_FAILED] ' + JSON.stringify(sanitizeSmtpDiagnostic(error)));
      throw new Error('TENANT_ACTIVATION_DELIVERY_FAILED');
    }
  }
}
