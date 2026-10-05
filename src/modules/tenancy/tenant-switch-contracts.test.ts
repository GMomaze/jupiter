import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveTenantSessionContext } from './active-tenant-context.types.js';
import {
  TENANT_SWITCH_ATTEMPT_STATES,
  TENANT_SWITCH_AUDIT_ACTIONS,
} from './tenant-switch-contracts.js';
import {
  MAX_RECORDED_REJECTED_TARGET_LENGTH,
  createTenantSwitchTokenCodec,
} from './tenant-switch-token.js';

const secret = '3c4a-test-secret-that-is-at-least-thirty-two-bytes';
const context: ActiveTenantSessionContext = Object.freeze({
  tenantId: 'internal-tenant-a',
  membershipId: 'internal-membership-a',
  contextVersion: 1,
  selectedAt: 101,
  validatedAt: 102,
});

describe('tenant switch token and audit contracts', () => {
  it('creates deterministic opaque expected-context tokens', () => {
    const codec = createTenantSwitchTokenCodec(secret);
    const input = { authenticatedUserId: 'user-a', context };
    const first = codec.createExpectedContextToken(input);
    const second = codec.createExpectedContextToken(input);

    expect(first).toBe(second);
    expect(first).toMatch(/^v1\.[A-Za-z0-9_-]{43}$/);
    expect(first).not.toContain('user-a');
    expect(first).not.toContain(context.tenantId);
    expect(first).not.toContain(context.membershipId);
  });

  it('binds tokens to every authoritative user and context value', () => {
    const codec = createTenantSwitchTokenCodec(secret);
    const base = codec.createExpectedContextToken({ authenticatedUserId: 'user-a', context });
    const variants: ActiveTenantSessionContext[] = [
      { ...context, tenantId: 'internal-tenant-b' },
      { ...context, membershipId: 'internal-membership-b' },
      { ...context, selectedAt: 999 },
      { ...context, validatedAt: 999 },
    ];

    expect(codec.createExpectedContextToken({ authenticatedUserId: 'user-b', context })).not.toBe(base);
    for (const variant of variants) {
      expect(codec.createExpectedContextToken({ authenticatedUserId: 'user-a', context: variant })).not.toBe(base);
    }
    expect(context.contextVersion).toBe(1);
  });

  it('verifies valid tokens and fails closed for wrong or malformed tokens', () => {
    const codec = createTenantSwitchTokenCodec(secret);
    const input = { authenticatedUserId: 'user-a', context };
    const token = codec.createExpectedContextToken(input);

    expect(codec.verifyExpectedContextToken(token, input)).toBe(true);
    expect(codec.verifyExpectedContextToken(token, { ...input, authenticatedUserId: 'user-b' })).toBe(false);
    expect(codec.verifyExpectedContextToken('not-a-token', input)).toBe(false);
    expect(codec.verifyExpectedContextToken(undefined, input)).toBe(false);
  });

  it('uses the injected constant-time comparison path even for malformed input', () => {
    const compare = vi.fn((left: Uint8Array, right: Uint8Array) =>
      Buffer.from(left).equals(Buffer.from(right)),
    );
    const codec = createTenantSwitchTokenCodec(secret, compare);
    const input = { authenticatedUserId: 'user-a', context };

    expect(codec.verifyExpectedContextToken('malformed', input)).toBe(false);
    expect(compare).toHaveBeenCalledOnce();
    expect(compare.mock.calls[0][0]).toHaveLength(32);
    expect(compare.mock.calls[0][1]).toHaveLength(32);
  });

  it('does not grant ADMIN-shaped input any special behavior', () => {
    const codec = createTenantSwitchTokenCodec(secret);
    const token = codec.createExpectedContextToken({ authenticatedUserId: 'ADMIN', context });

    expect(codec.verifyExpectedContextToken(token, { authenticatedUserId: 'ADMIN', context })).toBe(true);
    expect(codec.verifyExpectedContextToken(token, { authenticatedUserId: 'user-a', context })).toBe(false);
  });

  it('locks attempt states and immutable event actions to the approved values', () => {
    expect(TENANT_SWITCH_ATTEMPT_STATES).toEqual(['PENDING', 'SWITCHED', 'REJECTED', 'FAILED']);
    expect(TENANT_SWITCH_AUDIT_ACTIONS).toEqual(['TENANT_CONTEXT_SWITCHED', 'TENANT_CONTEXT_REJECTED']);
    expect(Object.isFrozen(TENANT_SWITCH_ATTEMPT_STATES)).toBe(true);
    expect(Object.isFrozen(TENANT_SWITCH_AUDIT_ACTIONS)).toBe(true);
  });

  it('represents rejected targets only by safe deterministic metadata', () => {
    const codec = createTenantSwitchTokenCodec(secret);
    const raw = 'foreign-tenant-public-id';
    const first = codec.createRejectedTargetMetadata(raw, 'ORGANISATION_UNAVAILABLE');
    const second = codec.createRejectedTargetMetadata(raw, 'ORGANISATION_UNAVAILABLE');
    const oversized = codec.createRejectedTargetMetadata('x'.repeat(400), 'STALE_REQUEST');

    expect(first).toEqual(second);
    expect(first.fingerprint).not.toContain(raw);
    expect(JSON.stringify(first)).not.toContain(raw);
    expect(first.boundedInputLength).toBe(raw.length);
    expect(oversized.boundedInputLength).toBe(MAX_RECORDED_REJECTED_TARGET_LENGTH);
    expect(oversized.inputLengthCapped).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('creates domain-separated opaque request and session correlations', () => {
    const codec = createTenantSwitchTokenCodec(secret);
    const source = 'raw-session-or-request-value';
    const request = codec.createCorrelationHash('REQUEST', source);
    const requestAgain = codec.createCorrelationHash('REQUEST', source);
    const session = codec.createCorrelationHash('SESSION', source);

    expect(request).toBe(requestAgain);
    expect(request).not.toBe(session);
    expect(request).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(request).not.toContain(source);
  });

  it('has no runtime, database, routing, session-store, RBAC, or migration dependency', () => {
    const contractsSource = readFileSync(resolve('src/modules/tenancy/tenant-switch-contracts.ts'), 'utf8');
    const tokenSource = readFileSync(resolve('src/modules/tenancy/tenant-switch-token.ts'), 'utf8');
    const combined = `${contractsSource}\n${tokenSource}`;

    expect(combined).not.toMatch(/sequelize|postgres|\bpg\b|express|router|middleware|migration|session-store/i);
    expect(combined).not.toMatch(/user_roles|tenant_membership_roles|permissions|roles|ADMIN/);
    expect(combined).not.toMatch(/organisation\.routes|app\.use|activeTenantContext\s*=/);
    expect(tokenSource).toContain("timingSafeEqual");
  });
});
