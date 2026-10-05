# Tenant Suspension and Reinstatement Runbook

## Purpose

Fail closed one active tenant without deleting its identity or data, and later
restore that same tenant.

## Preconditions

- Identify the tenant by its exact public UUID; independently confirm the
  intended company and current `ACTIVE` status.
- Record the approved suspension reason and correlation identifier.
- Notify the operational owner without exposing tenant data.

## Authority required

Only a repository-issued HUMAN principal with fresh `TENANT_SUSPEND` may
suspend. Reinstatement requires fresh HUMAN `TENANT_REINSTATE`. Tenant ADMIN,
staff, customer, and SERVICE identities cannot perform either operation.

## Procedure

1. Submit authenticated, CSRF-protected `POST
   /platform/tenants/<tenant-public-id>/suspend` with the non-empty `reason`.
2. Require status `SUSPENDED`; stop if the response is generic conflict.
3. Verify the effects below before declaring containment.
4. When approved for restoration, submit `POST
   /platform/tenants/<tenant-public-id>/reinstate` with a non-empty `reason`.
5. Require the same tenant public ID and status `ACTIVE`.

## Expected result

Suspension is atomic and immediately denies staff and tenant ADMIN active-tenant
authority, invalidates stale selected-tenant use, denies Customer Portal access,
and prevents tenant-owned file delivery. Peer tenants remain unaffected. The
tenant row, memberships, records, and files are preserved. Reinstatement
restores eligibility for the same tenant identity and preserved memberships;
normal authorization checks still apply.

## Refusal / stop conditions

Stop on wrong/missing HUMAN authority, missing reason, unknown public ID,
non-`ACTIVE` suspension target, non-`SUSPENDED` reinstatement target, lock or
audit failure, or any peer-tenant effect. Never delete or edit tenant data.

## Verification

Confirm the lifecycle action in immutable platform audit at `GET /platform`.
Using approved non-destructive checks, confirm staff/ADMIN, stale session,
Customer Portal, and tenant-file requests fail closed while suspended; confirm
an unaffected peer tenant still works. After reinstatement, confirm the same
tenant ID, memberships, representative records, and file references return
under their ordinary authorization boundaries.

## Recovery / failure handling

Failed lifecycle commands roll back atomically. Preserve the generic response,
correlation ID, and platform audit evidence, then escalate. If verification is
mixed, treat the tenant as unavailable and do not retry or bypass middleware
until the state and lifecycle lock are reconciled.

