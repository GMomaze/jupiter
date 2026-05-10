# Phase 17.20 - Customer Password Reset Flow

## Status

DEFINE ONLY

This phase defines the secure password-reset flow for `CustomerUser` login identities.

This phase does not implement code, does not change schema, does not change migrations, does not implement authentication, does not redesign the portal, does not implement permissions, and does not refactor existing behavior.

This phase preserves customer session isolation.

## Purpose

The purpose of this phase is to define the secure password-reset flow for customer login identities.

Jupiter must support a controlled password-reset process for `CustomerUser` records so that a customer user may securely recover access without changing the identity boundary between `Customer` and `CustomerUser`.

This phase defines password-reset architecture only.

It does not implement reset mechanics.

## Scope

This phase defines:

- password-reset request flow
- reset-token generation direction
- reset-token hash storage direction
- reset-token expiry behavior
- password-reset completion flow
- password update behavior
- reset invalidation behavior
- failed and expired reset behavior
- audit and security expectations
- verification requirements
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.20:

- code changes
- schema changes
- migration changes
- authentication implementation
- portal redesign
- permissions implementation
- login implementation changes
- invite-flow implementation changes
- email-delivery implementation
- session middleware changes
- customer visibility expansion

This phase defines password-reset flow behavior only.

## Password-Reset Request Flow

Customer password reset must later begin through a dedicated `CustomerUser` reset request flow.

### Login Identity Boundary

The password-reset identity is `CustomerUser`.

The password-reset identity is not `Customer`.

### Request Direction

The later reset-request flow should accept a customer-user login identifier such as email and attempt to start a reset process for the matching `CustomerUser` record.

### Customer Boundary

The reset request must operate only on the `CustomerUser` identity record.

It must not treat customer business-entity contact data as the login identity by itself.

## Reset-Token Generation Direction

Password reset must later use secure reset tokens.

### Secure Token Direction

The system should later generate a strong, random, single-use reset token for the `CustomerUser` reset flow.

### Token Purpose

The reset token exists only to prove reset possession for the targeted `CustomerUser` identity.

### No Plaintext Storage Direction

The plaintext reset token must be delivered only through the reset channel.

It must not be retained as stored application data.

## Reset-Token Hash Storage

Reset tokens must later be stored only as hashes.

### Hash-Only Storage

Reset tokens must be stored only as one-way hashes.

### No Plaintext Reset Token Storage

Plaintext reset tokens must never be stored.

### Identity Storage Boundary

Reset-token hash material belongs only to the `CustomerUser` reset identity handling boundary.

It must not be stored on `Customer`.

## Reset-Token Expiry Behavior

Reset tokens must later expire.

### Expiring Reset Direction

Each reset token should later have a defined expiry window after which it is no longer valid.

### Time-Bounded Use

A reset token must not remain valid indefinitely.

### Expiry Enforcement

Expired reset tokens must be rejected before any password update occurs.

## Password-Reset Completion Flow

Password reset must later complete through a controlled token-validation and password-set flow.

### Completion Preconditions

The later reset-completion flow should require:

- a valid reset token
- matching hashed-token validation
- unexpired token state
- valid target `CustomerUser` identity

### Completion Outcome

If the reset token is valid, the customer user may complete a password reset by setting a new password under the `CustomerUser` identity flow.

### No Customer Identity Shift

Completing a reset does not change the rule that `CustomerUser` is the login identity and `Customer` is not.

## Password Update Behavior

A successful reset must later update the stored customer-user password safely.

### Password Storage Boundary

`password_hash` must remain stored only on `customer_users`.

### No Plaintext Password Storage

Plaintext passwords must never be stored.

### Password Replacement Direction

On successful reset completion, the old password hash should be replaced with a new secure password hash for that `CustomerUser`.

## Reset Invalidation Behavior

Reset tokens must later be invalidated when appropriate.

### Single-Use Direction

A successfully used reset token must no longer be usable again.

### Replacement Direction

Issuing a newer reset token should invalidate prior active reset tokens for the same `CustomerUser` where policy requires a single active reset path.

### Post-Reset Invalidation

After successful password reset, outstanding reset state for that token must be invalidated.

## Failed / Expired Reset Behavior

Invalid or expired reset attempts must fail safely.

### Failure Conditions

Password reset completion must fail when:

- the token is missing
- the token does not match the stored hash
- the token is expired
- the target `CustomerUser` identity is not valid for reset completion

### Failure Safety Direction

Failed reset behavior must avoid leaking unnecessary identity-state detail.

### No Password Update On Failure

Failed or expired reset attempts must not update the password hash.

## Audit / Security Expectations

Password reset is a security-relevant identity action.

### Audit Expectations

The later system must audit or security-log as appropriate:

- reset request initiation
- reset token issuance events where policy requires
- successful password reset completion
- failed or expired reset completion events where policy requires

### Secure Storage Expectations

The reset architecture must preserve:

- no plaintext reset-token storage
- no plaintext password storage
- password hash storage only on `customer_users`
- reset-token storage only as hashes

### No Visibility Expansion

Password reset must not expand customer portal visibility.

### No Leakage

Password reset must not expose:

- planning detail
- audit detail
- execution-control detail
- internal operational data

## Locked Reset Constraints

The following constraints are explicitly preserved:

- `CustomerUser` is the login identity
- `Customer` is not the login identity
- no plaintext reset tokens stored
- no plaintext passwords stored
- `password_hash` stored only on `customer_users`
- reset tokens stored only as hashes
- no portal visibility expansion
- no planning visibility
- no audit visibility
- no execution-control visibility

## Verification Requirements

Phase 17.20 is correctly defined only if all of the following are true:

- password-reset request flow is defined
- reset-token generation direction is defined
- reset-token hash storage is defined
- reset-token expiry behavior is defined
- password-reset completion flow is defined
- password update behavior is defined
- reset invalidation behavior is defined
- failed and expired reset behavior is defined
- audit and security expectations are defined
- `CustomerUser` is explicitly preserved as the login identity
- `Customer` is explicitly preserved as not being the login identity
- no plaintext reset tokens are stored
- no plaintext passwords are stored
- `password_hash` remains stored only on `customer_users`
- reset tokens remain stored only as hashes
- no portal visibility expansion is introduced
- no planning visibility is allowed
- no audit visibility is allowed
- no execution-control visibility is allowed

## Completion Criteria

Phase 17.20 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- password-reset request flow is defined
- reset-token generation direction is defined
- reset-token hash storage is defined
- reset-token expiry behavior is defined
- password-reset completion flow is defined
- password update behavior is defined
- reset invalidation behavior is defined
- failed and expired reset behavior is defined
- audit and security expectations are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no authentication implementation was performed
- no portal redesign was performed
- no permissions implementation was performed
- customer session isolation was preserved

## Final Statement

Phase 17.20 defines Jupiter’s customer password-reset flow as a secure `CustomerUser`-only identity process in which reset requests, expiring reset tokens, hash-only token storage, secure password replacement, and reset invalidation are all handled without treating `Customer` as the login identity, without storing plaintext reset tokens or plaintext passwords, without moving `password_hash` storage outside `customer_users`, and without introducing portal visibility expansion, planning visibility, audit visibility, or execution-control visibility in this phase.
