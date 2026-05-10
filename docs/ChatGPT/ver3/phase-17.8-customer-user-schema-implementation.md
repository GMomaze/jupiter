# Phase 17.8 - Customer User Schema Implementation

## Status

IMPLEMENT ONLY

This phase implements the `customer_users` schema defined in Phase 17.7.

This phase creates the database migration, creates the `CustomerUser` model, and registers the required model associations.

This phase does not implement authentication, does not implement portal UI, does not implement permissions, does not implement password-reset behavior, does not implement invite-flow behavior, and does not refactor unrelated system behavior.

## Purpose

The purpose of this phase is to implement the foundational database schema for customer-user login identities.

Jupiter must persist customer-user identities in a dedicated `customer_users` table that remains separate from the `customers` business-entity table.

This phase implements schema and model structure only.

It does not implement login behavior.

## Scope

This phase implements:

- the `customer_users` Sequelize migration
- the `CustomerUser` Sequelize model
- the `Customer hasMany CustomerUser` association
- the `CustomerUser belongsTo Customer` association
- unique email enforcement
- allowed `status` enforcement
- token-hash and expiry storage fields
- `last_login_at`
- `created_at` and `updated_at`

## Out Of Scope

The following are out of scope for Phase 17.8:

- login routes
- authentication logic
- session implementation
- portal UI
- permissions implementation
- password-reset flow behavior
- invite-flow behavior
- unrelated schema changes
- unrelated refactoring

## Implemented Database Change

This phase adds a new `customer_users` table through Sequelize migration.

### Implemented Fields

The implemented table includes:

- `id`
- `customer_id`
- `email`
- `display_name`
- `password_hash`
- `status`
- `invite_token_hash`
- `invite_expires_at`
- `password_reset_token_hash`
- `password_reset_expires_at`
- `last_login_at`
- `created_at`
- `updated_at`

### Implemented Constraints

The implementation enforces:

- foreign key from `customer_users.customer_id` to `customers.id`
- unique email
- controlled `status` values:
  - `ACTIVE`
  - `INVITED`
  - `DISABLED`

## Implemented Model Layer

This phase adds the `CustomerUser` model and registers the required association wiring.

### Association Direction

The implemented associations are:

- `Customer hasMany CustomerUser`
- `CustomerUser belongsTo Customer`

### Validation Direction

The implemented model validates:

- email format
- allowed `status` values

## Security Boundary Preserved

This phase preserves all required identity-separation rules.

### Locked Security Rules

The implementation preserves:

- customers are business entities, not login identities
- passwords are not stored on `customers`
- password hash storage exists only on `customer_users`
- no plaintext password storage is introduced

## Verification Requirements

Phase 17.8 is correctly implemented only if all of the following are true:

- Sequelize migration exists for `customer_users`
- `CustomerUser` model exists
- associations are registered
- `customer_id` references `customers.id`
- unique email is enforced
- allowed `status` values are enforced
- token-hash fields exist
- token-expiry fields exist
- `last_login_at` exists
- migration up works
- migration down works
- no login routes were added
- no portal UI was added
- no invite/reset behavior was implemented
- no unrelated files were changed

## Completion Criteria

Phase 17.8 is complete only when all of the following are true:

- the `customer_users` migration was created
- the `CustomerUser` model was created
- required associations were registered
- unique email enforcement exists
- `ACTIVE / INVITED / DISABLED` status enforcement exists
- token-hash fields exist
- token-expiry fields exist
- `last_login_at` exists
- migration up was verified
- migration down was verified
- no login implementation was added
- no portal UI was added
- no permissions implementation was added
- no unrelated refactoring was performed

## Final Statement

Phase 17.8 implements Jupiter’s foundational `customer_users` schema through a dedicated migration, a `CustomerUser` model, and the required customer-user associations, while preserving business-entity versus login-identity separation, enforcing unique email and controlled account status values, and deliberately excluding authentication, portal UI, permissions, and invite/reset behavior from this phase.
