export const TENANT_LIFECYCLE_STATUSES = Object.freeze([
  'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED',
] as const);
export type TenantLifecycleStatus = typeof TENANT_LIFECYCLE_STATUSES[number];

export const TENANT_LIFECYCLE_TRANSITIONS = Object.freeze({
  TENANT_ACTIVATE: Object.freeze({ from: 'PROVISIONING', to: 'ACTIVE' }),
  TENANT_SUSPEND: Object.freeze({ from: 'ACTIVE', to: 'SUSPENDED' }),
  TENANT_REINSTATE: Object.freeze({ from: 'SUSPENDED', to: 'ACTIVE' }),
} as const);

export function assertTenantLifecycleTransition(from: string, to: string): void {
  const allowed = Object.values(TENANT_LIFECYCLE_TRANSITIONS).some(
    transition => transition.from === from && transition.to === to,
  );
  if (!allowed) throw new Error('TENANT_LIFECYCLE_TRANSITION_PROHIBITED');
}
