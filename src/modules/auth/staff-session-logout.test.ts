import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SessionData } from 'express-session';
import { describe, expect, it, vi } from 'vitest';
import {
  STAFF_LOGOUT_ERROR,
  terminateStaffSession,
  type StaffLogoutLifecycle,
} from './staff-session-logout.js';

function harness(initial: Record<string, unknown> = {}) {
  let session = initial as SessionData;
  const events: string[] = [];

  const lifecycle: StaffLogoutLifecycle = {
    getSession: vi.fn(() => session),
    logout: vi.fn(async () => {
      events.push('logout');
      session = {} as SessionData;
    }),
    destroy: vi.fn(async () => {
      events.push('destroy');
      session = {} as SessionData;
    }),
    save: vi.fn(async () => {
      events.push('save');
    }),
    clearRequestUser: vi.fn(() => {
      events.push('clear-user');
    }),
    clearSessionCookie: vi.fn(() => {
      events.push('clear-cookie');
    }),
  };

  return { lifecycle, events, session: () => session };
}

const completeCustomer = {
  id: 'customer-user-1',
  customer_id: 'customer-1',
  email: 'customer@example.test',
  display_name: 'Customer User',
};

describe('staff session logout helper', () => {
  it('destroys a session with no valid customer and clears its cookie in order', async () => {
    const h = harness({ passport: { user: 'staff-1' }, activeTenantContext: {} });

    await expect(terminateStaffSession(h.lifecycle, () => 10)).resolves.toBe('DESTROYED');

    expect(h.events).toEqual(['logout', 'destroy', 'clear-cookie']);
    expect(h.lifecycle.logout).toHaveBeenCalledWith({ keepSessionInfo: false });
    expect(h.session()).toEqual({});
  });

  it.each([
    undefined,
    null,
    {},
    { id: 'id', customer_id: 'customer', email: 'email' },
    { ...completeCustomer, id: 1 },
  ])('treats malformed customer state as no customer %#', async (customerUser) => {
    const h = harness({ customerUser });

    await expect(terminateStaffSession(h.lifecycle, () => 10)).resolves.toBe('DESTROYED');
    expect(h.lifecycle.destroy).toHaveBeenCalledOnce();
    expect(h.lifecycle.clearSessionCookie).toHaveBeenCalledOnce();
  });

  it('preserves a fresh four-field customer snapshot and fresh activity only', async () => {
    const originalCustomer = { ...completeCustomer, elevated: true };
    const h = harness({
      customerUser: originalCustomer,
      passport: { user: 'staff-1' },
      activeTenantContext: { tenantId: 'tenant-1' },
      adImportState: { token: 'ad' },
      sbImportState: { token: 'sb' },
      standardTaskImportState: { token: 'task' },
      piperModelMasterImportState: { token: 'piper' },
      unmatchedModels: ['model'],
      flash: { error: ['old'] },
      _csrf: 'old-csrf',
      lastActivity: 1,
      unknownState: true,
    });

    await expect(terminateStaffSession(h.lifecycle, () => 9876)).resolves.toBe(
      'CUSTOMER_PRESERVED',
    );

    expect(h.session()).toEqual({ customerUser: completeCustomer, lastActivity: 9876 });
    expect(h.session().customerUser).not.toBe(originalCustomer);
    expect(h.events).toEqual(['logout', 'save']);
    expect(h.lifecycle.logout).toHaveBeenCalledWith({ keepSessionInfo: false });
    expect(h.lifecycle.destroy).not.toHaveBeenCalled();
    expect(h.lifecycle.clearSessionCookie).not.toHaveBeenCalled();
  });

  it('orders customer restoration and the injected clock between logout and save', async () => {
    const h = harness({ customerUser: completeCustomer });
    vi.mocked(h.lifecycle.getSession).mockImplementation(() => {
      if (h.events.at(-1) === 'logout') h.events.push('restore-access');
      return h.session();
    });
    const now = vi.fn(() => {
      h.events.push('clock');
      return 50;
    });

    await terminateStaffSession(h.lifecycle, now);

    expect(h.events).toEqual(['logout', 'restore-access', 'clock', 'save']);
  });

  it.each(['logout', 'destroy', 'save', 'clearSessionCookie'] as const)(
    'contains a %s failure and never returns success',
    async (failurePoint) => {
      const initial = failurePoint === 'save' ? { customerUser: completeCustomer } : {};
      const h = harness(initial);
      if (failurePoint === 'clearSessionCookie') {
        vi.mocked(h.lifecycle.clearSessionCookie).mockImplementationOnce(() => {
          throw new Error('raw cookie detail');
        });
      } else {
        vi.mocked(h.lifecycle[failurePoint]).mockRejectedValueOnce(
          new Error('raw lifecycle detail'),
        );
      }

      await expect(terminateStaffSession(h.lifecycle, () => 10)).rejects.toThrow(
        STAFF_LOGOUT_ERROR,
      );

      expect(h.lifecycle.clearRequestUser).toHaveBeenCalledOnce();
      expect(h.lifecycle.destroy).toHaveBeenCalled();
      expect(h.lifecycle.clearSessionCookie).toHaveBeenCalled();
    },
  );

  it('remains a stable failure when every containment operation fails', async () => {
    const h = harness({ customerUser: completeCustomer });
    vi.mocked(h.lifecycle.logout).mockRejectedValueOnce(new Error('logout secret'));
    vi.mocked(h.lifecycle.clearRequestUser).mockImplementationOnce(() => {
      throw new Error('user cleanup secret');
    });
    vi.mocked(h.lifecycle.destroy).mockRejectedValueOnce(new Error('destroy secret'));
    vi.mocked(h.lifecycle.clearSessionCookie).mockImplementationOnce(() => {
      throw new Error('cookie secret');
    });

    await expect(terminateStaffSession(h.lifecycle, () => 10)).rejects.toThrow(
      STAFF_LOGOUT_ERROR,
    );
  });

  it('integrates only the staff logout route and preserves its external responses', () => {
    const routes = readFileSync(
      resolve(process.cwd(), 'src/modules/auth/auth.routes.ts'),
      'utf8',
    );
    const customerRoutes = readFileSync(
      resolve(process.cwd(), 'src/modules/customer-auth/customer-auth.routes.ts'),
      'utf8',
    );

    expect(routes).toMatch(/router\.post\('\/logout'[\s\S]*terminateStaffSession/);
    expect(routes).toContain("res.status(200).json({ success: true })");
    expect(routes).toContain("res.redirect('/auth/login')");
    expect(customerRoutes).not.toMatch(/terminateStaffSession|StaffLogoutLifecycle/);
  });

  it('has no database, tenant authority, membership, or RBAC dependency', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/auth/staff-session-logout.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/sequelize|postgres|database|TenantMembership|user_roles/i);
    expect(source).not.toMatch(/requireRole|requirePermission|Router|app\.use/);
    expect(source).not.toMatch(/activeTenantContext\s*=/);
  });
});
