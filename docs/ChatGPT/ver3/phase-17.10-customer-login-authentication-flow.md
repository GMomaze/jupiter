# Phase 17.10 - Customer Login Authentication Flow

## Status

DEFINE ONLY

This phase defines how ACTIVE customer users will later authenticate into Jupiter.

This phase does not implement code, does not change schema, does not change migrations, does not implement authentication, does not implement portal UI, does not implement permissions, and does not refactor existing behavior.

## Purpose

The purpose of this phase is to define the later authentication flow for customer login identities.

Jupiter must authenticate customer-facing access through `CustomerUser` identities, not through `Customer` business-entity records.

This phase defines authentication-flow behavior only.

It does not implement login mechanics.

## Scope

This phase defines:

- email/password login flow
- `CustomerUser` `ACTIVE` status requirement
- `DISABLED` account behavior
- password-verification direction
- session-creation direction
- customer-session isolation from staff sessions
- logout behavior
- failed-login behavior
- `last_login_at` behavior
- audit and security expectations
- verification requirements
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.10:

- code changes
- schema changes
- migration changes
- authentication implementation
- portal dashboard implementation
- workpack visibility implementation
- permissions implementation
- password-reset implementation
- invite-flow implementation
- session middleware implementation
- route implementation

This phase defines authentication-flow behavior only.

## Email / Password Login Flow

Customer authentication should later use an email-and-password login flow tied to `CustomerUser`.

### Login Identity Boundary

The login identity is `CustomerUser`.

The login identity is not `Customer`.

### Login Input Direction

The later login flow should require:

- customer-user email
- customer-user password

### Authentication Resolution

The later system should resolve login attempts by looking up the `CustomerUser` identity by email and then applying status and password-verification rules.

## CustomerUser `ACTIVE` Status Requirement

Only `ACTIVE` customer users may successfully authenticate.

### Active Requirement

A customer user must be in `ACTIVE` status before normal login may succeed.

### INVITED Is Not Login-Ready

A customer user in `INVITED` status must not be treated as ready for standard login until invite completion has occurred.

### Status Before Session

Status validation must occur before any authenticated customer session is established.

## `DISABLED` Account Behavior

`DISABLED` customer users must not be allowed to log in.

### Disabled Login Denial

If a customer user is `DISABLED`, the login attempt must fail.

### No Session Creation For Disabled Users

No authenticated customer session may be created for a `DISABLED` user.

### Identity Still Preserved

`DISABLED` status does not remove the identity record.

It only blocks authentication use.

## Password Verification Direction

Password verification must later be performed against stored password hashes only.

### Hash Verification Only

The later system must verify the submitted password against `customer_users.password_hash`.

### No Plaintext Password Storage

Plaintext passwords must never be stored.

### Customer Boundary

Password material belongs only to `CustomerUser`.

It must never be stored on `Customer`.

## Session Creation Direction

Successful authentication should later result in a customer-scoped authenticated session.

### Session Creation Preconditions

A customer session should only be created after:

- customer-user identity lookup succeeds
- `ACTIVE` status is confirmed
- password verification succeeds

### Session Meaning

The later authenticated session represents a signed-in `CustomerUser`, not a `Customer` business entity directly.

### No Visibility Expansion By Login Alone

Creating a customer session does not by itself grant arbitrary data visibility.

Customer visibility must still later derive from customer-aircraft relationships and customer-safe visibility rules.

## Customer Session Isolation From Staff Sessions

Customer sessions must remain isolated from internal staff sessions.

### Separate Identity Context

Customer login state must later be distinguishable from internal operational staff login state.

### No Implicit Shared Session Assumption

The system must not assume customer users share the same session scope, role behavior, or operational context as internal users.

### Leakage Prevention

Customer session isolation must help prevent:

- internal audit leakage
- planning leakage
- execution-control leakage
- cross-context privilege confusion

## Logout Behavior

Authenticated customer users must later be able to log out cleanly.

### Logout Direction

Logout should later invalidate or clear the active customer session.

### Post-Logout Effect

After logout, the user must no longer be treated as authenticated until a new successful login occurs.

## Failed Login Behavior

Failed authentication attempts must not create a customer session.

### Failure Conditions

Login must fail when:

- the email does not resolve to a valid customer user
- the password is incorrect
- the account is not `ACTIVE`
- the account is `DISABLED`

### Failure Safety Direction

Failed login behavior must avoid leaking unnecessary identity-state details that could expose sensitive internal information.

## `last_login_at` Behavior

The `last_login_at` field should later track successful authentication only.

### Successful Login Update

`last_login_at` should later update when a customer user successfully authenticates.

### No Update On Failure

Failed login attempts must not update `last_login_at`.

### Audit Relationship

`last_login_at` is operational login metadata and does not replace full audit logging.

## Audit / Security Expectations

Customer authentication is a security-relevant activity and must remain auditable and safe.

### Audit Expectations

The later system must audit or security-log as appropriate:

- successful authentication
- failed authentication where policy requires
- logout events where policy requires
- status-based login denial events where policy requires

### No Leakage

Customer authentication must not expose:

- internal audit detail
- planning detail
- execution-control detail
- plaintext passwords

### Security Expectations

The authentication architecture must preserve:

- customer-user identity as the login boundary
- `ACTIVE`-only login success
- `DISABLED` login denial
- session isolation from staff sessions
- no cross-customer visibility leakage

## Locked Authentication Constraints

The following constraints are explicitly preserved:

- `CustomerUser` is the login identity
- `Customer` is not the login identity
- only `ACTIVE` `CustomerUser` records may log in
- `DISABLED` users must not log in
- no portal dashboard in this phase
- no workpack visibility implementation in this phase
- no permission implementation in this phase
- no plaintext passwords
- no audit leakage
- no planning leakage
- no execution-control leakage

## Verification Requirements

Phase 17.10 is correctly defined only if all of the following are true:

- email/password login flow is defined
- `CustomerUser` `ACTIVE` status requirement is defined
- `DISABLED` account behavior is defined
- password-verification direction is defined
- session-creation direction is defined
- customer-session isolation from staff sessions is defined
- logout behavior is defined
- failed-login behavior is defined
- `last_login_at` behavior is defined
- audit and security expectations are defined
- `CustomerUser` is explicitly preserved as the login identity
- `Customer` is explicitly preserved as not being the login identity
- no portal dashboard is introduced
- no workpack visibility implementation is introduced
- no permissions implementation is introduced
- no plaintext-password storage is allowed
- no audit, planning, or execution-control leakage is allowed

## Completion Criteria

Phase 17.10 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- email/password login flow is defined
- `ACTIVE` status login requirement is defined
- `DISABLED` account behavior is defined
- password-verification direction is defined
- session-creation direction is defined
- customer-session isolation is defined
- logout behavior is defined
- failed-login behavior is defined
- `last_login_at` behavior is defined
- audit/security expectations are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no authentication implementation was performed
- no portal UI implementation was performed
- no permissions implementation was performed

## Final Statement

Phase 17.10 defines Jupiter’s future customer authentication flow around `CustomerUser` email-and-password login, requiring `ACTIVE` status, denying `DISABLED` identities, verifying passwords only against stored hashes, creating isolated customer sessions separate from staff sessions, updating `last_login_at` only on successful login, and explicitly forbidding portal dashboard behavior, workpack visibility behavior, permissions implementation, plaintext passwords, and any audit, planning, or execution-control leakage in this phase.
