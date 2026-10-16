import { describe, expect, it, vi } from 'vitest';
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  validatePasswordStrength,
  PASSWORD_RESET_MIN_LENGTH,
  PASSWORD_RESET_TTL_MS,
} from './password-recovery-token.js';
import {
  PasswordRecoveryRepository,
  PasswordRecoveryService,
  type PasswordResetDelivery,
} from './password-recovery.js';

function mockRepository(overrides: Partial<PasswordRecoveryRepository> = {}) {
  return {
    findEligibleUser: vi.fn(async () => undefined),
    issueToken: vi.fn(async () => undefined),
    recordRequestWithoutUser: vi.fn(async () => undefined),
    completeReset: vi.fn(async () => 'SUCCESS' as const),
    ...overrides,
  } as unknown as PasswordRecoveryRepository & {
    findEligibleUser: ReturnType<typeof vi.fn>;
    issueToken: ReturnType<typeof vi.fn>;
    recordRequestWithoutUser: ReturnType<typeof vi.fn>;
    completeReset: ReturnType<typeof vi.fn>;
  };
}

function mockDelivery(): PasswordResetDelivery & { deliver: ReturnType<typeof vi.fn> } {
  return { deliver: vi.fn(async () => undefined) };
}

describe('password recovery token primitives', () => {
  it('generates a 256-bit (64 hex char) token', () => {
    const token = generatePasswordResetToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(token).not.toBe(generatePasswordResetToken());
  });

  it('hashes tokens with sha256 (deterministic, not plaintext)', () => {
    const token = 'a'.repeat(64);
    const hash = hashPasswordResetToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashPasswordResetToken(token)).toBe(hash);
  });

  it('enforces a 12-character minimum with no composition rules', () => {
    expect(() => validatePasswordStrength('correct horse battery staple')).not.toThrow();
    expect(() => validatePasswordStrength('a'.repeat(11))).toThrow('PASSWORD_TOO_SHORT');
    expect(() => validatePasswordStrength('a'.repeat(12))).not.toThrow();
    expect(PASSWORD_RESET_MIN_LENGTH).toBe(12);
    expect(PASSWORD_RESET_TTL_MS).toBe(30 * 60 * 1000);
  });
});

describe('PasswordRecoveryService.requestReset', () => {
  it('records a generic request and sends no email for an unknown email', async () => {
    const repo = mockRepository();
    const delivery = mockDelivery();
    const service = new PasswordRecoveryService(repo, delivery);
    await service.requestReset('nobody@example.com');
    expect(repo.findEligibleUser).toHaveBeenCalledWith('nobody@example.com');
    expect(repo.recordRequestWithoutUser).toHaveBeenCalledOnce();
    expect(repo.issueToken).not.toHaveBeenCalled();
    expect(delivery.deliver).not.toHaveBeenCalled();
  });

  it('issues a token and delivers for an eligible user', async () => {
    const repo = mockRepository({ findEligibleUser: vi.fn(async () => ({ id: 'u1', email: 'user@example.com' })) });
    const delivery = mockDelivery();
    const service = new PasswordRecoveryService(repo, delivery, () => 0);
    await service.requestReset('User@Example.com');
    expect(repo.issueToken).toHaveBeenCalledOnce();
    expect(delivery.deliver).toHaveBeenCalledOnce();
    const delivered = delivery.deliver.mock.calls[0]![0] as { email: string; token: string; expiresAt: Date };
    expect(delivered.email).toBe('user@example.com');
    expect(delivered.token).toMatch(/^[0-9a-f]{64}$/);
    expect(delivered.expiresAt.getTime()).toBe(PASSWORD_RESET_TTL_MS);
  });

  it('still resolves when email delivery fails (no enumeration signal)', async () => {
    const repo = mockRepository({ findEligibleUser: vi.fn(async () => ({ id: 'u1', email: 'user@example.com' })) });
    const delivery = mockDelivery();
    delivery.deliver.mockRejectedValue(new Error('smtp down'));
    const service = new PasswordRecoveryService(repo, delivery, () => 0);
    await expect(service.requestReset('user@example.com')).resolves.toBeUndefined();
    expect(repo.issueToken).toHaveBeenCalledOnce();
  });

  it('still resolves when the repository throws (fail-closed, no enumeration)', async () => {
    const repo = mockRepository({ findEligibleUser: vi.fn(async () => { throw new Error('db down'); }) });
    const service = new PasswordRecoveryService(repo, mockDelivery());
    await expect(service.requestReset('user@example.com')).resolves.toBeUndefined();
  });
});

describe('PasswordRecoveryService.completeReset', () => {
  it('completes successfully and returns SUCCESS', async () => {
    const repo = mockRepository();
    const service = new PasswordRecoveryService(repo, mockDelivery());
    await expect(service.completeReset('a'.repeat(64), 'new-password-123', 'new-password-123')).resolves.toBe('SUCCESS');
    expect(repo.completeReset).toHaveBeenCalledOnce();
  });

  it('rejects a password below the minimum without contacting the repository', async () => {
    const repo = mockRepository();
    const service = new PasswordRecoveryService(repo, mockDelivery());
    await expect(service.completeReset('a'.repeat(64), 'short', 'short')).resolves.toBe('FAILED');
    expect(repo.completeReset).not.toHaveBeenCalled();
  });

  it('rejects mismatched confirmation', async () => {
    const repo = mockRepository();
    const service = new PasswordRecoveryService(repo, mockDelivery());
    await expect(service.completeReset('a'.repeat(64), 'new-password-123', 'different-123')).resolves.toBe('FAILED');
    expect(repo.completeReset).not.toHaveBeenCalled();
  });

  it('returns FAILED for an invalid or reused token', async () => {
    const repo = mockRepository({ completeReset: vi.fn(async () => 'INVALID' as const) });
    const service = new PasswordRecoveryService(repo, mockDelivery());
    await expect(service.completeReset('a'.repeat(64), 'new-password-123', 'new-password-123')).resolves.toBe('FAILED');
  });

  it('returns FAILED for an expired token', async () => {
    const repo = mockRepository({ completeReset: vi.fn(async () => 'EXPIRED' as const) });
    const service = new PasswordRecoveryService(repo, mockDelivery());
    await expect(service.completeReset('a'.repeat(64), 'new-password-123', 'new-password-123')).resolves.toBe('FAILED');
  });
});

describe('PasswordRecoveryRepository scope (cross-tenant/privilege safety)', () => {
  async function sourceText(): Promise<string> {
    const fs = await import('node:fs');
    return fs.readFileSync(new URL('./password-recovery.ts', import.meta.url), 'utf8');
  }

  it('completeReset only mutates users, sessions and the recovery audit table', async () => {
    const source = await sourceText();
    expect(source).toMatch(/DELETE FROM sessions/);
    expect(source).toMatch(/staff_password_recovery_audit/);
    expect(source).not.toMatch(/tenant_memberships/);
    expect(source).not.toMatch(/tenant_membership_roles/);
    expect(source).not.toMatch(/UPDATE tenants/);
  });

  it('excludes privileged platform identities and the canonical System Owner', async () => {
    const source = await sourceText();
    expect(source).toMatch(/platform_principals/);
    expect(source).toMatch(/pp\.principal_type = 'HUMAN'/);
    expect(source).toMatch(/pp\.status = 'ACTIVE'/);
    // Canonical System Owner is excluded by fixed UUID regardless of grant status.
    expect(source).toMatch(/u\.id <> \$2/);
    expect(source).toContain('SYSTEM_OWNER_USER_ID');
  });
});
