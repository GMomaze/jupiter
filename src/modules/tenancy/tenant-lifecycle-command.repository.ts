import { randomUUID } from 'node:crypto';
import type { Transaction } from 'sequelize';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import {
  executeAuthoritativePlatformMutation,
  requirePlatformMutationOperations,
  assertAuthoritativeTargetTenant,
  type PlatformMutationEvidence,
} from '../platform-authority/authoritative-platform-mutation.js';
import { acquireTenantLifecycleLock } from './tenant-lifecycle-coordination.js';
import { normalizeTenantCode } from './tenant-code-normalization.js';

export type ProvisionTenantCommand = Readonly<{
  code: string;
  displayName: string;
  legalName?: string | null;
  initialUserId: string;
}>;

export type ProvisionWithInitialAdminCommand = Readonly<{
  code: string;
  displayName: string;
  legalName?: string | null;
  initialAdminEmail: string;
  initialAdminName: string;
  invitationId: string;
  tokenHash: string;
  expiresAt: Date;
}>;

export type ReissueInitialAdminInvitationCommand = Readonly<{
  invitationId: string;
  tokenHash: string;
  expiresAt: Date;
}>;

export type ReissueInitialAdminInvitationResult = Readonly<{
  tenantId: string;
  publicId: string;
  tenantName: string;
  email: string;
  identityCreated: boolean;
  invitationId: string;
}>;

export type CorrectInitialAdminInvitationCommand = Readonly<{
  email: string;
  fullName: string;
  invitationId: string;
  tokenHash: string;
  expiresAt: Date;
}>;

export type CorrectInitialAdminInvitationResult = Readonly<{
  tenantId: string;
  publicId: string;
  tenantName: string;
  email: string;
  identityCreated: boolean;
  invitationId: string;
}>;

export type TenantLifecycleIdentity = Readonly<{
  tenantId: string;
  publicId: string;
  code: string;
  displayName: string;
  status: 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED';
}>;

type TenantRow = {
  id: string;
  public_id: string;
  code: string;
  display_name: string;
  legal_name: string | null;
  status: TenantLifecycleIdentity['status'];
  suspension_reason: string | null;
  suspended_at: Date | null;
  suspended_by_user_id: string | null;
};

const unavailable = () => new Error('TENANT_LIFECYCLE_COMMAND_UNAVAILABLE');
const CODE_LOCK_NAMESPACE = '7216467339908816943';

function identity(row: TenantRow): TenantLifecycleIdentity {
  return Object.freeze({
    tenantId: row.id,
    publicId: row.public_id,
    code: row.code,
    displayName: row.display_name,
    status: row.status,
  });
}

function auditState(row: TenantRow) {
  return {
    id: row.id,
    publicId: row.public_id,
    code: row.code,
    displayName: row.display_name,
    legalName: row.legal_name,
    status: row.status,
    suspensionReason: row.suspension_reason,
    suspendedAt: row.suspended_at,
    suspendedByUserId: row.suspended_by_user_id,
  };
}

async function tenantByPublicId(publicId: string, transaction: Transaction, lock = false): Promise<TenantRow | undefined> {
  const rows = await sequelize.query<TenantRow>(`SELECT id,public_id,code,display_name,legal_name,status,
      suspension_reason,suspended_at,suspended_by_user_id
    FROM tenants WHERE public_id=:publicId ${lock ? 'FOR UPDATE' : ''}`,
  { replacements: { publicId }, type: QueryTypes.SELECT, transaction });
  return rows.length === 1 ? rows[0] : undefined;
}

async function lockTenant(tenantId: string, transaction: Transaction): Promise<void> {
  await acquireTenantLifecycleLock({
    query: (sql, options) => sequelize.query(sql, { ...options, transaction }),
  }, tenantId);
}

export class TenantLifecycleCommandRepository {
  async provision(
    evidence: PlatformMutationEvidence,
    command: ProvisionTenantCommand,
    suppliedTransaction?: Transaction,
  ): Promise<TenantLifecycleIdentity> {
    const fixed = requirePlatformMutationOperations(evidence, ['TENANT_PROVISION']);
    let afterAudit: unknown;
    return executeAuthoritativePlatformMutation(fixed, async (transaction, audit) => {
      const code = normalizeTenantCode(command.code);
      const displayName = command.displayName.trim();
      const legalName = command.legalName == null ? null : command.legalName.trim();
      if (!code || code.length > 50 || !/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(code) ||
          !displayName || displayName.length > 150 ||
          (legalName !== null && (!legalName || legalName.length > 200)) ||
          !/^[0-9a-f-]{36}$/i.test(command.initialUserId)) throw unavailable();

      await sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtextextended(:code::text, ${CODE_LOCK_NAMESPACE}::bigint))`,
        { replacements: { code }, transaction },
      );
      const conflict = await sequelize.query(`SELECT 1 FROM tenants WHERE code=:code`,
        { replacements: { code }, type: QueryTypes.SELECT, transaction });
      if (conflict.length) throw unavailable();
      const users = await sequelize.query<{ id: string }>(
        `SELECT id FROM users WHERE id=:initialUserId AND is_active=true FOR KEY SHARE`,
        { replacements: { initialUserId: command.initialUserId }, type: QueryTypes.SELECT, transaction },
      );
      if (users.length !== 1) throw unavailable();
      const roles = await sequelize.query<{ id: string }>(
        `SELECT id FROM rf_role WHERE code='ADMIN' LIMIT 2`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (roles.length !== 1) throw unavailable();

      const tenantId = randomUUID();
      const publicId = randomUUID();
      const membershipId = randomUUID();
      await lockTenant(tenantId, transaction);
      await sequelize.query(`INSERT INTO tenants
        (id,public_id,code,display_name,legal_name,status,created_by_user_id,updated_by_user_id)
        VALUES(:tenantId,:publicId,:code,:displayName,:legalName,'PROVISIONING',:actorUserId,:actorUserId)`, {
        replacements: {
          tenantId, publicId, code, displayName, legalName,
          actorUserId: fixed.authority.principalCode,
        }, transaction,
      });
      assertAuthoritativeTargetTenant(tenantId);
      await sequelize.query(`SELECT set_config('jupiter.tenant_id', :tenantId, true)`, {
        replacements: { tenantId }, transaction,
      });
      await sequelize.query(`INSERT INTO tenant_memberships
        (id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id)
        VALUES(:membershipId,:tenantId,:initialUserId,'ACTIVE',CURRENT_TIMESTAMP,:actorUserId,:actorUserId)`, {
        replacements: { membershipId, tenantId, initialUserId: command.initialUserId, actorUserId: fixed.authority.principalCode }, transaction,
      });
      await sequelize.query(`INSERT INTO tenant_membership_roles
        (id,membership_id,role_id,assigned_by_user_id)
        VALUES(:id,:membershipId,:roleId,:actorUserId)`, {
        replacements: { id: randomUUID(), membershipId, roleId: roles[0]!.id, actorUserId: fixed.authority.principalCode }, transaction,
      });
      const row: TenantRow = {
        id: tenantId, public_id: publicId, code, display_name: displayName,
        legal_name: legalName, status: 'PROVISIONING', suspension_reason: null,
        suspended_at: null, suspended_by_user_id: null,
      };
      audit.setBefore(null);
      afterAudit = {
        tenant: auditState(row),
        initialMembership: { id: membershipId, userId: command.initialUserId, status: 'ACTIVE' },
        initialRole: 'ADMIN',
      };
      return identity(row);
    }, result => ({ resourceId: result.tenantId, after: afterAudit }), suppliedTransaction);
  }

  async provisionWithInitialAdminInvitation(
    evidence: PlatformMutationEvidence,
    command: ProvisionWithInitialAdminCommand,
    suppliedTransaction?: Transaction,
  ): Promise<{ tenant: TenantLifecycleIdentity; invitationId: string }> {
    const fixed = requirePlatformMutationOperations(evidence, ['TENANT_PROVISION']);
    let afterAudit: unknown;
    return executeAuthoritativePlatformMutation(fixed, async (transaction, audit) => {
      const code = normalizeTenantCode(command.code);
      const displayName = command.displayName.trim();
      const legalName = command.legalName == null ? null : command.legalName.trim();
      const email = command.initialAdminEmail.trim().toLowerCase();
      const adminName = command.initialAdminName.trim();
      if (
        !code || code.length > 50 || !/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(code) ||
        !displayName || displayName.length > 150 ||
        (legalName !== null && (!legalName || legalName.length > 200)) ||
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !adminName
      ) throw unavailable();

      await sequelize.query(
        `SELECT pg_advisory_xact_lock(hashtextextended(:code::text, ${CODE_LOCK_NAMESPACE}::bigint))`,
        { replacements: { code }, transaction },
      );
      const conflict = await sequelize.query(`SELECT 1 FROM tenants WHERE code=:code`,
        { replacements: { code }, type: QueryTypes.SELECT, transaction });
      if (conflict.length) throw unavailable();
      const roles = await sequelize.query<{ id: string }>(
        `SELECT id FROM rf_role WHERE code='ADMIN' LIMIT 2`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (roles.length !== 1) throw unavailable();

      const tenantId = randomUUID();
      const publicId = randomUUID();
      const membershipId = randomUUID();

      let userId: string;
      let identityCreated = false;
      const existing = await sequelize.query<{ id: string }>(
        `SELECT id FROM users WHERE lower(btrim(email))=:email AND retired_at IS NULL FOR UPDATE`,
        { replacements: { email }, type: QueryTypes.SELECT, transaction },
      );
      if (existing.length === 1) {
        userId = existing[0]!.id;
      } else {
        userId = randomUUID();
        identityCreated = true;
        await sequelize.query(
          `INSERT INTO users(id,email,password_hash,full_name,is_active,created_at,updated_at) VALUES(:id,:email,'pending-invitation',:name,false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
          { replacements: { id: userId, email, name: adminName }, transaction },
        );
      }

      await lockTenant(tenantId, transaction);
      await sequelize.query(`INSERT INTO tenants
        (id,public_id,code,display_name,legal_name,status,created_by_user_id,updated_by_user_id)
        VALUES(:tenantId,:publicId,:code,:displayName,:legalName,'PROVISIONING',:actorUserId,:actorUserId)`, {
        replacements: {
          tenantId, publicId, code, displayName, legalName,
          actorUserId: fixed.authority.principalCode,
        }, transaction,
      });
      assertAuthoritativeTargetTenant(tenantId);
      await sequelize.query(`SELECT set_config('jupiter.tenant_id', :tenantId, true)`, {
        replacements: { tenantId }, transaction,
      });
      await sequelize.query(`INSERT INTO tenant_memberships
        (id,tenant_id,user_id,status,created_by_user_id,updated_by_user_id)
        VALUES(:membershipId,:tenantId,:userId,'INVITED',:actorUserId,:actorUserId)`, {
        replacements: { membershipId, tenantId, userId, actorUserId: fixed.authority.principalCode }, transaction,
      });
      await sequelize.query(`INSERT INTO tenant_membership_roles
        (id,membership_id,role_id,assigned_by_user_id)
        VALUES(:id,:membershipId,:roleId,:actorUserId)`, {
        replacements: { id: randomUUID(), membershipId, roleId: roles[0]!.id, actorUserId: fixed.authority.principalCode }, transaction,
      });
      await sequelize.query(`INSERT INTO staff_invitations
        (id,tenant_id,membership_id,user_id,normalized_email,token_hash,expires_at,identity_created,invited_by_user_id)
        VALUES(:id,:tenantId,:membershipId,:userId,:email,:tokenHash,:expiresAt,:identityCreated,:actorUserId)`, {
        replacements: {
          id: command.invitationId, tenantId, membershipId, userId, email,
          tokenHash: command.tokenHash, expiresAt: command.expiresAt,
          identityCreated, actorUserId: fixed.authority.principalCode,
        }, transaction,
      });

      const row: TenantRow = {
        id: tenantId, public_id: publicId, code, display_name: displayName,
        legal_name: legalName, status: 'PROVISIONING', suspension_reason: null,
        suspended_at: null, suspended_by_user_id: null,
      };
      audit.setBefore(null);
      afterAudit = {
        tenant: auditState(row),
        initialAdminEmail: email,
        initialAdminName: adminName,
        identityCreated,
        membershipId,
        invitationId: command.invitationId,
        initialRole: 'ADMIN',
      };
      return { tenant: identity(row), invitationId: command.invitationId };
    }, result => ({ resourceId: result.tenant.tenantId, after: afterAudit }), suppliedTransaction);
  }

  async reissueInitialAdminInvitation(
    evidence: PlatformMutationEvidence,
    publicId: string,
    command: ReissueInitialAdminInvitationCommand,
    suppliedTransaction?: Transaction,
  ): Promise<ReissueInitialAdminInvitationResult> {
    const fixed = requirePlatformMutationOperations(evidence, ['TENANT_INVITATION_REISSUE']);
    let afterAudit: unknown;
    return executeAuthoritativePlatformMutation(fixed, async (transaction, audit) => {
      const located = await tenantByPublicId(publicId, transaction);
      if (!located || located.status !== 'PROVISIONING') throw unavailable();
      await lockTenant(located.id, transaction);
      const current = await tenantByPublicId(publicId, transaction, true);
      if (!current || current.id !== located.id || current.status !== 'PROVISIONING') throw unavailable();

      await sequelize.query(`SELECT set_config('jupiter.tenant_id', :tenantId, true)`, {
        replacements: { tenantId: current.id }, transaction,
      });

      const live = await sequelize.query<{ id: string; membership_id: string; user_id: string; normalized_email: string; identity_created: boolean }>(
        `SELECT id,membership_id,user_id,normalized_email,identity_created
         FROM staff_invitations
         WHERE tenant_id=:tenantId AND consumed_at IS NULL AND revoked_at IS NULL
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        { replacements: { tenantId: current.id }, type: QueryTypes.SELECT, transaction },
      );
      const prev = live[0];
      if (!prev) throw unavailable();

      await sequelize.query(
        `UPDATE staff_invitations SET revoked_at=CURRENT_TIMESTAMP, revoked_by_user_id=:actorUserId WHERE id=:id AND consumed_at IS NULL AND revoked_at IS NULL`,
        { replacements: { id: prev.id, actorUserId: fixed.authority.principalCode }, transaction },
      );

      await sequelize.query(
        `INSERT INTO staff_invitations (id,tenant_id,membership_id,user_id,normalized_email,token_hash,expires_at,identity_created,invited_by_user_id)
         VALUES(:id,:tenantId,:membershipId,:userId,:email,:tokenHash,:expiresAt,:identityCreated,:actorUserId)`,
        { replacements: { id: command.invitationId, tenantId: current.id, membershipId: prev.membership_id, userId: prev.user_id, email: prev.normalized_email, tokenHash: command.tokenHash, expiresAt: command.expiresAt, identityCreated: prev.identity_created, actorUserId: fixed.authority.principalCode }, transaction },
      );

      audit.setBefore({ previousInvitationId: prev.id, status: current.status });
      afterAudit = { previousInvitationId: prev.id, newInvitationId: command.invitationId, email: prev.normalized_email };
      return {
        tenantId: current.id,
        publicId: current.public_id,
        tenantName: current.display_name,
        email: prev.normalized_email,
        identityCreated: prev.identity_created,
        invitationId: command.invitationId,
      };
    }, result => ({ resourceId: result.tenantId, after: afterAudit }), suppliedTransaction);
  }

  async correctInitialAdminInvitation(
    evidence: PlatformMutationEvidence,
    publicId: string,
    command: CorrectInitialAdminInvitationCommand,
    suppliedTransaction?: Transaction,
  ): Promise<CorrectInitialAdminInvitationResult> {
    const fixed = requirePlatformMutationOperations(evidence, ['TENANT_ADMIN_INVITATION_CORRECT']);
    let afterAudit: unknown;
    return executeAuthoritativePlatformMutation(fixed, async (transaction, audit) => {
      const email = command.email.trim().toLowerCase();
      const fullName = command.fullName.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !fullName) throw unavailable();

      const located = await tenantByPublicId(publicId, transaction);
      if (!located || located.status !== 'PROVISIONING') throw unavailable();
      await lockTenant(located.id, transaction);
      const current = await tenantByPublicId(publicId, transaction, true);
      if (!current || current.id !== located.id || current.status !== 'PROVISIONING') throw unavailable();

      await sequelize.query(`SELECT set_config('jupiter.tenant_id', :tenantId, true)`, { replacements: { tenantId: current.id }, transaction });

      const live = await sequelize.query<{ id: string; membership_id: string; user_id: string; normalized_email: string; identity_created: boolean }>(
        `SELECT id,membership_id,user_id,normalized_email,identity_created FROM staff_invitations
         WHERE tenant_id=:tenantId AND consumed_at IS NULL AND revoked_at IS NULL
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        { replacements: { tenantId: current.id }, type: QueryTypes.SELECT, transaction },
      );
      const prev = live[0];
      if (!prev) throw unavailable();
      if (prev.normalized_email === email) throw unavailable();

      const membership = await sequelize.query<{ id: string; user_id: string; status: string }>(
        `SELECT id,user_id,status FROM tenant_memberships WHERE id=:id FOR UPDATE`,
        { replacements: { id: prev.membership_id }, type: QueryTypes.SELECT, transaction },
      );
      const m = membership[0];
      if (!m || m.status !== 'INVITED') throw unavailable();

      const previousUser = await sequelize.query<{ is_active: boolean; password_hash: string; retired_at: Date | null }>(
        `SELECT is_active,password_hash,retired_at FROM users WHERE id=:id FOR UPDATE`,
        { replacements: { id: prev.user_id }, type: QueryTypes.SELECT, transaction },
      );
      const prevUser = previousUser[0];
      const isPendingIdentity = !!prev.identity_created && !!prevUser && !prevUser.is_active && prevUser.password_hash === 'pending-invitation' && !prevUser.retired_at;

      let targetUserId: string;
      let identityCreated: boolean;
      const existing = await sequelize.query<{ id: string }>(
        `SELECT id FROM users WHERE lower(btrim(email))=:email AND retired_at IS NULL FOR UPDATE`,
        { replacements: { email }, type: QueryTypes.SELECT, transaction },
      );
      if (existing.length === 1) {
        targetUserId = existing[0]!.id;
        identityCreated = false;
        const dupMember = await sequelize.query<{ id: string }>(
          `SELECT id FROM tenant_memberships WHERE tenant_id=:tenantId AND user_id=:userId AND id<>:membershipId`,
          { replacements: { tenantId: current.id, userId: targetUserId, membershipId: m.id }, type: QueryTypes.SELECT, transaction },
        );
        if (dupMember.length) throw unavailable();
      } else if (isPendingIdentity) {
        targetUserId = prev.user_id;
        identityCreated = true;
        await sequelize.query(`UPDATE users SET email=:email, full_name=:fullName, updated_at=CURRENT_TIMESTAMP WHERE id=:id`, { replacements: { email, fullName, id: targetUserId }, transaction });
      } else {
        targetUserId = randomUUID();
        identityCreated = true;
        await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active,created_at,updated_at) VALUES(:id,:email,'pending-invitation',:fullName,false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, { replacements: { id: targetUserId, email, fullName }, transaction });
      }
      await sequelize.query(
        `UPDATE staff_invitations SET revoked_at=CURRENT_TIMESTAMP, revoked_by_user_id=:actorUserId WHERE tenant_id=:tenantId AND consumed_at IS NULL AND revoked_at IS NULL`,
        { replacements: { tenantId: current.id, actorUserId: fixed.authority.principalCode }, transaction },
      );

      if (targetUserId !== m.user_id) {
        await sequelize.query(
          `UPDATE tenant_memberships SET user_id=:targetUserId, updated_at=CURRENT_TIMESTAMP, updated_by_user_id=:actorUserId WHERE id=:membershipId AND status='INVITED'`,
          { replacements: { targetUserId, actorUserId: fixed.authority.principalCode, membershipId: m.id }, transaction },
        );
      }

      if (isPendingIdentity && targetUserId !== prev.user_id) {
        await sequelize.query(
          `UPDATE users SET retired_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=:id`,
          { replacements: { id: prev.user_id }, transaction },
        );
      }

      await sequelize.query(
        `INSERT INTO staff_invitations (id,tenant_id,membership_id,user_id,normalized_email,token_hash,expires_at,identity_created,invited_by_user_id)
         VALUES(:id,:tenantId,:membershipId,:userId,:email,:tokenHash,:expiresAt,:identityCreated,:actorUserId)`,
        { replacements: { id: command.invitationId, tenantId: current.id, membershipId: m.id, userId: targetUserId, email, tokenHash: command.tokenHash, expiresAt: command.expiresAt, identityCreated, actorUserId: fixed.authority.principalCode }, transaction },
      );

      audit.setBefore({ previousInvitationId: prev.id, previousEmail: prev.normalized_email, status: current.status });
      afterAudit = { previousInvitationId: prev.id, previousEmail: prev.normalized_email, newInvitationId: command.invitationId, newEmail: email, identityCreated };
      return {
        tenantId: current.id,
        publicId: current.public_id,
        tenantName: current.display_name,
        email,
        identityCreated,
        invitationId: command.invitationId,
      };
    }, result => ({ resourceId: result.tenantId, after: afterAudit }), suppliedTransaction);
  }

  async activate(evidence: PlatformMutationEvidence, publicId: string, suppliedTransaction?: Transaction) {
    return this.transition(evidence, 'TENANT_ACTIVATE', publicId, 'PROVISIONING', 'ACTIVE', null, suppliedTransaction);
  }

  async suspend(evidence: PlatformMutationEvidence, publicId: string, reason: string, suppliedTransaction?: Transaction) {
    return this.transition(evidence, 'TENANT_SUSPEND', publicId, 'ACTIVE', 'SUSPENDED', reason, suppliedTransaction);
  }

  async reinstate(evidence: PlatformMutationEvidence, publicId: string, suppliedTransaction?: Transaction) {
    return this.transition(evidence, 'TENANT_REINSTATE', publicId, 'SUSPENDED', 'ACTIVE', null, suppliedTransaction);
  }

  async resolveInitialAdminEmail(publicId: string): Promise<string> {
    return sequelize.transaction(async (transaction) => {
      const located = await tenantByPublicId(publicId, transaction);
      if (!located) throw unavailable();
      await sequelize.query(`SELECT set_config('jupiter.tenant_id', :tenantId, true)`, {
        replacements: { tenantId: located.id }, transaction,
      });
      const rows = await sequelize.query<{ normalized_email: string }>(
        `SELECT normalized_email FROM staff_invitations
         WHERE tenant_id=:tenantId AND consumed_at IS NOT NULL AND revoked_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        { replacements: { tenantId: located.id }, type: QueryTypes.SELECT, transaction },
      );
      const row = rows[0];
      if (!row) throw unavailable();
      return row.normalized_email;
    });
  }

  private async transition(
    evidence: PlatformMutationEvidence,
    operation: 'TENANT_ACTIVATE' | 'TENANT_SUSPEND' | 'TENANT_REINSTATE',
    publicId: string,
    from: TenantLifecycleIdentity['status'],
    to: TenantLifecycleIdentity['status'],
    suspensionReason: string | null,
    suppliedTransaction?: Transaction,
  ): Promise<TenantLifecycleIdentity> {
    const fixed = requirePlatformMutationOperations(evidence, [operation]);
    let afterAudit: unknown;
    return executeAuthoritativePlatformMutation(fixed, async (transaction, audit) => {
      const located = await tenantByPublicId(publicId, transaction);
      if (!located) throw unavailable();
      await lockTenant(located.id, transaction);
      const current = await tenantByPublicId(publicId, transaction, true);
      if (!current || current.id !== located.id || current.status !== from) throw unavailable();
      if (operation === 'TENANT_ACTIVATE') {
        assertAuthoritativeTargetTenant(current.id);
        await sequelize.query(`SELECT set_config('jupiter.tenant_id', :tenantId, true)`, {
          replacements: { tenantId: current.id }, transaction,
        });
        const admins = await sequelize.query(`SELECT 1 FROM tenant_memberships tm
          JOIN tenant_membership_roles tmr ON tmr.membership_id=tm.id AND tmr.revoked_at IS NULL
          JOIN rf_role r ON r.id=tmr.role_id AND r.code='ADMIN'
          WHERE tm.tenant_id=:tenantId AND tm.status='ACTIVE' LIMIT 1`,
        { replacements: { tenantId: current.id }, type: QueryTypes.SELECT, transaction });
        if (admins.length !== 1) throw unavailable();
      }
      const reason = suspensionReason?.trim() || null;
      if (operation === 'TENANT_SUSPEND' && !reason) throw unavailable();
      audit.setBefore(auditState(current));
      await sequelize.query(`UPDATE tenants SET status=:to,
          suspension_reason=:reason,
          suspended_at=${to === 'SUSPENDED' ? 'CURRENT_TIMESTAMP' : 'NULL'},
          suspended_by_user_id=${to === 'SUSPENDED' ? ':actorUserId' : 'NULL'},
          updated_at=CURRENT_TIMESTAMP,updated_by_user_id=:actorUserId
        WHERE id=:tenantId AND status=:from`, {
        replacements: { to, reason, actorUserId: fixed.authority.principalCode, tenantId: current.id, from }, transaction,
      });
      const updated = await tenantByPublicId(publicId, transaction, true);
      if (!updated || updated.status !== to) throw unavailable();
      afterAudit = auditState(updated);
      return identity(updated);
    }, result => ({ resourceId: result.tenantId, after: afterAudit }), suppliedTransaction);
  }
}
