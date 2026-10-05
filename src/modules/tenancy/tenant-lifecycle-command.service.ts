import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PlatformAuthority } from '../platform-authority/platform-authority.js';
import { platformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import type { TenantLifecycleOperation } from './tenant-lifecycle-policy.js';
import {
  TenantLifecycleCommandRepository,
  type ProvisionTenantCommand,
  type TenantLifecycleIdentity,
} from './tenant-lifecycle-command.repository.js';
import type { StaffInvitationDelivery } from '../auth/staff-membership-administration.js';
import { emitOperationalEvent } from '../observability/operational-event.js';

export const INITIAL_ADMIN_INVITATION_TTL_MS = 24 * 60 * 60 * 1000;
export const INVITATION_DELIVERY_FAILED = 'INVITATION_DELIVERY_FAILED';

export type ProvisionWithInitialAdminInput = Readonly<{
  code: string;
  displayName: string;
  legalName?: string | null;
  initialAdminEmail: string;
  initialAdminName: string;
}>;

export type InitialAdminProvisionResult = Readonly<{
  tenantId: string;
  publicId: string;
  invitationId: string;
  expiresAt: Date;
}>;

export type LifecycleCommandContext = Readonly<{
  authority: PlatformAuthority;
  reason: string;
  correlationId?: string;
  source?: Readonly<Record<string, unknown>>;
}>;

export type TenantActivationDeliveryMessage = Readonly<{
  email: string;
  companyDisplayName: string;
}>;

export interface TenantActivationDelivery {
  deliver(message: TenantActivationDeliveryMessage): Promise<void>;
}

export class TenantLifecycleCommandService {
  constructor(
    private readonly repository: TenantLifecycleCommandRepository,
    private readonly delivery: StaffInvitationDelivery,
    private readonly activationDelivery?: TenantActivationDelivery,
  ) {}

  private evidence(context: LifecycleCommandContext, operation: TenantLifecycleOperation, publicId?: string) {
    return platformMutationEvidence(context.authority, [operation], {
      reason: context.reason,
      correlationId: context.correlationId ?? randomUUID(),
      source: context.source ?? { kind: 'TENANT_LIFECYCLE_COMMAND' },
      resourceType: 'tenant',
      ...(publicId === undefined ? {} : { resourceId: publicId }),
    });
  }

  provision(context: LifecycleCommandContext, command: ProvisionTenantCommand) {
    return this.repository.provision(this.evidence(context, 'TENANT_PROVISION'), command);
  }

  async provisionWithInitialAdminInvitation(
    context: LifecycleCommandContext,
    command: ProvisionWithInitialAdminInput,
  ): Promise<InitialAdminProvisionResult> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitationId = randomUUID();
    const expiresAt = new Date(Date.now() + INITIAL_ADMIN_INVITATION_TTL_MS);
    const result = await this.repository.provisionWithInitialAdminInvitation(
      this.evidence(context, 'TENANT_PROVISION'),
      {
        code: command.code,
        displayName: command.displayName,
        ...(command.legalName == null ? {} : { legalName: command.legalName }),
        initialAdminEmail: command.initialAdminEmail,
        initialAdminName: command.initialAdminName,
        invitationId,
        tokenHash,
        expiresAt,
      },
    );
    try {
      await this.delivery.deliver({
        email: command.initialAdminEmail.trim().toLowerCase(),
        token,
        expiresAt,
        tenantId: result.tenant.tenantId,
        tenantName: result.tenant.displayName,
        initialAdmin: true,
      });
    } catch (error) {
      throw new Error(INVITATION_DELIVERY_FAILED);
    }
    return Object.freeze({
      tenantId: result.tenant.tenantId,
      publicId: result.tenant.publicId,
      invitationId: result.invitationId,
      expiresAt,
    });
  }
  async activate(context: LifecycleCommandContext, publicId: string) {
    const identity = await this.repository.activate(this.evidence(context, 'TENANT_ACTIVATE', publicId), publicId);
    await this.notifyInitialAdmin(identity, context.correlationId);
    return identity;
  }

  private async notifyInitialAdmin(identity: TenantLifecycleIdentity, correlationId?: string): Promise<void> {
    if (!this.activationDelivery) return;
    try {
      const email = await this.repository.resolveInitialAdminEmail(identity.publicId);
      await this.activationDelivery.deliver({ email, companyDisplayName: identity.displayName });
      emitOperationalEvent({ code: 'TENANT_ACTIVATION_NOTIFICATION_DELIVERED', severity: 'INFO', outcome: 'SUCCESS', operation: 'TENANT_ACTIVATION_NOTIFICATION', tenantId: identity.tenantId, ...(correlationId ? { correlationId } : {}) });
    } catch (error) {
      emitOperationalEvent({ code: 'TENANT_ACTIVATION_NOTIFICATION_FAILED', severity: 'ERROR', outcome: 'FAILED', operation: 'TENANT_ACTIVATION_NOTIFICATION', tenantId: identity.tenantId, error, ...(correlationId ? { correlationId } : {}) });
    }
  }
  suspend(context: LifecycleCommandContext, publicId: string) {
    return this.repository.suspend(this.evidence(context, 'TENANT_SUSPEND', publicId), publicId, context.reason);
  }
  reinstate(context: LifecycleCommandContext, publicId: string) {
    return this.repository.reinstate(this.evidence(context, 'TENANT_REINSTATE', publicId), publicId);
  }

  async reissueInitialAdminInvitation(
    context: LifecycleCommandContext,
    publicId: string,
  ): Promise<{ publicId: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitationId = randomUUID();
    const expiresAt = new Date(Date.now() + INITIAL_ADMIN_INVITATION_TTL_MS);
    const result = await this.repository.reissueInitialAdminInvitation(
      this.evidence(context, 'TENANT_INVITATION_REISSUE', publicId),
      publicId,
      { invitationId, tokenHash, expiresAt },
    );
    try {
      await this.delivery.deliver({
        email: result.email,
        token,
        expiresAt,
        tenantId: result.tenantId,
        tenantName: result.tenantName,
        initialAdmin: true,
      });
    } catch (error) {
      throw new Error(INVITATION_DELIVERY_FAILED);
    }
    return Object.freeze({ publicId: result.publicId, expiresAt });
  }

  async correctInitialAdminInvitation(
    context: LifecycleCommandContext,
    publicId: string,
    email: string,
    fullName: string,
  ): Promise<{ publicId: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitationId = randomUUID();
    const expiresAt = new Date(Date.now() + INITIAL_ADMIN_INVITATION_TTL_MS);
    const result = await this.repository.correctInitialAdminInvitation(
      this.evidence(context, 'TENANT_ADMIN_INVITATION_CORRECT', publicId),
      publicId,
      { email, fullName, invitationId, tokenHash, expiresAt },
    );
    try {
      await this.delivery.deliver({
        email: result.email,
        token,
        expiresAt,
        tenantId: result.tenantId,
        tenantName: result.tenantName,
        initialAdmin: true,
      });
    } catch (error) {
      throw new Error(INVITATION_DELIVERY_FAILED);
    }
    return Object.freeze({ publicId: result.publicId, expiresAt });
  }
}
