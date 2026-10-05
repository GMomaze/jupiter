import { describe, expect, it, vi } from 'vitest';
import { StaffInvitationService } from './staff-membership-administration.js';

const id = (n: string) => `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;

function serviceWithNotification(tenantStatus: string, recipientEmail: string | undefined, deliveryError?: Error) {
  const repository = {
    accept: vi.fn().mockResolvedValue({
      tenantId: id('1'),
      tenantName: 'Whip-Air Aviation',
      tenantCode: 'WAA',
      tenantStatus,
    }),
  };
  const delivery = { deliver: vi.fn().mockResolvedValue(undefined) };
  const notificationDelivery = { deliver: vi.fn().mockImplementation(() => (deliveryError ? Promise.reject(deliveryError) : Promise.resolve())) };
  const recipient = { resolve: vi.fn().mockResolvedValue(recipientEmail) };
  const service = new StaffInvitationService(
    repository as any,
    delivery as any,
    () => 1_000,
    { delivery: notificationDelivery as any, recipient: recipient as any },
  );
  return { repository, notificationDelivery, recipient, service };
}

describe('initial administrator onboarding completion notification', () => {
  it('returns company identity and notifies the System Owner when a PROVISIONING tenant admin accepts', async () => {
    const { service, notificationDelivery, recipient } = serviceWithNotification('PROVISIONING', 'systemowner@jupiter.local');
    const result = await service.accept({ token: 't'.repeat(64), tenantId: id('1'), password: 'onboarding-password-123' });
    expect(result.accepted).toBe(true);
    expect(result.tenantName).toBe('Whip-Air Aviation');
    expect(result.tenantCode).toBe('WAA');
    expect(result.tenantStatus).toBe('PROVISIONING');
    expect(recipient.resolve).toHaveBeenCalledOnce();
    expect(notificationDelivery.deliver).toHaveBeenCalledOnce();
    const message = notificationDelivery.deliver.mock.calls[0][0];
    expect(message).toEqual({
      email: 'systemowner@jupiter.local',
      companyDisplayName: 'Whip-Air Aviation',
      companyCode: 'WAA',
      tenantId: id('1'),
    });
    // The notification must never carry a token or password.
    expect(JSON.stringify(message)).not.toMatch(/token|password|hash/i);
  });

  it('does not notify when acceptance completes for a non-PROVISIONING tenant', async () => {
    const { service, notificationDelivery, recipient } = serviceWithNotification('ACTIVE', 'systemowner@jupiter.local');
    await service.accept({ token: 't'.repeat(64), tenantId: id('1'), password: 'onboarding-password-123' });
    expect(recipient.resolve).not.toHaveBeenCalled();
    expect(notificationDelivery.deliver).not.toHaveBeenCalled();
  });

  it('still succeeds when no System Owner recipient can be resolved', async () => {
    const { service, notificationDelivery } = serviceWithNotification('PROVISIONING', undefined);
    const result = await service.accept({ token: 't'.repeat(64), tenantId: id('1'), password: 'onboarding-password-123' });
    expect(result.accepted).toBe(true);
    expect(notificationDelivery.deliver).not.toHaveBeenCalled();
  });

  it('does not roll back successful onboarding when notification delivery fails', async () => {
    const { service, notificationDelivery } = serviceWithNotification('PROVISIONING', 'systemowner@jupiter.local', new Error('SMTP_UNAVAILABLE'));
    const result = await service.accept({ token: 't'.repeat(64), tenantId: id('1'), password: 'onboarding-password-123' });
    expect(result.accepted).toBe(true);
    expect(result.tenantStatus).toBe('PROVISIONING');
    expect(notificationDelivery.deliver).toHaveBeenCalledOnce();
  });
});
