# Phase 13.4 - Customer Verification

## Status

DEFINE ONLY

This phase defines customer access verification for Jupiter.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, compliance, audit, planning, or lifecycle behavior established in other phases.

## Purpose

The purpose of this phase is to define how the system verifies customer access before any customer-visible data is returned.

Customer verification is an access-control concern only.

It ensures that customer visibility remains limited to the correct customer-owned scope.

## Access Validation

The following access validation is required:

- every request must verify customer identity
- must verify aircraft ownership before data access

### Verify Customer Identity

Every customer-facing request must validate the identity of the requesting customer before any protected data is returned.

Unauthenticated or invalid customer identity must not be treated as trusted.

### Verify Aircraft Ownership

Before returning aircraft, workpack, task status, snag, compliance, or related customer-visible data, the system must verify that the requested aircraft belongs to the authenticated customer.

If ownership is not verified, access must be denied.

## Isolation

The following isolation rules are required:

- no access via direct URL or ID guessing
- no cross-customer queries

### No Access Via Direct URL Or ID Guessing

The system must not allow customer access to protected data by directly entering URLs, changing IDs, guessing identifiers, or altering request paths or parameters.

Customer scope must be enforced independently of whether the request path appears valid.

### No Cross-Customer Queries

The system must not allow any customer request path, query, filter, or lookup to return data belonging to another customer.

All query behavior must remain restricted to the authenticated customer scope.

## Enforcement

The following enforcement rules are required:

- server-side validation only
- reject unauthorized requests

### Server-Side Validation Only

Customer verification must be enforced on the server side.

Client-side logic, hidden UI elements, or browser-side filtering are not sufficient for access control.

### Reject Unauthorized Requests

If customer identity is invalid, aircraft ownership does not match, or requested data falls outside customer scope, the request must be rejected.

The system must not return partial protected data in such cases.

## Invariants

The following invariants are locked:

- no data leakage
- no bypass paths

### No Data Leakage

Customer verification must prevent any protected operational or internal data from being exposed outside the authenticated customer scope.

### No Bypass Paths

There must be no alternate request path, direct object access path, guessed identifier path, or secondary query path that bypasses customer verification rules.

## Boundary

This phase defines customer verification only.

It does not define:

- schema changes
- lifecycle changes
- execution behavior
- audit redesign
- pricing workflows

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 13.4 defines Jupiter customer verification as a strict server-side access-control rule where every request must validate customer identity and aircraft ownership before data access, direct URL or identifier guessing must not bypass scope checks, cross-customer queries must be blocked, unauthorized requests must be rejected, and no data leakage or bypass path is permitted.
