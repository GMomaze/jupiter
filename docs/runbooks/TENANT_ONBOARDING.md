# Tenant Onboarding Runbook

## Purpose

Provision and activate an independent Jupiter company/tenant with a nominated
initial Company Administrator, then hand tenant-local staff administration to
that administrator.

## Preconditions

- The company code, display name, and optional legal name are approved. No
  additional business fields are defined by this operation.
- The nominated initial administrator already has an active global Jupiter user
  identity; record its UUID. This procedure does not create that identity.
- Confirm the normalized company code is unique and uses uppercase letters,
  digits, and internal underscores only (maximum 50 characters).
- Record a non-empty reason and correlation identifier for each operation.

## Authority required

Provision requires a fresh repository-issued HUMAN `TENANT_PROVISION`
authority. Activation separately requires HUMAN `TENANT_ACTIVATE`. A tenant
ADMIN cannot invoke either route and cannot acquire platform authority through
tenant membership.

## Procedure

1. Through an authenticated, CSRF-protected platform session, submit `POST
   /platform/tenants` with `code`, `displayName`, optional `legalName`,
   `initialUserId`, and `reason`.
2. From the response, record the returned `publicId` and confirm only the
   returned tenant identity and status `PROVISIONING`. At this point the System
   Owner cannot inspect the initial membership/role through `/platform`, and
   the nominated administrator must not attempt tenant-context access because
   `PROVISIONING` tenants are refused.
3. At `GET /platform`, confirm the successful tenant-provision platform audit
   action. Do not treat this bounded audit view as a membership/role inspection
   surface.
4. Submit `POST /platform/tenants/<tenant-public-id>/activate` with a non-empty
   `reason` using HUMAN `TENANT_ACTIVATE` authority.
5. Confirm the response has the same `publicId` and status `ACTIVE`. Successful
   activation confirms that the repository found an active ADMIN membership;
   activation refuses otherwise.
6. Only after activation, have the nominated administrator authenticate, select
   the active company, and open `GET /auth/staff`. Successful access confirms
   current active-tenant context and ADMIN authorization. The Company
   Administrator may then use `POST /auth/staff/toggle-role` and the membership
   routes documented in the staff offboarding runbook for that company only.

## Expected result

Provisioning atomically creates the tenant in `PROVISIONING`, one active
membership for the existing nominated user, its ADMIN role, and immutable
platform audit. Activation succeeds only when an active ADMIN exists and adds
its own immutable audit evidence.

## Refusal / stop conditions

Stop on invalid/duplicate code, missing or inactive initial user, missing ADMIN
role, invalid fields, stale/wrong HUMAN capability, wrong lifecycle state,
missing reason, or generic conflict. The transaction rolls back failed
provisioning/activation. Never substitute a tenant ADMIN for platform authority.

## Verification

Before activation, verify only the returned tenant identity/status and the
provision platform-audit action; no supported mounted membership/role
inspection exists. After activation, confirm its platform-audit action and the
nominated administrator's access to `GET /auth/staff` in that selected company.
Confirm the administrator can act only within that tenant and receives a
platform-authority refusal for `/platform` and tenant-creation operations.

## Recovery / failure handling

Leave a successfully created `PROVISIONING` tenant intact while resolving an
activation failure; do not create a duplicate. There is no delete/rollback
operation. If the nominated administrator requires recovery, use the separate
admin-recovery runbook path.

## Recorded invitation gap

`POST /auth/staff/invite` and `POST /auth/staff-invitations/accept` exist, but
the mounted application currently uses `NullStaffInvitationDelivery`; the
one-time token is not delivered. Stop real invitation/acceptance onboarding
until an approved delivery mechanism exists. Do not extract token hashes or
invent a manual token procedure.
