import { describe, expect, it, vi } from 'vitest';
import type { SessionData } from 'express-session';
import {
  establishStaffSession,
  STAFF_SESSION_ESTABLISHMENT_ERROR,
  type StaffSessionLifecycle,
} from './staff-session-regeneration.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type TestUser = { id: string };

function harness(initial: Record<string, unknown> = {}) {
  let session = initial as SessionData;
  const events: string[] = [];

  const lifecycle: StaffSessionLifecycle<TestUser> = {
    getSession: vi.fn(() => session),
    regenerate: vi.fn(async () => {
      events.push('regenerate');
      session = {} as SessionData;
    }),
    login: vi.fn(async () => {
      events.push('login');
    }),
    save: vi.fn(async () => {
      events.push('save');
    }),
    invalidate: vi.fn(async () => {
      events.push('invalidate');
      session = {} as SessionData;
    }),
    clearRequestUser: vi.fn(() => {
      events.push('clear-user');
    }),
  };

  return { lifecycle, events, session: () => session };
}

describe('staff session regeneration helper', () => {
  it('preserves only a freshly reconstructed complete customer identity', async () => {
    const customerUser = {
      id: 'customer-user-1',
      customer_id: 'customer-1',
      email: 'customer@example.test',
      display_name: 'Customer User',
      elevated: true,
    };
    const h = harness({
      customerUser,
      passport: { user: 'old-staff' },
      activeTenantContext: { tenantId: 'old-tenant' },
      adImportState: { token: 'ad' },
      sbImportState: { token: 'sb' },
      standardTaskImportState: { token: 'task' },
      piperModelMasterImportState: { token: 'piper' },
      unmatchedModels: ['old'],
      flash: { error: ['old'] },
      _csrf: 'old-secret',
      lastActivity: 1,
      unknownState: true,
    });

    await establishStaffSession(h.lifecycle, { id: 'staff-1' }, () => 12345);

    expect(h.session()).toEqual({
      customerUser: {
        id: 'customer-user-1',
        customer_id: 'customer-1',
        email: 'customer@example.test',
        display_name: 'Customer User',
      },
      lastActivity: 12345,
    });
    expect(h.session().customerUser).not.toBe(customerUser);
    expect(h.events).toEqual(['regenerate', 'login', 'save']);
    expect(h.lifecycle.login).toHaveBeenCalledWith(
      { id: 'staff-1' },
      { keepSessionInfo: true },
    );
  });

  it.each([
    undefined,
    null,
    {},
    { id: 'id', customer_id: 'customer', email: 'email' },
    { id: 1, customer_id: 'customer', email: 'email', display_name: 'name' },
  ])('does not preserve malformed customer state %#', async (customerUser) => {
    const h = harness({ customerUser, activeTenantContext: { tenantId: 'old' } });

    await establishStaffSession(h.lifecycle, { id: 'staff-1' }, () => 5);

    expect(h.session()).toEqual({ lastActivity: 5 });
  });

  it('orders regeneration before login and makes save the last success step', async () => {
    const h = harness();
    const now = vi.fn(() => {
      h.events.push('clock');
      return 99;
    });

    await establishStaffSession(h.lifecycle, { id: 'staff-1' }, now);

    expect(h.events).toEqual(['regenerate', 'login', 'clock', 'save']);
    expect(h.session().lastActivity).toBe(99);
  });

  it.each(['regenerate', 'login', 'save'] as const)(
    'fails closed when %s fails',
    async (failurePoint) => {
      const h = harness({ customerUser: {
        id: 'customer-user-1',
        customer_id: 'customer-1',
        email: 'customer@example.test',
        display_name: 'Customer User',
      } });
      vi.mocked(h.lifecycle[failurePoint]).mockRejectedValueOnce(new Error('sensitive detail'));

      await expect(
        establishStaffSession(h.lifecycle, { id: 'staff-1' }, () => 10),
      ).rejects.toThrow(STAFF_SESSION_ESTABLISHMENT_ERROR);

      expect(h.lifecycle.clearRequestUser).toHaveBeenCalledOnce();
      expect(h.lifecycle.invalidate).toHaveBeenCalledOnce();
      if (failurePoint === 'regenerate') {
        expect(h.lifecycle.login).not.toHaveBeenCalled();
        expect(h.lifecycle.save).not.toHaveBeenCalled();
      } else if (failurePoint === 'login') {
        expect(h.lifecycle.save).not.toHaveBeenCalled();
      }
    },
  );

  it('remains failed when invalidation also fails', async () => {
    const h = harness();
    vi.mocked(h.lifecycle.save).mockRejectedValueOnce(new Error('save detail'));
    vi.mocked(h.lifecycle.invalidate).mockRejectedValueOnce(new Error('cleanup detail'));

    await expect(
      establishStaffSession(h.lifecycle, { id: 'staff-1' }, () => 10),
    ).rejects.toThrow(STAFF_SESSION_ESTABLISHMENT_ERROR);
  });

  it('keeps the helper isolated while login delegates to verified orchestration', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/auth/staff-session-regeneration.ts'),
      'utf8',
    );
    const routes = readFileSync(
      resolve(process.cwd(), 'src/modules/auth/auth.routes.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/sequelize|postgres|database|TenantMembership|user_roles|requireRole|requirePermission/i);
    expect(source).not.toMatch(/Router|router\.|app\.use|activeTenantContext\s*=/);
    expect(routes).toMatch(/orchestrateStaffLoginOrganisation/);
    expect(routes).not.toMatch(
      /TenantMembership|user_roles|requireRole|requirePermission/,
    );
  });
});
