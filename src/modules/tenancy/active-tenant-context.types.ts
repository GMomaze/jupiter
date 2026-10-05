export const TENANT_CONTEXT_STATES = [
  'NO_TENANT_CONTEXT',
  'VALID_ACTIVE_TENANT',
  'STALE_MEMBERSHIP',
  'SUSPENDED_MEMBERSHIP',
  'DISABLED_MEMBERSHIP',
  'PROVISIONING_TENANT',
  'SUSPENDED_TENANT',
  'ARCHIVED_TENANT',
] as const;

export type TenantContextState = (typeof TENANT_CONTEXT_STATES)[number];
export type TenantContextMembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
export type TenantContextTenantStatus = 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface ActiveTenantSessionContext {
  readonly tenantId: string;
  readonly membershipId: string;
  readonly contextVersion: 1;
  readonly selectedAt: number;
  readonly validatedAt: number;
}

export interface TenantContextMembershipRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly status: TenantContextMembershipStatus;
}

export interface TenantContextTenantRecord {
  readonly id: string;
  readonly publicId: string;
  readonly code: string;
  readonly displayName: string;
  readonly status: TenantContextTenantStatus;
}

export interface TenantMembershipRelationship {
  readonly membership: TenantContextMembershipRecord;
  readonly tenant: TenantContextTenantRecord | null;
}

export interface ValidActiveTenantContext {
  readonly state: 'VALID_ACTIVE_TENANT';
  readonly tenant: Readonly<{
    id: string;
    publicId: string;
    code: string;
    displayName: string;
    status: 'ACTIVE';
  }>;
  readonly membership: Readonly<{
    id: string;
    tenantId: string;
    userId: string;
    status: 'ACTIVE';
  }>;
  readonly validatedAt: number;
}

export type InvalidTenantContextState = Exclude<TenantContextState, 'VALID_ACTIVE_TENANT'>;

export interface InvalidTenantContextDecision {
  readonly state: InvalidTenantContextState;
  readonly context?: never;
  readonly tenant?: never;
  readonly membership?: never;
}

export type TenantContextDecision = ValidActiveTenantContext | InvalidTenantContextDecision;

export interface EligibleTenantCandidate {
  readonly membershipId: string;
  readonly tenantId: string;
  readonly tenantPublicId: string;
  readonly tenantCode: string;
  readonly tenantDisplayName: string;
}

export type TenantSelectionResolution =
  | Readonly<{ available: true; candidate: EligibleTenantCandidate }>
  | Readonly<{ available: false }>;

export type EligibleMembershipDecision =
  | Readonly<{ kind: 'NONE'; state: 'NO_TENANT_CONTEXT'; candidates: readonly [] }>
  | Readonly<{ kind: 'SINGLE'; candidate: EligibleTenantCandidate; candidates: readonly [EligibleTenantCandidate] }>
  | Readonly<{ kind: 'MULTIPLE'; candidates: readonly EligibleTenantCandidate[] }>;
