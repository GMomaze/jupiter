import type { SessionData } from 'express-session';
import { sanitizeCustomerUser } from './staff-session-regeneration.js';

export interface StaffLogoutLifecycle {
  getSession(): SessionData;
  logout(options: { keepSessionInfo: false }): Promise<void>;
  destroy(): Promise<void>;
  save(): Promise<void>;
  clearRequestUser(): void;
  clearSessionCookie(): void;
}

export type StaffLogoutResult = 'DESTROYED' | 'CUSTOMER_PRESERVED';

export const STAFF_LOGOUT_ERROR = 'Staff logout failed.';

function clearInMemoryStaffState(lifecycle: StaffLogoutLifecycle): void {
  try {
    lifecycle.clearRequestUser();
  } catch {
    // Continue clearing session state and containing the failed logout.
  }

  try {
    const session = lifecycle.getSession() as SessionData & {
      passport?: unknown;
    };
    delete session.passport;
    delete session.activeTenantContext;
  } catch {
    // The containment path still attempts store invalidation and cookie clearing.
  }
}

async function containFailure(lifecycle: StaffLogoutLifecycle): Promise<never> {
  clearInMemoryStaffState(lifecycle);

  try {
    await lifecycle.destroy();
  } catch {
    // A cleanup failure must never convert the logout failure into success.
  }

  try {
    lifecycle.clearSessionCookie();
  } catch {
    // Preserve the stable failed outcome if response cookie cleanup also fails.
  }

  throw new Error(STAFF_LOGOUT_ERROR);
}

export async function terminateStaffSession(
  lifecycle: StaffLogoutLifecycle,
  now: () => number,
): Promise<StaffLogoutResult> {
  try {
    const customerUser = sanitizeCustomerUser(lifecycle.getSession());

    await lifecycle.logout({ keepSessionInfo: false });

    if (!customerUser) {
      await lifecycle.destroy();
      lifecycle.clearSessionCookie();
      return 'DESTROYED';
    }

    const session = lifecycle.getSession();
    session.customerUser = customerUser;
    session.lastActivity = now();
    await lifecycle.save();

    return 'CUSTOMER_PRESERVED';
  } catch {
    return containFailure(lifecycle);
  }
}
