import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitOperationalEvent } from './operational-event.js';

// A representative non-production alert receiver: a local in-memory collector of
// the operational-event JSON stream (the same surface a future System-Owner-
// controlled alert channel would consume). No production transport is implied.
function makeReceiver() {
  const received: unknown[] = [];
  const capture = (...args: unknown[]) => {
    for (const arg of args) received.push(JSON.parse(String(arg)));
  };
  return { received, capture };
}

describe('MP2-R4 item 21 — monitoring rehearsal (representative non-production receiver)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPERATIONAL_EVENT_HMAC_KEY;
  });

  it('delivers representative operational events to a local receiver with redaction intact over a bounded window', () => {
    process.env.OPERATIONAL_EVENT_HMAC_KEY = 'x'.repeat(32);
    const { received, capture } = makeReceiver();
    vi.spyOn(console, 'info').mockImplementation(capture);
    vi.spyOn(console, 'warn').mockImplementation(capture);
    vi.spyOn(console, 'error').mockImplementation(capture);

    const windowStart = Date.now();

    // Representative events through the existing observability mechanism:
    // (1) a tenant-context refusal carrying a tenant id that must be HMAC-aliased;
    // (2) a scheduler failure carrying a safe domain error code;
    // (3) an application failure carrying raw exception text that must be dropped.
    emitOperationalEvent({ code: 'TENANT_CONTEXT_REFUSED', severity: 'WARN', outcome: 'DENIED', operation: 'TENANT_CONTEXT', tenantId: 'tenant-secret-1234' });
    emitOperationalEvent({ code: 'SCHEDULER_RUN_FAILED', severity: 'ERROR', outcome: 'FAILED', operation: 'SB_SYNC_SCHEDULED', error: new Error('SB_SYNC_SCHEDULER_AUTHORITY_REQUIRED') });
    emitOperationalEvent({ code: 'APPLICATION_FAILURE', severity: 'ERROR', outcome: 'FAILED', operation: 'HTTP_REQUEST', error: new Error('password=secret connection jupiter_db SELECT * FROM tenants') });

    const windowEnd = Date.now();

    // Delivery: all three events reached the receiver.
    expect(received.length).toBe(3);
    const codes = received.map((e) => (e as { eventCode: string }).eventCode).sort();
    expect(codes).toEqual(['APPLICATION_FAILURE', 'SCHEDULER_RUN_FAILED', 'TENANT_CONTEXT_REFUSED']);

    // Severity/identity preserved.
    expect(received.find((e) => (e as { eventCode: string }).eventCode === 'TENANT_CONTEXT_REFUSED')).toMatchObject({ severity: 'WARN', outcome: 'DENIED' });
    expect(received.find((e) => (e as { eventCode: string }).eventCode === 'SCHEDULER_RUN_FAILED')).toMatchObject({ severity: 'ERROR', outcome: 'FAILED' });

    // Privacy-safe redaction: no raw tenant id, email, credential, token, SQL, or stack.
    const serialized = JSON.stringify(received);
    expect(serialized).not.toMatch(/tenant-secret|password|secret|jupiter_db|SELECT|FROM tenants|example\.test|token|stack/i);

    // Tenant id is HMAC-aliased, never raw.
    const tenantEvent = received.find((e) => (e as { eventCode: string }).eventCode === 'TENANT_CONTEXT_REFUSED') as { tenantAlias?: string; tenantId?: string };
    expect(tenantEvent.tenantAlias).toEqual(expect.any(String));
    expect(tenantEvent.tenantId).toBeUndefined();

    // Safe domain error code retained; raw exception text dropped.
    expect(received.find((e) => (e as { eventCode: string }).eventCode === 'SCHEDULER_RUN_FAILED')).toMatchObject({ errorCode: 'SB_SYNC_SCHEDULER_AUTHORITY_REQUIRED' });
    expect(received.find((e) => (e as { eventCode: string }).eventCode === 'APPLICATION_FAILURE')).not.toHaveProperty('errorCode');

    // Observation window recorded and bounded.
    const windowMs = windowEnd - windowStart;
    expect(windowMs).toBeGreaterThanOrEqual(0);
    expect(windowMs).toBeLessThan(60_000);
  });
});
