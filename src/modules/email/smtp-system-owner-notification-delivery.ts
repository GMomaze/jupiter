import nodemailer from 'nodemailer';
import type {
  SystemOwnerNotificationDelivery,
  SystemOwnerNotificationMessage,
} from '../auth/staff-membership-administration.js';
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
 * Delivers the "initial administrator onboarding completed" notification to the
 * Jupiter System Owner. This is a best-effort notification: the authoritative
 * onboarding state is committed before this runs, and a delivery failure is
 * logged (without secrets) but never rolls back or invalidates onboarding.
 */
export class SmtpSystemOwnerNotificationDelivery implements SystemOwnerNotificationDelivery {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async deliver(message: SystemOwnerNotificationMessage): Promise<void> {
    const config = loadSmtpConfig(this.env);
    const company = message.companyDisplayName || 'A company';
    const code = message.companyCode;

    const subject = `${company} administrator onboarding completed`;

    const text = [
      `${company} administrator onboarding completed.`,
      '',
      `The initial administrator for ${company}${code ? ` (${code})` : ''} has successfully created their account.`,
      '',
      'The company remains in PROVISIONING status and is now ready for activation.',
      '',
      'Sign in to Jupiter Platform Administration to review and activate the company.',
      '',
      'Jupiter',
    ].join('\n');

    const html = [
      `<p><strong>${escapeHtml(company)}</strong> administrator onboarding completed.</p>`,
      `<p>The initial administrator for <strong>${escapeHtml(company)}</strong>${code ? ` (<code>${escapeHtml(code)}</code>)` : ''} has successfully created their account.</p>`,
      '<p>The company remains in <strong>PROVISIONING</strong> status and is now ready for activation.</p>',
      '<p>Sign in to Jupiter Platform Administration to review and activate the company.</p>',
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
      console.error('[SYSTEM_OWNER_NOTIFICATION_DELIVERY_FAILED] ' + JSON.stringify(sanitizeSmtpDiagnostic(error)));
      throw new Error('SYSTEM_OWNER_NOTIFICATION_DELIVERY_FAILED');
    }
  }
}
