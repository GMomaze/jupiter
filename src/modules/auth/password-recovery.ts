import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { hashPassword } from './password.util.js';
import {
  PASSWORD_RESET_TTL_MS,
  generatePasswordResetToken,
  hashPasswordResetToken,
} from './password-recovery-token.js';
import { emitOperationalEvent } from '../observability/operational-event.js';
import { SYSTEM_OWNER_USER_ID } from '../../config/systemOwnerCanonical.js';

export const PASSWORD_RESET_INVALID = 'PASSWORD_RESET_INVALID';

export interface PasswordResetDeliveryMessage {
  readonly email: string;
  readonly token: string;
  readonly expiresAt: Date;
}

export interface PasswordResetDelivery {
  deliver(message: PasswordResetDeliveryMessage): Promise<void>;
}

/** Delivery that drops the message (test/dev default when SMTP is absent). */
export class NullPasswordResetDelivery implements PasswordResetDelivery {
  async deliver(): Promise<void> {}
}

export type CompleteResetOutcome = 'SUCCESS' | 'INVALID' | 'EXPIRED';

interface EligibleUser {
  id: string;
  email: string;
}

const AUDIT_TABLE = 'staff_password_recovery_audit';
const AUDIT_REQUESTED = 'STAFF_PASSWORD_RESET_REQUESTED';
const AUDIT_COMPLETED = 'STAFF_PASSWORD_RESET_COMPLETED';
const AUDIT_REFUSED = 'STAFF_PASSWORD_RESET_REFUSED';

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

export class PasswordRecoveryRepository {
  constructor(private readonly database: Pool) {}

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Finds an eligible staff user by email: active, not retired, not a privileged platform identity. */
  async findEligibleUser(email: string): Promise<EligibleUser | undefined> {
    const result = await this.database.query(
      `SELECT u.id, u.email
         FROM users u
        WHERE lower(u.email) = $1
          AND u.is_active = true
          AND u.retired_at IS NULL
          AND u.id <> $2
          AND NOT EXISTS (
            SELECT 1 FROM platform_principals pp
            WHERE pp.principal_type = 'HUMAN' AND pp.status = 'ACTIVE' AND pp.user_id = u.id
          )
        LIMIT 1`,
      [normalizedEmail(email), SYSTEM_OWNER_USER_ID],
    );
    const row = result.rows[0] as { id: string; email: string } | undefined;
    return row ? { id: row.id, email: row.email } : undefined;
  }

  /** Issues (superseding) a reset token for an eligible user and records a privacy-safe request audit. */
  async issueToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    correlationId: string,
  ): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(
        `UPDATE users SET password_reset_token_hash=$1, password_reset_expires_at=$2 WHERE id=$3`,
        [tokenHash, expiresAt, userId],
      );
      await client.query(
        `INSERT INTO ${AUDIT_TABLE}(id,action,outcome,correlation_id) VALUES($1,$2,'SUCCESS',$3)`,
        [randomUUID(), AUDIT_REQUESTED, correlationId],
      );
    });
  }

  /** Records a request audit for a non-matching email (identical shape to issueToken, no user id). */
  async recordRequestWithoutUser(correlationId: string): Promise<void> {
    await this.database.query(
      `INSERT INTO ${AUDIT_TABLE}(id,action,outcome,correlation_id) VALUES($1,$2,'SUCCESS',$3)`,
      [randomUUID(), AUDIT_REQUESTED, correlationId],
    );
  }

  /**
   * Consumes a reset token, changes the password, invalidates sessions and
   * records audit atomically. Returns an outcome for the caller.
   */
  async completeReset(
    tokenHash: string,
    passwordHash: string,
    correlationId: string,
  ): Promise<CompleteResetOutcome> {
    return this.transaction(async (client) => {
      // Re-validates eligibility inside the same transaction and under the same
      // user-row lock as token consumption: the canonical System Owner and any
      // active HUMAN platform principal are excluded regardless of when their
      // status changed since issuance, and inactive/retired accounts are
      // rejected. A concurrent completion is serialized by the row lock.
      const locked = await client.query(
        `SELECT u.id, u.password_reset_expires_at
           FROM users u
          WHERE u.password_reset_token_hash=$1
            AND u.is_active=true
            AND u.retired_at IS NULL
            AND u.id <> $2
            AND NOT EXISTS (
              SELECT 1 FROM platform_principals pp
              WHERE pp.principal_type='HUMAN' AND pp.status='ACTIVE' AND pp.user_id = u.id
            )
          FOR UPDATE`,
        [tokenHash, SYSTEM_OWNER_USER_ID],
      );
      const row = locked.rows[0] as { id: string; password_reset_expires_at: string | null } | undefined;

      if (!row) {
        await client.query(
          `INSERT INTO ${AUDIT_TABLE}(id,action,outcome,reason,correlation_id) VALUES($1,$2,'DENIED',$3,$4)`,
          [randomUUID(), AUDIT_REFUSED, 'INVALID_OR_REUSED_TOKEN', correlationId],
        );
        return 'INVALID' as const;
      }

      const expiresAt = row.password_reset_expires_at;
      const expired =
        !expiresAt ||
        Number.isNaN(new Date(expiresAt).getTime()) ||
        new Date(expiresAt).getTime() <= Date.now();
      if (expired) {
        await client.query(
          `UPDATE users SET password_reset_token_hash=NULL, password_reset_expires_at=NULL WHERE id=$1`,
          [row.id],
        );
        await client.query(
          `INSERT INTO ${AUDIT_TABLE}(id,action,outcome,reason,correlation_id) VALUES($1,$2,'DENIED',$3,$4)`,
          [randomUUID(), AUDIT_REFUSED, 'EXPIRED_TOKEN', correlationId],
        );
        return 'EXPIRED' as const;
      }

      await client.query(
        `UPDATE users SET password_hash=$1, password_reset_token_hash=NULL, password_reset_expires_at=NULL WHERE id=$2`,
        [passwordHash, row.id],
      );
      await client.query(
        `DELETE FROM sessions WHERE sess->'passport'->>'user'=$1`,
        [row.id],
      );
      await client.query(
        `INSERT INTO ${AUDIT_TABLE}(id,user_id,action,outcome,correlation_id) VALUES($1,$2,$3,'SUCCESS',$4)`,
        [randomUUID(), row.id, AUDIT_COMPLETED, correlationId],
      );
      return 'SUCCESS' as const;
    });
  }
}

export class PasswordRecoveryService {
  constructor(
    private readonly repository: PasswordRecoveryRepository,
    private readonly delivery: PasswordResetDelivery,
    private readonly clock: () => number = Date.now,
  ) {}

  /**
   * Requests a reset for an email address. Always resolves (generic response);
   * never reveals whether the address matched an eligible account. Email
   * delivery failure is logged but still resolves so enumeration is prevented.
   */
  async requestReset(email: unknown): Promise<void> {
    const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const correlationId = randomUUID();

    if (!normalized) {
      await this.repository.recordRequestWithoutUser(correlationId).catch(() => undefined);
      return;
    }

    let user: EligibleUser | undefined;
    try {
      user = await this.repository.findEligibleUser(normalized);
    } catch (error) {
      emitOperationalEvent({
        code: 'STAFF_PASSWORD_RESET_REQUEST_FAILED',
        severity: 'ERROR',
        outcome: 'FAILED',
        operation: 'STAFF_PASSWORD_RESET',
        correlationId,
        error,
      });
      return;
    }

    if (!user) {
      await this.repository.recordRequestWithoutUser(correlationId).catch(() => undefined);
      emitOperationalEvent({
        code: 'STAFF_PASSWORD_RESET_REQUESTED',
        severity: 'INFO',
        outcome: 'SUCCESS',
        operation: 'STAFF_PASSWORD_RESET',
        correlationId,
      });
      return;
    }

    const token = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);
    const expiresAt = new Date(this.clock() + PASSWORD_RESET_TTL_MS);

    try {
      await this.repository.issueToken(user.id, tokenHash, expiresAt, correlationId);
    } catch (error) {
      emitOperationalEvent({
        code: 'STAFF_PASSWORD_RESET_REQUEST_FAILED',
        severity: 'ERROR',
        outcome: 'FAILED',
        operation: 'STAFF_PASSWORD_RESET',
        correlationId,
        error,
      });
      return;
    }

    try {
      await this.delivery.deliver({ email: user.email, token, expiresAt });
    } catch (error) {
      emitOperationalEvent({
        code: 'STAFF_PASSWORD_RESET_EMAIL_FAILED',
        severity: 'ERROR',
        outcome: 'FAILED',
        operation: 'STAFF_PASSWORD_RESET',
        correlationId,
        error,
      });
      // Token remains stored but is unusable (recipient never received it) and
      // expires within the TTL, so no explicit revocation is required.
    }

    emitOperationalEvent({
      code: 'STAFF_PASSWORD_RESET_REQUESTED',
      severity: 'INFO',
      outcome: 'SUCCESS',
      operation: 'STAFF_PASSWORD_RESET',
      correlationId,
    });
  }

  /** Completes a reset. Returns a generic failure for any invalid/expired/reused token. */
  async completeReset(
    token: unknown,
    password: unknown,
    confirmPassword: unknown,
  ): Promise<'SUCCESS' | 'FAILED'> {
    const normalizedToken = typeof token === 'string' ? token.trim() : '';
    const correlationId = randomUUID();

    const refuse = (reason: string) => {
      emitOperationalEvent({
        code: 'STAFF_PASSWORD_RESET_REFUSED',
        severity: 'WARN',
        outcome: 'DENIED',
        operation: 'STAFF_PASSWORD_RESET',
        correlationId,
        error: new Error(reason),
      });
      return 'FAILED' as const;
    };

    if (!normalizedToken) return refuse('MISSING_TOKEN');
    if (typeof password !== 'string' || typeof confirmPassword !== 'string') {
      return refuse('MISSING_PASSWORD');
    }
    if (password !== confirmPassword) return refuse('PASSWORD_MISMATCH');
    if (password.length < 12) return refuse('PASSWORD_TOO_SHORT');

    const tokenHash = hashPasswordResetToken(normalizedToken);
    let passwordHash: string;
    try {
      passwordHash = await hashPassword(password);
    } catch (error) {
      emitOperationalEvent({
        code: 'STAFF_PASSWORD_RESET_FAILED',
        severity: 'ERROR',
        outcome: 'FAILED',
        operation: 'STAFF_PASSWORD_RESET',
        correlationId,
        error,
      });
      return 'FAILED' as const;
    }

    let outcome: CompleteResetOutcome;
    try {
      outcome = await this.repository.completeReset(tokenHash, passwordHash, correlationId);
    } catch (error) {
      emitOperationalEvent({
        code: 'STAFF_PASSWORD_RESET_FAILED',
        severity: 'ERROR',
        outcome: 'FAILED',
        operation: 'STAFF_PASSWORD_RESET',
        correlationId,
        error,
      });
      return 'FAILED' as const;
    }

    if (outcome !== 'SUCCESS') {
      return refuse(outcome === 'EXPIRED' ? 'EXPIRED_TOKEN' : 'INVALID_TOKEN');
    }

    emitOperationalEvent({
      code: 'STAFF_PASSWORD_RESET_COMPLETED',
      severity: 'INFO',
      outcome: 'SUCCESS',
      operation: 'STAFF_PASSWORD_RESET',
      correlationId,
    });
    return 'SUCCESS' as const;
  }
}
