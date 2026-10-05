import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const sendMail = vi.fn(async () => ({ messageId: 'x' }));
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail })),
  },
}));

import { SmtpStaffInvitationDelivery, sanitizeSmtpDiagnostic } from './smtp-staff-invitation-delivery.js';

const env = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  SMTP_FROM: 'no-reply@example.com',
  SMTP_FROM_NAME: 'Jupiter',
  APP_BASE_URL: 'http://localhost:32000',
};

const message = {
  email: 'admin@example.com',
  token: 'tok_plaintext',
  expiresAt: new Date(Date.now() + 3600000),
  tenantId: '60200000-0000-4000-8000-000000000001',
  tenantName: 'Acme Airways',
  initialAdmin: true,
};

describe('SmtpStaffInvitationDelivery', () => {
  beforeEach(() => sendMail.mockClear());

  it('fails closed when SMTP configuration is missing', async () => {
    const delivery = new SmtpStaffInvitationDelivery({ ...env, SMTP_HOST: '' });
    await expect(delivery.deliver(message)).rejects.toThrow('SMTP_HOST_REQUIRED');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends a human-facing invitation email with the acceptance link', async () => {
    const delivery = new SmtpStaffInvitationDelivery(env);
    await delivery.deliver(message);
    expect(sendMail).toHaveBeenCalledOnce();
    const mail = sendMail.mock.calls[0]![0] as { to: string; subject: string; text: string; html: string };
    expect(mail.to).toBe('admin@example.com');
    expect(mail.subject).toContain('Acme Airways');
    expect(mail.text).toContain('/auth/staff-invitations/accept?token=');
    expect(mail.text).toContain('initial administrator account');
    expect(mail.text).toContain('disregard');
  });
});

describe('sanitizeSmtpDiagnostic', () => {
  it('extracts only allowlisted SMTP diagnostic fields', () => {
    const error = Object.assign(new Error('Invalid login'), {
      code: 'EAUTH',
      responseCode: 535,
      command: 'AUTH PLAIN',
      response: '535 5.7.3 Authentication unsuccessful',
      user: 'secret@example.com',
      pass: 'supersecret',
      token: 'tok_plaintext',
      message: 'Invalid login: 535 5.7.3 Authentication unsuccessful',
    });
    expect(sanitizeSmtpDiagnostic(error)).toEqual({
      name: 'Error',
      code: 'EAUTH',
      responseCode: 535,
      command: 'AUTH PLAIN',
      response: '535 5.7.3 Authentication unsuccessful',
    });
  });

  it('does not emit credentials, tokens or non-allowlisted fields', () => {
    const error = Object.assign(new Error('boom'), {
      code: 'ECONNECTION',
      user: 'secret@example.com',
      pass: 'supersecret',
      token: 'tok_plaintext',
      message: 'boom',
    });
    const diagnostic = JSON.stringify(sanitizeSmtpDiagnostic(error));
    expect(diagnostic).not.toContain('secret@example.com');
    expect(diagnostic).not.toContain('supersecret');
    expect(diagnostic).not.toContain('tok_plaintext');
    expect(diagnostic).not.toContain('"message"');
  });

  it('redacts a base64 AUTH payload from the command', () => {
    const error = Object.assign(new Error('auth'), {
      command: 'AUTH PLAIN ' + 'aGVsbG86cGFzc3dvcmQ=',
    });
    expect(JSON.stringify(sanitizeSmtpDiagnostic(error))).not.toContain('aGVsbG86cGFzc3dvcmQ=');
  });
});

describe('SmtpStaffInvitationDelivery failure logging', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sendMail.mockClear();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('logs sanitized diagnostics and rethrows the original error', async () => {
    const smtpError = Object.assign(new Error('Invalid login'), {
      code: 'EAUTH',
      responseCode: 535,
      command: 'AUTH PLAIN',
      response: '535 5.7.3 Authentication unsuccessful',
    });
    sendMail.mockRejectedValueOnce(smtpError);
    const delivery = new SmtpStaffInvitationDelivery(env);
    await expect(delivery.deliver(message)).rejects.toThrow('Invalid login');

    const logged = errorSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(logged).toContain('[SMTP_DELIVERY_FAILED]');
    expect(logged).toContain('EAUTH');
    expect(logged).toContain('535');
    expect(logged).not.toContain('tok_plaintext');
    expect(logged).not.toContain('secret@example.com');
    expect(logged).not.toContain('supersecret');
  });
});
