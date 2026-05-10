# Phase 17.11 - Customer Login Authentication Implementation

## Status

IMPLEMENT ONLY

This phase implements the customer login authentication mechanics defined in Phase 17.10.

This phase adds customer login and logout behavior, a customer login form, password verification against `customer_users.password_hash`, isolated customer session state, and successful-login `last_login_at` updates.

This phase does not implement a portal dashboard, does not implement workpack visibility, does not implement customer document visibility, does not implement permissions, does not implement planning visibility, does not implement audit visibility, does not implement execution-control visibility, and does not refactor unrelated system behavior.

## Purpose

The purpose of this phase is to implement customer authentication around `CustomerUser` identities.

Jupiter must allow only valid `ACTIVE` customer users to authenticate, must deny `INVITED` and `DISABLED` users, and must maintain customer session state separately from staff authentication state.

This phase implements customer authentication mechanics only.

It does not implement customer operational visibility.

## Scope

This phase implements:

- a customer login route
- a customer logout route
- a customer login form
- password verification against `customer_users.password_hash`
- `ACTIVE`-only customer login success
- denial of `INVITED` and `DISABLED` login
- isolated customer session state
- `last_login_at` updates after successful login only
- route mounting needed for customer-auth access

## Out Of Scope

The following are out of scope for Phase 17.11:

- portal dashboard implementation
- workpack visibility implementation
- customer document visibility implementation
- permissions implementation
- planning visibility
- audit visibility
- execution-control visibility
- unrelated schema changes
- unrelated refactoring

## Implemented Routes

This phase adds customer-auth route handling for login and logout.

### Implemented Route Direction

The implemented customer-auth flow includes:

- customer login route
- customer logout route

### Route Boundary

Customer-auth routing is kept separate from internal staff-auth logic while preserving the existing staff-auth system.

## Implemented Login Form

This phase adds a dedicated customer login form.

### Form Direction

The customer login form allows a customer user to submit:

- email
- password

### No Portal Expansion

The login form does not expose customer dashboard content or customer operational data.

## Implemented Authentication Rules

Customer authentication is implemented against the `CustomerUser` model.

### Password Verification

Password verification is implemented against `customer_users.password_hash`.

### Status Enforcement

The implementation allows login only when:

- `CustomerUser.status = ACTIVE`

The implementation denies login when:

- `CustomerUser.status = INVITED`
- `CustomerUser.status = DISABLED`

### Invalid Password Handling

The implementation denies login when password verification fails.

## Implemented Session Isolation

This phase implements isolated customer session context.

### Separate Session Branch

Customer session state is stored separately from staff Passport user state.

### Staff Auth Preservation

The customer-auth implementation preserves existing staff authentication behavior.

### No Cross-Context Access

Customer authentication does not create access to staff, planning, audit, or execution-control areas.

## Implemented `last_login_at` Behavior

This phase updates `last_login_at` only after successful customer authentication.

### Success-Only Update

`last_login_at` is updated only after:

- identity lookup succeeds
- `ACTIVE` status is confirmed
- password verification succeeds
- customer session state is established

### No Failure Update

Failed login attempts do not update `last_login_at`.

## Security Boundary Preserved

This phase preserves the identity and visibility boundaries defined in earlier phases.

### Locked Security Rules

The implementation preserves:

- `CustomerUser` is the login identity
- `Customer` is not the login identity
- no portal dashboard
- no workpack visibility
- no customer document visibility
- no permissions implementation
- no planning visibility
- no audit visibility
- no execution-control visibility

## Verification Requirements

Phase 17.11 is correctly implemented only if all of the following are true:

- customer login route exists
- customer logout route exists
- customer login form exists
- password verification uses `customer_users.password_hash`
- `ACTIVE` customer user can log in
- `INVITED` customer user cannot log in
- `DISABLED` customer user cannot log in
- invalid password fails
- customer session is isolated from staff auth context
- `last_login_at` updates only after successful login
- logout clears customer session
- staff auth still works
- no portal dashboard was added
- no workpack visibility was added
- no customer document visibility was added
- no permissions implementation was added
- no planning, audit, or execution-control leakage was added
- no unrelated files were changed

## Completion Criteria

Phase 17.11 is complete only when all of the following are true:

- customer login route was implemented
- customer logout route was implemented
- customer login form was implemented
- password verification against `customer_users.password_hash` was implemented
- `ACTIVE` login-only behavior was implemented
- `INVITED` and `DISABLED` denial behavior was implemented
- isolated customer session state was implemented
- `last_login_at` success-only update behavior was implemented
- staff auth behavior was preserved
- no portal dashboard was added
- no workpack visibility was added
- no customer document visibility was added
- no permissions implementation was added
- no unrelated refactoring was performed

## Final Statement

Phase 17.11 implements Jupiter customer authentication around `CustomerUser` login, enforcing password verification against `customer_users.password_hash`, allowing only `ACTIVE` users to authenticate, denying `INVITED` and `DISABLED` users, maintaining customer session isolation from staff authentication, updating `last_login_at` only on successful login, and deliberately excluding portal dashboard, workpack, document, permissions, planning, audit, and execution-control visibility from this phase.
