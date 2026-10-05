import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActiveTenantContextMiddleware } from '../tenancy/active-tenant-context.middleware.js';
import { ServiceBulletinSyncService } from '../service-bulletins/service-bulletin-sync.service.js';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';

describe('MP2 2J.4 focused verification — alert emission', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete process.env.OPERATIONAL_EVENT_HMAC_KEY;
    delete process.env.SB_SYNC_CRON_ENABLED;
    delete process.env.SB_SYNC_RUN_ON_BOOT;
    delete process.env.SB_SYNC_SERVICE_CODE;
  });

  it('A: tenant-context rejection emits TENANT_CONTEXT_REFUSED with privacy-safe alias and no leakage', async () => {
    process.env.OPERATIONAL_EVENT_HMAC_KEY = 'x'.repeat(32);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const revalidateStoredContext = vi.fn().mockResolvedValue({ state: 'SUSPENDED_TENANT' });
    const middleware = createActiveTenantContextMiddleware({ revalidateStoredContext } as never);

    const stored = {
      tenantId: 'tenant-secret-1234',
      membershipId: 'membership-1',
      contextVersion: 1 as const,
      selectedAt: 10,
      validatedAt: 11,
    };
    const session = {
      activeTenantContext: stored,
      save: (cb: (e?: unknown) => void) => cb(),
    };
    const req = {
      session,
      user: { id: 'user-1@example.test' },
      isAuthenticated: () => true,
    } as never;
    const res = {} as never;
    const next = vi.fn();

    await middleware.resolveTenantContext(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as unknown as { session: { activeTenantContext?: unknown } }).session.activeTenantContext).toBeUndefined();
    const hit = warn.mock.calls.map((c) => String(c[0])).find((s) => s.includes('TENANT_CONTEXT_REFUSED'));
    expect(hit).toBeTruthy();
    const event = JSON.parse(hit as string);
    expect(event).toMatchObject({ eventCode: 'TENANT_CONTEXT_REFUSED', severity: 'WARN', outcome: 'DENIED' });
    expect(event.tenantAlias).toEqual(expect.any(String));
    expect(event.tenantId).toBeUndefined();
    expect(hit).not.toMatch(/tenant-secret|user-1|example\.test|password|token|stack|SELECT|INSERT|FROM|WHERE|sql/i);
  });

  it('B: scheduled run that cannot resolve SERVICE authority emits SCHEDULER_RUN_FAILED with no leakage', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    process.env.SB_SYNC_CRON_ENABLED = 'true';
    process.env.SB_SYNC_RUN_ON_BOOT = 'true';
    process.env.SB_SYNC_SERVICE_CODE = 'SB_SYNC_SCHEDULER';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    const validAuthority = {
      principalType: 'SERVICE',
      principalId: 'p',
      principalCode: 'SB_SYNC_SCHEDULER',
      capabilities: new Set(['SERVICE_BULLETIN_SYNC_EXECUTE']),
    } as never;
    vi.spyOn(PlatformAuthorityRepository.prototype, 'resolveService')
      .mockResolvedValueOnce(validAuthority)
      .mockResolvedValueOnce(null as never);
    vi.spyOn(PlatformAuthorityRepository.prototype, 'authorizeCapability').mockResolvedValue(undefined as never);

    vi.useFakeTimers();
    try {
      const started = ServiceBulletinSyncService.startCronJob();
      await started;
      await vi.advanceTimersByTimeAsync(1100);
    } finally {
      process.env.NODE_ENV = origEnv;
    }

    const hit = err.mock.calls.map((c) => String(c[0])).find((s) => s.includes('SCHEDULER_RUN_FAILED'));
    expect(hit).toBeTruthy();
    const event = JSON.parse(hit as string);
    expect(event).toMatchObject({ eventCode: 'SCHEDULER_RUN_FAILED', severity: 'ERROR', outcome: 'FAILED' });
    expect(hit).not.toMatch(/password|secret|token|SELECT|INSERT|FROM|WHERE|sql|stack|example\.test/i);
  });
});
