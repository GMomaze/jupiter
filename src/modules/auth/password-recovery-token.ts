import { createHash, randomBytes } from 'node:crypto';

/**
 * Self-service staff password recovery token + password-strength primitives.
 *
 * - Tokens are 32 cryptographically random bytes (256-bit), hex-encoded; only
 *   the SHA-256 hash is ever persisted or compared (never the plaintext).
 * - The password policy is intentionally simple: at least 12 characters, with
 *   no arbitrary composition rules, so passphrases are supported.
 */

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
export const PASSWORD_RESET_MIN_LENGTH = 12;

export function generatePasswordResetToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function validatePasswordStrength(password: string): void {
  if (typeof password !== 'string' || password.length < PASSWORD_RESET_MIN_LENGTH) {
    throw new Error('PASSWORD_TOO_SHORT');
  }
}
