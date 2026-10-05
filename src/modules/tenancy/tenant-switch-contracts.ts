import type { ActiveTenantSessionContext } from './active-tenant-context.types.js';

export const TENANT_SWITCH_ATTEMPT_STATES = Object.freeze([
  'PENDING',
  'SWITCHED',
  'REJECTED',
  'FAILED',
] as const);

export type TenantSwitchAttemptState =
  (typeof TENANT_SWITCH_ATTEMPT_STATES)[number];

export const TENANT_SWITCH_AUDIT_ACTIONS = Object.freeze([
  'TENANT_CONTEXT_SWITCHED',
  'TENANT_CONTEXT_REJECTED',
] as const);

export type TenantSwitchAuditAction =
  (typeof TENANT_SWITCH_AUDIT_ACTIONS)[number];

export const TENANT_SWITCH_REJECTION_REASONS = Object.freeze([
  'ORGANISATION_UNAVAILABLE',
  'SAME_ORGANISATION',
  'STALE_REQUEST',
  'CONCURRENT_REQUEST_LOST',
] as const);

export type TenantSwitchRejectionReason =
  (typeof TENANT_SWITCH_REJECTION_REASONS)[number];

export type ExpectedTenantContextToken = string & {
  readonly __expectedTenantContextToken: unique symbol;
};

export type OpaqueTenantSwitchCorrelationHash = string & {
  readonly __opaqueTenantSwitchCorrelationHash: unique symbol;
};

export type RejectedTargetFingerprint = string & {
  readonly __rejectedTargetFingerprint: unique symbol;
};

export interface TenantSwitchRequestContract {
  readonly tenantPublicId: string;
  readonly expectedContextToken: ExpectedTenantContextToken;
}

export type TenantSwitchResultContract =
  | Readonly<{
      outcome: 'SWITCHED';
      destination: '/';
      context: ActiveTenantSessionContext;
    }>
  | Readonly<{
      outcome: 'REJECTED';
      message: 'Organisation unavailable';
    }>
  | Readonly<{
      outcome: 'FAILED';
      message: 'Organisation switching is temporarily unavailable';
    }>;

export interface TenantSwitchAuthorityContract {
  readonly authenticatedUserId: string;
  readonly currentContext: ActiveTenantSessionContext;
  readonly target: Readonly<{
    tenantId: string;
    membershipId: string;
    membershipUserId: string;
    membershipStatus: 'ACTIVE';
    tenantStatus: 'ACTIVE';
  }>;
}

export interface SafeRejectedTargetMetadata {
  readonly fingerprint: RejectedTargetFingerprint;
  readonly boundedInputLength: number;
  readonly inputLengthCapped: boolean;
  readonly reason: TenantSwitchRejectionReason;
}

export interface TenantSwitchCorrelationContract {
  readonly request: OpaqueTenantSwitchCorrelationHash;
  readonly previousSession?: OpaqueTenantSwitchCorrelationHash;
  readonly regeneratedSession?: OpaqueTenantSwitchCorrelationHash;
}

interface TenantSwitchAttribution {
  readonly actorUserId: string;
  readonly previousTenantId: string;
  readonly previousMembershipId: string;
  readonly occurredAt: number;
  readonly correlation: TenantSwitchCorrelationContract;
}

export interface TenantSwitchPendingAttempt extends TenantSwitchAttribution {
  readonly state: 'PENDING';
  readonly attemptId: string;
  readonly targetTenantId: string;
  readonly targetMembershipId: string;
}

export interface TenantSwitchSwitchedAttempt extends TenantSwitchAttribution {
  readonly state: 'SWITCHED';
  readonly attemptId: string;
  readonly targetTenantId: string;
  readonly targetMembershipId: string;
  readonly finalizedAt: number;
}

export interface TenantSwitchRejectedAttempt extends TenantSwitchAttribution {
  readonly state: 'REJECTED';
  readonly attemptId: string;
  readonly rejectedTarget: SafeRejectedTargetMetadata;
  readonly finalizedAt: number;
}

export interface TenantSwitchFailedAttempt extends TenantSwitchAttribution {
  readonly state: 'FAILED';
  readonly attemptId: string;
  readonly failureCategory: 'SESSION_PERSISTENCE' | 'AUDIT_PERSISTENCE' | 'INTERNAL';
  readonly finalizedAt: number;
}

export type TenantSwitchAttemptContract =
  | TenantSwitchPendingAttempt
  | TenantSwitchSwitchedAttempt
  | TenantSwitchRejectedAttempt
  | TenantSwitchFailedAttempt;

export interface TenantContextSwitchedAuditEvent extends TenantSwitchAttribution {
  readonly action: 'TENANT_CONTEXT_SWITCHED';
  readonly eventId: string;
  readonly attemptId: string;
  readonly newTenantId: string;
  readonly newMembershipId: string;
}

export interface TenantContextRejectedAuditEvent extends TenantSwitchAttribution {
  readonly action: 'TENANT_CONTEXT_REJECTED';
  readonly eventId: string;
  readonly attemptId: string;
  readonly rejectedTarget: SafeRejectedTargetMetadata;
}

export type TenantSwitchAuditEventContract =
  | Readonly<TenantContextSwitchedAuditEvent>
  | Readonly<TenantContextRejectedAuditEvent>;
