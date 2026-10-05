import type { SessionData } from 'express-session';

type PreservedCustomerUser = NonNullable<SessionData['customerUser']>;

export interface StaffSessionLifecycle<TUser = unknown> {
  getSession(): SessionData;
  regenerate(): Promise<void>;
  login(user: TUser, options: { keepSessionInfo: true }): Promise<void>;
  save(): Promise<void>;
  invalidate(): Promise<void>;
  clearRequestUser(): void;
}

export const STAFF_SESSION_ESTABLISHMENT_ERROR =
  'Staff session establishment failed.';

export function sanitizeCustomerUser(
  session: SessionData,
): PreservedCustomerUser | undefined {
  const candidate: unknown = session.customerUser;

  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }

  const value = candidate as Record<string, unknown>;
  if (
    typeof value.id !== 'string' ||
    typeof value.customer_id !== 'string' ||
    typeof value.email !== 'string' ||
    typeof value.display_name !== 'string'
  ) {
    return undefined;
  }

  return {
    id: value.id,
    customer_id: value.customer_id,
    email: value.email,
    display_name: value.display_name,
  };
}

async function failClosed<TUser>(lifecycle: StaffSessionLifecycle<TUser>): Promise<never> {
  try {
    lifecycle.clearRequestUser();
  } catch {
    // Continue with session invalidation even if in-memory cleanup fails.
  }

  try {
    await lifecycle.invalidate();
  } catch {
    // Cleanup failure must never convert the authentication failure into success.
  }

  throw new Error(STAFF_SESSION_ESTABLISHMENT_ERROR);
}

export async function establishStaffSession<TUser>(
  lifecycle: StaffSessionLifecycle<TUser>,
  user: TUser,
  now: () => number,
): Promise<void> {
  try {
    const customerUser = sanitizeCustomerUser(lifecycle.getSession());

    await lifecycle.regenerate();

    if (customerUser) {
      lifecycle.getSession().customerUser = customerUser;
    }

    await lifecycle.login(user, { keepSessionInfo: true });

    lifecycle.getSession().lastActivity = now();
    await lifecycle.save();
  } catch {
    await failClosed(lifecycle);
  }
}
