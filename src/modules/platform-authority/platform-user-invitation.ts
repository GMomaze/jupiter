import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { hashPassword } from '../auth/password.util.js';
import { type PlatformAuthority, PLATFORM_AUTHORITY_MANAGE } from './platform-authority.js';
import { assertRepositoryIssuedPlatformAuthority } from './platform-authority.repository.js';

export const PLATFORM_USER_INVITATION_UNAVAILABLE = 'PLATFORM_USER_INVITATION_UNAVAILABLE';

export type PlatformUserInvitationDeliveryMessage = Readonly<{
  email: string;
  token: string;
  expiresAt: Date;
}>;

export interface PlatformUserInvitationDelivery {
  deliver(message: PlatformUserInvitationDeliveryMessage): Promise<void>;
}

export class NullPlatformUserInvitationDelivery implements PlatformUserInvitationDelivery {
  async deliver(): Promise<void> {}
}

export type PlatformUserInvitationDescription = Readonly<{
  invitationId: string;
  email: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
}>;

export type PendingPlatformUserInvitation = Readonly<{
  invitationId: string;
  email: string;
  fullName: string;
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
}>;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function unavailable(): Error {
  return new Error(PLATFORM_USER_INVITATION_UNAVAILABLE);
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface InviteRowInput {
  userId: string;
  email: string;
  fullName: string;
  tokenHash: string;
  expiresAt: Date;
  invitedByUserId: string;
  reason: string;
  correlationId: string;
}

export class PlatformUserInvitationRepository {
  constructor(private readonly database: Pool) {}

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async revalidateManage(client: PoolClient, authority: PlatformAuthority): Promise<void> {
    assertRepositoryIssuedPlatformAuthority(authority);
    const result = await client.query(
      `SELECT 1 FROM platform_principals pp
        JOIN platform_capability_grants pg ON pg.principal_id=pp.id AND pg.revoked_at IS NULL
        JOIN platform_capabilities pc ON pc.id=pg.capability_id AND pc.is_active=true
       WHERE pp.id=$1 AND pp.principal_type='HUMAN' AND pp.status='ACTIVE' AND pc.code=$2`,
      [authority.principalId, PLATFORM_AUTHORITY_MANAGE],
    );
    if (!result.rowCount) throw new Error('PLATFORM_CAPABILITY_REQUIRED');
  }

  private async audit(
    client: PoolClient,
    authority: PlatformAuthority,
    action: string,
    resourceId: string,
    reason: string,
    correlationId: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    await client.query(
      `INSERT INTO platform_global_audit_log(
         id, principal_id, principal_type, principal_code, capability_code,
         action, resource_type, resource_id, correlation_id, source_provenance,
         old_values, new_values, outcome, reason, created_at)
       VALUES($1,$2,$3,$4,$5,$6,'platform_user_invitation',$7,$8,$9,$10::jsonb,$11::jsonb,'SUCCESS',$12,CURRENT_TIMESTAMP)`,
      [
        randomUUID(),
        authority.principalId,
        authority.principalType,
        authority.principalCode,
        PLATFORM_AUTHORITY_MANAGE,
        action,
        resourceId,
        correlationId,
        JSON.stringify({ source: 'PLATFORM_USER_INVITATION_SERVICE' }),
        JSON.stringify(before),
        JSON.stringify(after),
        reason,
      ],
    );
  }

  async invite(authority: PlatformAuthority, input: InviteRowInput): Promise<{ invitationId: string }> {
    return this.transaction(async (client) => {
      await this.revalidateManage(client, authority);
      const invitationId = randomUUID();
      await client.query(
        `INSERT INTO users(id, email, password_hash, full_name, is_active, created_at, updated_at)
         VALUES($1, $2, $3, $4, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [input.userId, input.email, await hashPassword(randomUUID()), input.fullName],
      );
      await client.query(
        `INSERT INTO platform_user_invitations(
           id, user_id, normalized_email, token_hash, expires_at, invited_by_user_id, created_at)
         VALUES($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [invitationId, input.userId, input.email, input.tokenHash, input.expiresAt, input.invitedByUserId],
      );
      await this.audit(
        client, authority, 'PLATFORM_USER_INVITED', invitationId, input.reason, input.correlationId,
        null, { email: input.email, userId: input.userId },
      );
      return { invitationId };
    });
  }

  async resend(
    authority: PlatformAuthority,
    invitationId: string,
    tokenHash: string,
    expiresAt: Date,
    reason: string,
    correlationId: string,
  ): Promise<{ email: string } | null> {
    return this.transaction(async (client) => {
      await this.revalidateManage(client, authority);
      const existing = await client.query(
        `SELECT id, normalized_email FROM platform_user_invitations
          WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL FOR UPDATE`,
        [invitationId],
      );
      if (!existing.rowCount) return null;
      await client.query(
        `UPDATE platform_user_invitations SET token_hash=$2, expires_at=$3
          WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL`,
        [invitationId, tokenHash, expiresAt],
      );
      await this.audit(
        client, authority, 'PLATFORM_USER_INVITATION_RESENT', invitationId, reason, correlationId,
        { invitationId }, { email: existing.rows[0].normalized_email },
      );
      return { email: existing.rows[0].normalized_email };
    });
  }

  async revoke(
    authority: PlatformAuthority,
    invitationId: string,
    reason: string,
    correlationId: string,
  ): Promise<boolean> {
    return this.transaction(async (client) => {
      await this.revalidateManage(client, authority);
      const existing = await client.query(
        `SELECT id, user_id FROM platform_user_invitations
          WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL FOR UPDATE`,
        [invitationId],
      );
      if (!existing.rowCount) return false;
      await client.query(
        `UPDATE platform_user_invitations SET revoked_at=CURRENT_TIMESTAMP, revoked_by_user_id=$2
          WHERE id=$1`,
        [invitationId, authority.principalCode],
      );
      await client.query(
        `UPDATE users SET retired_at=CURRENT_TIMESTAMP WHERE id=$1 AND is_active=false AND retired_at IS NULL`,
        [existing.rows[0].user_id],
      );
      await this.audit(
        client, authority, 'PLATFORM_USER_INVITATION_REVOKED', invitationId, reason, correlationId,
        { invitationId }, { userId: existing.rows[0].user_id },
      );
      return true;
    });
  }

  async describeInvitation(tokenHash: string): Promise<PlatformUserInvitationDescription | null> {
    const result = await this.database.query(
      `SELECT id, normalized_email, expires_at, consumed_at, revoked_at
         FROM platform_user_invitations WHERE token_hash=$1`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      invitationId: row.id,
      email: row.normalized_email,
      expiresAt: row.expires_at,
      consumedAt: row.consumed_at,
      revokedAt: row.revoked_at,
    };
  }

  async accept(tokenHash: string, passwordHash: string, correlationId: string): Promise<boolean> {
    return this.transaction(async (client) => {
      const invitation = await client.query(
        `SELECT id, user_id, normalized_email FROM platform_user_invitations
          WHERE token_hash=$1 AND consumed_at IS NULL AND revoked_at IS NULL
            AND expires_at > CURRENT_TIMESTAMP FOR UPDATE`,
        [tokenHash],
      );
      if (!invitation.rowCount) return false;
      const row = invitation.rows[0];
      await client.query(
        `UPDATE users SET password_hash=$2, is_active=true, updated_at=CURRENT_TIMESTAMP
          WHERE id=$1 AND is_active=false AND retired_at IS NULL`,
        [row.user_id, passwordHash],
      );
      await client.query(
        `UPDATE platform_user_invitations SET consumed_at=CURRENT_TIMESTAMP
          WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL`,
        [row.id],
      );
      await client.query(
        `INSERT INTO platform_global_audit_log(
           id, principal_id, principal_type, principal_code, capability_code,
           action, resource_type, resource_id, correlation_id, source_provenance,
           old_values, new_values, outcome, reason, created_at)
         VALUES($1,$2,'INVITEE',$3,$4,'PLATFORM_USER_ACTIVATED','platform_user_invitation',$5,$6,$7,$8::jsonb,$9::jsonb,'SUCCESS',$10,CURRENT_TIMESTAMP)`,
        [
          randomUUID(), row.user_id, row.normalized_email, PLATFORM_AUTHORITY_MANAGE,
          row.id, correlationId, JSON.stringify({ source: 'PLATFORM_USER_INVITATION_ACCEPTANCE' }),
          JSON.stringify({ email: row.normalized_email }),
          JSON.stringify({ userId: row.user_id, activated: true }),
          'Accepted platform user invitation',
        ],
      );
      return true;
    });
  }

  async listPending(): Promise<PendingPlatformUserInvitation[]> {
    const result = await this.database.query(
      `SELECT pi.id, pi.normalized_email, pi.expires_at, pi.created_at, pi.consumed_at, pi.revoked_at,
              u.full_name, inv.full_name AS invited_by
         FROM platform_user_invitations pi
         JOIN users u ON u.id = pi.user_id
         JOIN users inv ON inv.id = pi.invited_by_user_id
        WHERE pi.consumed_at IS NULL AND pi.revoked_at IS NULL
        ORDER BY pi.created_at ASC`,
    );
    return result.rows.map((row) => ({
      invitationId: row.id,
      email: row.normalized_email,
      fullName: row.full_name,
      invitedBy: row.invited_by,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      consumedAt: row.consumed_at,
      revokedAt: row.revoked_at,
    }));
  }
}


export class PlatformUserInvitationService {
  constructor(
    private readonly repository: PlatformUserInvitationRepository,
    private readonly delivery: PlatformUserInvitationDelivery,
    private readonly clock: () => number = Date.now,
  ) {}

  async invite(
    authority: PlatformAuthority,
    input: { email: unknown; fullName: unknown; reason: unknown; correlationId?: unknown },
  ): Promise<{ invitationId: string }> {
    if (
      typeof input.email !== 'string' || !EMAIL_PATTERN.test(input.email.trim()) ||
      typeof input.fullName !== 'string' || !input.fullName.trim() ||
      typeof input.reason !== 'string' || !input.reason.trim()
    ) {
      throw unavailable();
    }
    const email = normalizedEmail(input.email);
    const fullName = input.fullName.trim();
    const reason = input.reason.trim();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.clock() + 24 * 60 * 60 * 1000);
    const correlationId = typeof input.correlationId === 'string' ? input.correlationId : randomUUID();
    const userId = randomUUID();
    const result = await this.repository.invite(authority, {
      userId,
      email,
      fullName,
      tokenHash: hashToken(token),
      expiresAt,
      invitedByUserId: authority.principalCode,
      reason,
      correlationId,
    });
    await this.delivery.deliver({ email, token, expiresAt });
    return result;
  }

  async resend(
    authority: PlatformAuthority,
    input: { invitationId: unknown; reason: unknown; correlationId?: unknown },
  ): Promise<{ resent: boolean }> {
    if (typeof input.invitationId !== 'string' || !input.invitationId.trim()) throw unavailable();
    if (typeof input.reason !== 'string' || !input.reason.trim()) throw unavailable();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.clock() + 24 * 60 * 60 * 1000);
    const correlationId = typeof input.correlationId === 'string' ? input.correlationId : randomUUID();
    const result = await this.repository.resend(
      authority, input.invitationId, hashToken(token), expiresAt, input.reason.trim(), correlationId,
    );
    if (!result) return { resent: false };
    await this.delivery.deliver({ email: result.email, token, expiresAt });
    return { resent: true };
  }

  async revoke(
    authority: PlatformAuthority,
    input: { invitationId: unknown; reason: unknown; correlationId?: unknown },
  ): Promise<{ revoked: boolean }> {
    if (typeof input.invitationId !== 'string' || !input.invitationId.trim()) throw unavailable();
    if (typeof input.reason !== 'string' || !input.reason.trim()) throw unavailable();
    const correlationId = typeof input.correlationId === 'string' ? input.correlationId : randomUUID();
    const revoked = await this.repository.revoke(authority, input.invitationId, input.reason.trim(), correlationId);
    return { revoked };
  }

  async describe(input: { token: unknown }): Promise<{ valid: boolean; email?: string }> {
    try {
      if (typeof input.token !== 'string' || input.token.length < 32) return { valid: false };
      const row = await this.repository.describeInvitation(hashToken(input.token));
      if (!row || row.consumedAt || row.revokedAt || new Date(row.expiresAt).getTime() <= Date.now()) {
        return { valid: false };
      }
      return { valid: true, email: row.email };
    } catch {
      return { valid: false };
    }
  }

  async accept(input: { token: unknown; password: unknown; correlationId?: unknown }): Promise<{ accepted: boolean }> {
    if (typeof input.token !== 'string' || input.token.length < 32) throw unavailable();
    if (typeof input.password !== 'string' || input.password.length < 12) throw unavailable();
    const correlationId = typeof input.correlationId === 'string' ? input.correlationId : randomUUID();
    const accepted = await this.repository.accept(hashToken(input.token), await hashPassword(input.password), correlationId);
    if (!accepted) throw unavailable();
    return { accepted: true };
  }

  async listPending(): Promise<PendingPlatformUserInvitation[]> {
    return this.repository.listPending();
  }
}


