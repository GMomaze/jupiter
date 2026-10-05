# Staff Offboarding and Company Administrator Recovery Runbook

## Purpose

Disable or reinstate one tenant membership while preserving global identity,
peer-tenant access, and historical attribution; recover Company Administrator
authority through the guarded platform operation when necessary.

## Preconditions

- Select the correct active tenant and target user UUID independently.
- Confirm the actor is an active ADMIN of that tenant and record a non-empty
  reason and correlation identifier.
- Review the target's other tenant memberships; they are out of scope and must
  remain unchanged.

## Authority required

Tenant membership disable/reinstate requires the authenticated tenant's active
Company Administrator authority. Administrator recovery requires a fresh
repository-issued HUMAN platform principal with `TENANT_ADMIN_RECOVER`.

## Procedure

1. Offboard with `POST /auth/staff/<user-id>/disable`, supplying `reason`.
2. Confirm response status `DISABLED` and loss of authority only in the selected
   tenant.
3. Reinstate with `POST /auth/staff/<user-id>/reinstate`, supplying `reason`;
   confirm status `ACTIVE`.
4. If no usable Company Administrator remains, an authorized HUMAN submits
   `POST /platform/tenants/<tenant-public-id>/admin-recovery` with `userId` and
   `reason`.

## Expected result

Disable/reinstate changes only the selected tenant membership. The global user,
historical attribution, and peer-tenant memberships are preserved. Recovery
requires an existing active global user; it creates or reactivates that tenant
membership, ensures one active ADMIN assignment, and writes both immutable
platform and `TENANT_ADMIN_RECOVERED` membership-authority audit evidence.

## Refusal / stop conditions

Stop on missing/stale tenant authority, cross-tenant target, missing reason,
wrong membership state, inactive recovery user, missing ADMIN role, wrong HUMAN
capability, unknown tenant, or generic unavailable response.

## Verification

Confirm the membership state and that other tenant memberships are unchanged.
Confirm `MEMBERSHIP_DISABLED` or `MEMBERSHIP_REINSTATED` evidence and, for
recovery, `TENANT_ADMIN_RECOVERED` plus the platform audit action. Confirm the
recovered administrator remains tenant-scoped and has no platform authority.

## Recovery / failure handling

Operations roll back on failure. Preserve correlation and error evidence and
escalate; never edit membership or role tables directly. There is currently no
mounted operator view for `tenant_membership_authority_audit`, so audit-row
inspection requires a separately approved evidence mechanism.

## Deferred last-ADMIN control

Database/application last-active-ADMIN continuity enforcement is **not active**.
Before disabling an ADMIN, the operator must independently confirm another
active ADMIN remains for that tenant. If this cannot be proven, stop. Use the
guarded `TENANT_ADMIN_RECOVER` operation if continuity has already been lost.

