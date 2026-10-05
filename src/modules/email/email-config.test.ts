import { describe, expect, it } from 'vitest';
import {
  buildInvitationAcceptUrl,
  loadSmtpConfig,
  loadSystemOwnerNotificationEmail,
  normalizeAppBaseUrl,
} from './email-config.js';

describe('email-config', () => {
  it('normalizes and validates the app base URL', () => {
    expect(normalizeAppBaseUrl('http://localhost:32000/')).toBe('http://localhost:32000');
    expect(normalizeAppBaseUrl('https://jupiter.example.com')).toBe('https://jupiter.example.com');
    expect(() => normalizeAppBaseUrl('')).toThrow('APP_BASE_URL_INVALID');
    expect(() => normalizeAppBaseUrl('not-a-url')).toThrow('APP_BASE_URL_INVALID');
    expect(() => normalizeAppBaseUrl(undefined)).toThrow('APP_BASE_URL_INVALID');
  });

  it('loads SMTP config fail-closed', () => {
    const base = {
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: '',
      SMTP_PASSWORD: '',
      SMTP_FROM: 'no-reply@example.com',
      SMTP_FROM_NAME: 'Jupiter',
      APP_BASE_URL: 'http://localhost:32000',
    };
    expect(loadSmtpConfig(base)).toMatchObject({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      from: 'no-reply@example.com',
    });
    expect(() => loadSmtpConfig({ ...base, SMTP_HOST: '' })).toThrow('SMTP_HOST_REQUIRED');
    expect(() => loadSmtpConfig({ ...base, SMTP_PORT: 'bad' })).toThrow('SMTP_PORT_INVALID');
    expect(() => loadSmtpConfig({ ...base, SMTP_FROM: '' })).toThrow('SMTP_FROM_REQUIRED');
    expect(() => loadSmtpConfig({ ...base, APP_BASE_URL: '' })).toThrow('APP_BASE_URL_INVALID');
  });

  it('builds the acceptance URL with encoded token and tenant', () => {
    const url = buildInvitationAcceptUrl(
      'http://localhost:32000',
      'abc+def/ghi',
      '60200000-0000-4000-8000-000000000001',
    );
    expect(url).toContain('/auth/staff-invitations/accept?token=');
    expect(url).toContain('tenant=60200000-0000-4000-8000-000000000001');
    expect(url).not.toContain('abc+def/ghi');
  });

  it('resolves the System Owner notification email fail-safely', () => {
    expect(loadSystemOwnerNotificationEmail({})).toBeUndefined();
    expect(loadSystemOwnerNotificationEmail({ SYSTEM_OWNER_NOTIFICATION_EMAIL: '' })).toBeUndefined();
    expect(loadSystemOwnerNotificationEmail({ SYSTEM_OWNER_NOTIFICATION_EMAIL: '  ' })).toBeUndefined();
    expect(
      loadSystemOwnerNotificationEmail({ SYSTEM_OWNER_NOTIFICATION_EMAIL: 'JupiterAMMS@Outlook.com ' }),
    ).toBe('jupiteramms@outlook.com');
    expect(() =>
      loadSystemOwnerNotificationEmail({ SYSTEM_OWNER_NOTIFICATION_EMAIL: 'not-an-email' }),
    ).toThrow('SYSTEM_OWNER_NOTIFICATION_EMAIL_INVALID');
  });
});
