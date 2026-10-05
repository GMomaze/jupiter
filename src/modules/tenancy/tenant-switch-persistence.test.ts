import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type {
  OpaqueTenantSwitchCorrelationHash,
  RejectedTargetFingerprint,
  SafeRejectedTargetMetadata,
} from './tenant-switch-contracts.js';
import {
  TENANT_SWITCH_PERSISTENCE_ERROR,
  TenantSwitchPersistenceRepository,
} from './tenant-switch-persistence.repository.js';

const hash = 'A'.repeat(43) as OpaqueTenantSwitchCorrelationHash;
const fingerprint = 'B'.repeat(43) as RejectedTargetFingerprint;
const pending = {
  attemptId: 'attempt-1',
  actorUserId: 'user-1',
  previousTenantId: 'tenant-a',
  previousMembershipId: 'membership-a',
  targetTenantId: 'tenant-b',
  targetMembershipId: 'membership-b',
  requestCorrelation: hash,
  previousSessionCorrelation: hash,
  occurredAt: new Date('2026-08-25T00:00:00Z'),
};

function repository(rowCount = 1) {
  const query = vi.fn(async () => ({ rows: [], rowCount }));
  return { repository: new TenantSwitchPersistenceRepository({ query }), query };
}

describe('TenantSwitchPersistenceRepository', () => {
  it('creates only a PENDING attempt with parameterized resolved attribution', async () => {
    const h = repository();
    await expect(h.repository.createPending(pending)).resolves.toEqual({ created: true });
    expect(h.query).toHaveBeenCalledOnce();
    expect(h.query.mock.calls[0][0]).toContain("'PENDING'");
    expect(h.query.mock.calls[0][0]).not.toContain('tenant-b');
    expect(h.query.mock.calls[0][1]).toContain('tenant-b');
  });

  it('classifies only the approved SQLSTATE and exact idempotency constraint as duplicate', async () => {
    const h = repository();
    h.query.mockRejectedValueOnce({
      code: '23505',
      constraint: 'tenant_context_switch_attempts_actor_request_unique',
      message: 'must not be exposed',
      detail: 'must not be exposed',
    });

    await expect(h.repository.createPending(pending)).resolves.toEqual({
      created: false,
      reason: 'DUPLICATE_REQUEST',
    });
  });

  it.each([
    [
      'another unique constraint',
      { code: '23505', constraint: 'some_other_unique_constraint' },
    ],
    [
      'wrong SQLSTATE',
      {
        code: '23503',
        constraint: 'tenant_context_switch_attempts_actor_request_unique',
      },
    ],
    ['missing structured fields', { message: 'duplicate key value' }],
    ['foreign-key violation', { code: '23503', constraint: 'attempt_actor_fk' }],
    ['check violation', { code: '23514', constraint: 'attempt_state_check' }],
    ['connection failure', new Error('connection detail must not escape')],
    ['general failure', 'unexpected failure'],
  ])('keeps %s as the stable technical failure', async (_label, error) => {
    const h = repository();
    h.query.mockRejectedValueOnce(error);

    await expect(h.repository.createPending(pending)).rejects.toThrow(
      TENANT_SWITCH_PERSISTENCE_ERROR,
    );
    await expect(h.repository.createPending({
      ...pending,
      targetMembershipId: undefined,
    })).rejects.toThrow(TENANT_SWITCH_PERSISTENCE_ERROR);
  });

  it('atomically finalizes SWITCHED and appends immutable audit evidence', async () => {
    const h = repository();
    await h.repository.finalizeSwitched({
      attemptId: 'attempt-1', actorUserId: 'user-1', eventId: 'event-1',
      regeneratedSessionCorrelation: hash,
      finalizedAt: new Date('2026-08-25T00:01:00Z'),
    });
    const sql = h.query.mock.calls[0][0];
    expect(sql).toContain("state = 'SWITCHED'");
    expect(sql).toContain("state = 'PENDING'");
    expect(sql).toContain("'TENANT_CONTEXT_SWITCHED'");
    expect(sql).toContain('INSERT INTO public.audit_log');
  });

  it('finalizes REJECTED with fingerprint evidence and no raw public ID', async () => {
    const h = repository();
    const rejectedTarget: SafeRejectedTargetMetadata = Object.freeze({
      fingerprint, boundedInputLength: 15, inputLengthCapped: false,
      reason: 'ORGANISATION_UNAVAILABLE',
    });
    await h.repository.createPending({
      ...pending,
      targetTenantId: undefined,
      targetMembershipId: undefined,
      rejectedTarget,
    });
    await h.repository.finalizeRejected({
      attemptId: 'attempt-1', actorUserId: 'user-1', eventId: 'event-2',
      finalizedAt: new Date('2026-08-25T00:01:00Z'),
    });
    expect(h.query.mock.calls[0][1]).toContain(fingerprint);
    expect(h.query.mock.calls[1][0]).toContain("'TENANT_CONTEXT_REJECTED'");
    expect(JSON.stringify(h.query.mock.calls)).not.toContain('foreign-public-id');
  });

  it('fails closed for invalid fingerprint or incomplete target attribution', async () => {
    const h = repository();
    await expect(h.repository.createPending({
      ...pending,
      targetMembershipId: undefined,
    })).rejects.toThrow(TENANT_SWITCH_PERSISTENCE_ERROR);
    await expect(h.repository.createPending({
      ...pending,
      targetTenantId: undefined,
      targetMembershipId: undefined,
      rejectedTarget: {
        fingerprint: 'raw-public-id' as RejectedTargetFingerprint,
        boundedInputLength: 13,
        inputLengthCapped: false,
        reason: 'ORGANISATION_UNAVAILABLE',
      },
    })).rejects.toThrow(TENANT_SWITCH_PERSISTENCE_ERROR);
    expect(h.query).not.toHaveBeenCalled();
  });

  it('permits only PENDING to FAILED and requires exactly one affected row', async () => {
    const h = repository();
    await h.repository.finalizeFailed({
      attemptId: 'attempt-1', actorUserId: 'user-1',
      failureCategory: 'SESSION_PERSISTENCE',
      finalizedAt: new Date('2026-08-25T00:01:00Z'),
    });
    expect(h.query.mock.calls[0][0]).toContain("state = 'FAILED'");
    expect(h.query.mock.calls[0][0]).toContain("state = 'PENDING'");
    const missing = repository(0);
    await expect(missing.repository.finalizeFailed({
      attemptId: 'attempt-1', actorUserId: 'user-1',
      failureCategory: 'INTERNAL', finalizedAt: new Date(),
    })).rejects.toThrow(TENANT_SWITCH_PERSISTENCE_ERROR);
  });

  it('migration locks vocabulary, idempotency, privacy, and guarded transitions', () => {
    const source = readFileSync(resolve('migrations/589_create_tenant_context_switch_attempts.ts'), 'utf8');
    expect(source).toMatch(/state IN \('PENDING', 'SWITCHED', 'REJECTED', 'FAILED'\)/);
    expect(source).toContain('UNIQUE (actor_user_id, request_correlation_hash)');
    expect(source).toContain("OLD.state <> 'PENDING'");
    expect(source).toContain("NEW.state NOT IN ('SWITCHED', 'REJECTED', 'FAILED')");
    expect(source).toContain("rejected_input_length BETWEEN 0 AND 256");
    expect(source).not.toMatch(/tenant_public_id/i);
    expect(source).not.toMatch(/INSERT INTO|bulkInsert|seed/i);
  });

  it('remains dormant and contains no RBAC, routing, RLS, or operational authority', () => {
    const repositorySource = readFileSync(resolve('src/modules/tenancy/tenant-switch-persistence.repository.ts'), 'utf8');
    const lockSource = readFileSync(resolve('src/modules/tenancy/tenant-switch-advisory-lock.ts'), 'utf8');
    const combined = `${repositorySource}\n${lockSource}`;
    expect(combined).not.toMatch(/\bADMIN\b|user_roles|tenant_membership_roles|permissions|requireRole/);
    expect(combined).not.toMatch(/express|Router|app\.use|organisation\/switch|activeTenantContext\s*=/);
    expect(combined).not.toMatch(/CREATE POLICY|ENABLE ROW LEVEL SECURITY|operational_tenant_id/i);
    expect(combined).not.toMatch(/tenant-switch-coordinator|organisation-switch\.routes/);
  });
});
