import type {
  OpaqueTenantSwitchCorrelationHash,
  SafeRejectedTargetMetadata,
} from './tenant-switch-contracts.js';

export interface TenantSwitchSqlResult<Row = Record<string, unknown>> {
  readonly rows: readonly Row[];
  readonly rowCount: number | null;
}
export interface TenantSwitchSqlExecutor {
  query<Row = Record<string, unknown>>(
    sql: string,
    values: readonly unknown[],
  ): Promise<TenantSwitchSqlResult<Row>>;
}

export interface CreatePendingTenantSwitchAttempt {
  readonly attemptId: string;
  readonly actorUserId: string;
  readonly previousTenantId: string;
  readonly previousMembershipId: string;
  readonly targetTenantId?: string;
  readonly targetMembershipId?: string;
  readonly rejectedTarget?: SafeRejectedTargetMetadata;
  readonly requestCorrelation: OpaqueTenantSwitchCorrelationHash;
  readonly previousSessionCorrelation?: OpaqueTenantSwitchCorrelationHash;
  readonly occurredAt: Date;
}

export type CreatePendingTenantSwitchAttemptResult =
  | Readonly<{ created: true }>
  | Readonly<{ created: false; reason: 'DUPLICATE_REQUEST' }>;

export interface FinalizeSwitchedTenantSwitchAttempt {
  readonly attemptId: string;
  readonly actorUserId: string;
  readonly eventId: string;
  readonly regeneratedSessionCorrelation: OpaqueTenantSwitchCorrelationHash;
  readonly finalizedAt: Date;
}

export interface FinalizeRejectedTenantSwitchAttempt {
  readonly attemptId: string;
  readonly actorUserId: string;
  readonly eventId: string;
  readonly finalizedAt: Date;
}

export interface FinalizeFailedTenantSwitchAttempt {
  readonly attemptId: string;
  readonly actorUserId: string;
  readonly failureCategory: 'SESSION_PERSISTENCE' | 'AUDIT_PERSISTENCE' | 'INTERNAL';
  readonly finalizedAt: Date;
}

const HASH_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const REJECTION_REASONS = new Set([
  'ORGANISATION_UNAVAILABLE',
  'SAME_ORGANISATION',
  'STALE_REQUEST',
  'CONCURRENT_REQUEST_LOST',
]);
export const TENANT_SWITCH_PERSISTENCE_ERROR = 'Tenant switch persistence failed.';
const REQUEST_IDEMPOTENCY_CONSTRAINT =
  'tenant_context_switch_attempts_actor_request_unique';

function assertOpaqueHash(value: string | undefined): void {
  if (value !== undefined && !HASH_PATTERN.test(value)) {
    throw new Error(TENANT_SWITCH_PERSISTENCE_ERROR);
  }
}

function assertRejectedTarget(value: SafeRejectedTargetMetadata | undefined): void {
  if (!value) return;
  assertOpaqueHash(value.fingerprint);
  if (
    !Number.isInteger(value.boundedInputLength) ||
    value.boundedInputLength < 0 ||
    value.boundedInputLength > 256 ||
    typeof value.inputLengthCapped !== 'boolean' ||
    !REJECTION_REASONS.has(value.reason)
  ) {
    throw new Error(TENANT_SWITCH_PERSISTENCE_ERROR);
  }
}

function assertChanged(rowCount: number | null): void {
  if (rowCount !== 1) throw new Error(TENANT_SWITCH_PERSISTENCE_ERROR);
}

function isDuplicateRequestError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const postgresError = error as {
    readonly code?: unknown;
    readonly constraint?: unknown;
  };
  return (
    postgresError.code === '23505' &&
    postgresError.constraint === REQUEST_IDEMPOTENCY_CONSTRAINT
  );
}

export class TenantSwitchPersistenceRepository {
  constructor(private readonly sql: TenantSwitchSqlExecutor) {}

  async createPending(
    input: CreatePendingTenantSwitchAttempt,
  ): Promise<CreatePendingTenantSwitchAttemptResult> {
    const hasTarget = Boolean(input.targetTenantId && input.targetMembershipId);
    if (Boolean(input.targetTenantId) !== Boolean(input.targetMembershipId)) {
      throw new Error(TENANT_SWITCH_PERSISTENCE_ERROR);
    }
    if (!hasTarget && !input.rejectedTarget) {
      throw new Error(TENANT_SWITCH_PERSISTENCE_ERROR);
    }
    assertRejectedTarget(input.rejectedTarget);
    assertOpaqueHash(input.requestCorrelation);
    assertOpaqueHash(input.previousSessionCorrelation);

    try {
      const result = await this.sql.query(
        `INSERT INTO public.tenant_context_switch_attempts (
           id, actor_user_id, previous_tenant_id, previous_membership_id,
           target_tenant_id, target_membership_id, state,
           rejection_reason, rejected_target_fingerprint,
           rejected_input_length, rejected_input_length_capped,
           request_correlation_hash, previous_session_correlation_hash, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9, $10, $11, $12, $13)`,
        [
          input.attemptId,
          input.actorUserId,
          input.previousTenantId,
          input.previousMembershipId,
          input.targetTenantId ?? null,
          input.targetMembershipId ?? null,
          input.rejectedTarget?.reason ?? null,
          input.rejectedTarget?.fingerprint ?? null,
          input.rejectedTarget?.boundedInputLength ?? null,
          input.rejectedTarget?.inputLengthCapped ?? null,
          input.requestCorrelation,
          input.previousSessionCorrelation ?? null,
          input.occurredAt,
        ],
      );
      assertChanged(result.rowCount);
      return Object.freeze({ created: true });
    } catch (error) {
      if (isDuplicateRequestError(error)) {
        return Object.freeze({ created: false, reason: 'DUPLICATE_REQUEST' });
      }
      throw new Error(TENANT_SWITCH_PERSISTENCE_ERROR);
    }
  }

  async finalizeSwitched(input: FinalizeSwitchedTenantSwitchAttempt): Promise<void> {
    assertOpaqueHash(input.regeneratedSessionCorrelation);
    try {
      const result = await this.sql.query(
        `WITH finalized AS (
           UPDATE public.tenant_context_switch_attempts
              SET state = 'SWITCHED', finalized_at = $4,
                  regenerated_session_correlation_hash = $3
            WHERE id = $1 AND actor_user_id = $2 AND state = 'PENDING'
              AND target_tenant_id IS NOT NULL AND target_membership_id IS NOT NULL
            RETURNING *
         )
         INSERT INTO public.audit_log (
           id, table_name, row_id, action, actor_id, old_values, new_values, created_at
         )
         SELECT $5, 'tenant_context_switch_attempts', id,
                'TENANT_CONTEXT_SWITCHED', actor_user_id,
                jsonb_build_object(
                  'tenantId', previous_tenant_id,
                  'membershipId', previous_membership_id,
                  'sessionCorrelation', previous_session_correlation_hash
                ),
                jsonb_build_object(
                  'tenantId', target_tenant_id,
                  'membershipId', target_membership_id,
                  'sessionCorrelation', regenerated_session_correlation_hash,
                  'requestCorrelation', request_correlation_hash
                ),
                $4
           FROM finalized`,
        [
          input.attemptId,
          input.actorUserId,
          input.regeneratedSessionCorrelation,
          input.finalizedAt,
          input.eventId,
        ],
      );
      assertChanged(result.rowCount);
    } catch {
      throw new Error(TENANT_SWITCH_PERSISTENCE_ERROR);
    }
  }

  async finalizeRejected(input: FinalizeRejectedTenantSwitchAttempt): Promise<void> {
    try {
      const result = await this.sql.query(
        `WITH finalized AS (
           UPDATE public.tenant_context_switch_attempts
              SET state = 'REJECTED', finalized_at = $3
            WHERE id = $1 AND actor_user_id = $2 AND state = 'PENDING'
              AND rejected_target_fingerprint IS NOT NULL
            RETURNING *
         )
         INSERT INTO public.audit_log (
           id, table_name, row_id, action, actor_id, old_values, new_values, reason, created_at
         )
         SELECT $4, 'tenant_context_switch_attempts', id,
                'TENANT_CONTEXT_REJECTED', actor_user_id,
                jsonb_build_object(
                  'tenantId', previous_tenant_id,
                  'membershipId', previous_membership_id,
                  'sessionCorrelation', previous_session_correlation_hash
                ),
                jsonb_build_object(
                  'targetFingerprint', rejected_target_fingerprint,
                  'boundedInputLength', rejected_input_length,
                  'inputLengthCapped', rejected_input_length_capped,
                  'requestCorrelation', request_correlation_hash
                ),
                rejection_reason,
                $3
           FROM finalized`,
        [input.attemptId, input.actorUserId, input.finalizedAt, input.eventId],
      );
      assertChanged(result.rowCount);
    } catch {
      throw new Error(TENANT_SWITCH_PERSISTENCE_ERROR);
    }
  }

  async finalizeFailed(input: FinalizeFailedTenantSwitchAttempt): Promise<void> {
    try {
      const result = await this.sql.query(
        `UPDATE public.tenant_context_switch_attempts
            SET state = 'FAILED', failure_category = $3, finalized_at = $4
          WHERE id = $1 AND actor_user_id = $2 AND state = 'PENDING'`,
        [
          input.attemptId,
          input.actorUserId,
          input.failureCategory,
          input.finalizedAt,
        ],
      );
      assertChanged(result.rowCount);
    } catch {
      throw new Error(TENANT_SWITCH_PERSISTENCE_ERROR);
    }
  }
}
