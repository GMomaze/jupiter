# Phase 17.9 - Customer User Invite Flow

## Status

DEFINE ONLY

This phase defines how staff will invite customer users and how invited users will later set their password.

This phase does not implement code, does not change schema, does not change migrations, does not implement authentication, does not implement portal UI, does not implement permissions, and does not refactor existing behavior.

## Purpose

The purpose of this phase is to define the controlled invite flow for customer-user onboarding.

Jupiter must support a staff-driven invite process in which:

- staff create or issue an invite for a customer user
- the customer user receives an invite path
- the invited customer user later sets a password
- the customer user transitions from `INVITED` to `ACTIVE`

This phase defines the invite-flow architecture only.

It does not implement the flow.

## Scope

This phase defines:

- staff invite creation flow
- `CustomerUser` `INVITED` status behavior
- invite-token generation direction
- invite-token hash storage direction
- invite-expiry behavior
- set-password flow direction
- activation from `INVITED` to `ACTIVE`
- re-invite behavior
- expired-invite behavior
- audit and security expectations
- verification requirements
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.9:

- code changes
- schema changes
- migration changes
- authentication implementation
- login implementation
- portal dashboard implementation
- customer workpack visibility implementation
- permissions implementation
- email-delivery implementation
- password-reset implementation
- session implementation

This phase defines invite-flow behavior only.

## Staff Invite Creation Flow

Customer-user onboarding must begin from an internal staff-controlled invite action.

### Staff-Controlled Creation

A staff user must later be able to create or issue an invite for a customer user tied to an existing customer business entity.

### Invite Preconditions

The invite flow must later require:

- a valid customer business entity
- a customer-user identity record
- a valid email for the invited person
- a status appropriate for invite issuance

### Staff Role In Flow

Staff control the issuance of the invite.

Invited users do not self-create customer business entities through this phase definition.

### Customer Separation

The invite is issued to a `CustomerUser`, not to a `Customer` business entity.

Customers remain business entities, not login identities.

## CustomerUser `INVITED` Status Behavior

The `INVITED` status must represent a pending login identity that has not yet completed initial password setup.

### Meaning Of `INVITED`

`INVITED` means:

- the customer-user identity exists
- the user is not yet active for normal login use
- the invite is pending or awaiting completion

### `INVITED` Is Not `ACTIVE`

An `INVITED` user must not be treated as an active authenticated customer user until the invite completion and set-password flow succeeds.

### Invite State Boundary

The invite flow must preserve a clear distinction between:

- identity exists
- invite pending
- password not yet set
- account not yet activated

## Invite Token Generation Direction

Invite onboarding must later use a generated invite token.

### Token Purpose

The invite token is the temporary secret that lets the invited customer user reach the set-password flow safely.

### Token Direction

The later implementation should use:

- a strong random token
- one-time or effectively one-use invite semantics
- high-entropy token generation

### No Predictable Tokens

Invite tokens must not be guessable, sequential, or derived from customer or user identifiers directly.

## Invite Token Hash Storage

Invite tokens must never be stored in plaintext.

### Hash-Only Storage Rule

Only an invite token hash may be stored in the database.

### No Plaintext Invite Tokens

Plaintext invite tokens must never be stored in:

- database rows
- logs
- audit payloads
- internal screens
- exports

### CustomerUser Storage Boundary

Invite-token hash material belongs only on the `customer_users` identity record or its later identity-safe equivalent.

It must not be stored on the `customers` table.

## Invite Expiry Behavior

Invite tokens must later expire.

### Expiry Required

An invite must have a finite validity period.

### Expiry Storage Direction

Expiry must be tracked using the invite-expiry field already defined in the customer-user schema direction.

### Expired Invite Effect

Once expired, an invite token must no longer be accepted for password setup.

### Expiry Does Not Delete Identity

Invite expiry does not remove the customer-user identity.

It only invalidates the current outstanding invite.

## Set-Password Flow

Invited users must later complete onboarding through a controlled set-password flow.

### Set-Password Purpose

The set-password flow allows the invited customer user to establish their initial credential.

### Flow Direction

The later flow should require:

- valid invite token presentation
- unexpired invite
- identity lookup through secure token verification
- password submission
- secure password-hash creation
- invite invalidation after successful completion

### No Plaintext Password Storage

No plaintext password may be stored at any time.

### CustomerUser Credential Boundary

The resulting credential hash must be stored only in `customer_users.password_hash`.

## Activation From `INVITED` To `ACTIVE`

Successful invite completion must activate the customer-user identity.

### Activation Rule

After successful password setup, the customer-user status should transition from:

- `INVITED`
- to `ACTIVE`

### Activation Preconditions

The transition should occur only after:

- valid invite token verification
- unexpired invite confirmation
- successful password set
- secure credential persistence

### No Automatic Visibility Expansion

Activation creates an active login identity only.

It does not change the visibility boundary, which still derives from customer-aircraft relationships and later visibility rules.

## Re-Invite Behavior

The system must later support controlled re-invite behavior.

### Re-Invite Purpose

A re-invite allows staff to issue a fresh invite when the previous invite is no longer usable or should be replaced.

### Re-Invite Direction

A re-invite should later:

- replace the previous active invite token hash
- set a new invite expiry
- preserve the customer-user identity record
- preserve audit traceability of re-invite activity

### No Duplicate Identity Creation By Default

Re-invite should not require creating a second customer-user identity for the same invited person.

## Expired Invite Behavior

Expired invites must be handled explicitly.

### Expired Token Result

An expired invite token must be rejected.

### User Outcome Direction

The invited user should later be informed that the invite is no longer valid and that a fresh invite is required.

### Staff Recovery Direction

Staff should later be able to re-issue an invite rather than manually creating new customer-user records unnecessarily.

## Audit / Security Expectations

Invite onboarding is a security-relevant identity action and must remain auditable and safe.

### Audit Expectations

The later system must audit:

- invite creation
- invite re-issuance
- invite completion
- invite expiry handling where relevant
- activation from `INVITED` to `ACTIVE`

### No Secret Leakage

Audit records must not expose:

- plaintext invite tokens
- plaintext passwords
- password hashes in customer-visible outputs

### Security Expectations

The invite architecture must preserve:

- secure token generation
- hash-only token storage
- no plaintext password storage
- customer-user identity isolation
- no cross-customer identity leakage

## Locked Invite-Flow Constraints

The following constraints are explicitly preserved:

- no plaintext invite tokens stored
- no plaintext passwords stored
- `password_hash` stored only on `customer_users`
- customers are not login identities
- no portal dashboard in this phase
- no customer workpack visibility in this phase
- no permissions implementation in this phase

## Verification Requirements

Phase 17.9 is correctly defined only if all of the following are true:

- staff invite creation flow is defined
- `CustomerUser` `INVITED` status behavior is defined
- invite-token generation direction is defined
- invite-token hash storage is defined
- invite-expiry behavior is defined
- set-password flow direction is defined
- activation from `INVITED` to `ACTIVE` is defined
- re-invite behavior is defined
- expired-invite behavior is defined
- audit and security expectations are defined
- plaintext invite-token storage is explicitly forbidden
- plaintext password storage is explicitly forbidden
- `password_hash` storage remains limited to `customer_users`
- no portal dashboard is introduced
- no customer workpack visibility is introduced
- no permissions implementation is introduced

## Completion Criteria

Phase 17.9 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- staff invite creation flow is defined
- `INVITED` status behavior is defined
- invite-token generation direction is defined
- invite-token hash storage is defined
- invite-expiry behavior is defined
- set-password flow is defined
- activation to `ACTIVE` is defined
- re-invite behavior is defined
- expired-invite behavior is defined
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

Phase 17.9 defines Jupiter’s customer-user invite flow as a staff-controlled onboarding process in which a `CustomerUser` remains `INVITED` until a secure, expiring invite token is used to complete an initial set-password flow, after which the user becomes `ACTIVE`, while preserving hash-only token storage, no plaintext password storage, `customer_users`-only credential storage, no portal dashboard behavior, no customer workpack visibility, and no permissions implementation in this phase.
