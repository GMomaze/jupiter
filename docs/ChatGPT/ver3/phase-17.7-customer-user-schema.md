# Phase 17.7 - Customer User Schema

## Status

DEFINE ONLY

This phase defines the database schema for customer-user login identities.

This phase does not implement code, does not implement schema yet, does not create migrations yet, does not implement authentication, does not implement portal UI, does not implement permissions, and does not refactor existing behavior.

## Purpose

The purpose of this phase is to define the database schema for customer-user login identities.

Jupiter must support customer-facing login identities through a dedicated `customer_users` table that remains separate from the `customers` business-entity table.

This phase defines the schema boundary only.

It does not implement authentication or customer access behavior.

## Scope

This phase defines:

- the `customer_users` table
- required customer-user fields
- the `CustomerUser -> Customer` relationship
- email uniqueness direction
- status rules
- password-hash storage rules
- invite-token and reset-token storage rules
- audit expectations
- out-of-scope items
- verification requirements
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.7:

- schema implementation
- migration creation
- code changes
- authentication implementation
- login implementation
- session implementation
- password-reset implementation
- invite-flow implementation
- portal UI implementation
- permissions implementation
- customer-facing workpack UI
- customer-facing document UI

This phase defines schema only.

## Schema Overview

Jupiter must use a dedicated `customer_users` table for customer-user login identities.

The `customer_users` table is distinct from the `customers` table.

This separation is mandatory because:

- customers are business entities, not login identities
- passwords must never be stored on customers
- person-level login identity must remain separate from organization-level business data

## Table: `customer_users`

The `customer_users` table stores customer-user login identities.

It must contain one row per customer-facing login identity.

### Required Fields

The `customer_users` table must include:

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

## Field Definitions

### `id`

- primary key
- unique identifier for the customer-user identity row

### `customer_id`

- required
- foreign key to `customers.id`

This field links the login identity to the owning customer business entity.

### `email`

- required
- primary login identifier for the customer user

This field represents the user's login email, not merely a business contact field copied from the customer record.

### `display_name`

- required
- human-facing name for the customer user

This field supports portal-safe or login-safe display identity later.

### `password_hash`

- required for active password-based login state
- stores only hashed password material
- never stores plaintext password

This field belongs only to `customer_users`, never to `customers`.

### `status`

- required
- allowed values:
  - `ACTIVE`
  - `INVITED`
  - `DISABLED`

This field defines the login state of the customer user.

### `invite_token_hash`

- optional
- stores only hashed invite token material where invite flow is used later

### `invite_expires_at`

- optional
- expiry timestamp for invite-token validity where invite flow is used later

### `password_reset_token_hash`

- optional
- stores only hashed password-reset token material where reset flow is used later

### `password_reset_expires_at`

- optional
- expiry timestamp for password-reset token validity where reset flow is used later

### `last_login_at`

- optional
- timestamp of the most recent successful login

This phase defines the field only.

It does not implement login tracking.

### `created_at`

- required timestamp

### `updated_at`

- required timestamp

## Relationship Definition

The customer-user schema must preserve the business-entity versus login-identity separation.

### CustomerUser Belongs To Customer

`CustomerUser` belongs to `Customer` through:

- `customer_users.customer_id -> customers.id`

### Customer Has Many CustomerUsers

`Customer` has many `CustomerUser` records.

This allows multiple individual users to belong to the same customer business entity.

### Required Association Direction

The schema must support:

- `CustomerUser belongsTo Customer`
- `Customer hasMany CustomerUser`

## Email Uniqueness

Email uniqueness must be enforced for login identity safety.

### Required Direction

`customer_users.email` must be unique for login identity purposes.

### Meaning Of Uniqueness

A single login email must resolve to one customer-user identity only.

This avoids ambiguous login routing.

### Separation From Customer Contact Email

A customer business email stored on `customers.email` is not the same thing as a unique login identity.

Even if values match in practice, the business-entity field and login-identity field remain separate concepts.

## Status Rules

Customer-user status must be controlled explicitly.

### Allowed Status Values

Allowed values are:

- `ACTIVE`
- `INVITED`
- `DISABLED`

### `ACTIVE`

`ACTIVE` means the customer user is enabled for normal login use once authentication is later implemented.

### `INVITED`

`INVITED` means the customer user identity exists and is awaiting invite completion or credential activation.

### `DISABLED`

`DISABLED` means the customer user exists but must not be allowed to log in once authentication is later implemented.

### Controlled Status Rule

Status must be treated as a controlled allowed-value field rather than a free-form string.

## Password Hash Storage Rules

Password handling must remain strictly separated from customer business entities.

### No Plaintext Passwords

Plaintext passwords must never be stored.

### No Passwords On Customers

Passwords must never be stored on the `customers` table.

### Hash-Only Direction

`password_hash` must store only one-way hashed password material.

### Security Boundary

Password hash material must not appear in:

- customer master records
- normal UI rendering
- logs
- audit payloads visible to customers
- exports intended for customer-safe use

## Invite / Reset Token Storage Rules

Invite and reset-token handling must remain secure and identity-scoped.

### Hash-Only Token Direction

Invite tokens and reset tokens must be stored only as hashes.

### No Plaintext Invite Tokens

Plaintext invite tokens must never be stored in the database.

### No Plaintext Reset Tokens

Plaintext password-reset tokens must never be stored in the database.

### Expiry Support Required

The schema must support expiry timestamps for:

- invite token validity
- password-reset token validity

This phase defines storage support only.

It does not implement the invite or reset flows.

## Audit Expectations

Customer-user identity changes must be auditable when later implemented.

### CustomerUser Audit Expectations

The later system must audit:

- customer-user creation
- invite issuance
- invite completion
- customer-user activation
- customer-user disabling
- password-reset initiation
- password-reset completion
- login-relevant status changes

### No Secret Leakage In Audit

Audit records must not expose:

- plaintext passwords
- password hashes in customer-visible outputs
- plaintext invite tokens
- plaintext reset tokens

### Audit Boundary

This phase does not redesign the audit system.

It defines customer-user identity changes as auditable security-relevant actions for later implementation.

## Design Constraints

The following constraints are locked for this schema definition:

- customers are business entities, not login identities
- passwords are never stored on customers
- no plaintext passwords
- customer-user identity is stored in a dedicated table
- one customer may have multiple customer users
- no portal implementation in this phase
- no authentication implementation in this phase
- no permissions implementation in this phase

## Verification Requirements

Phase 17.7 is correctly defined only if all of the following are true:

- the `customer_users` table is defined
- all required fields are defined
- `CustomerUser belongsTo Customer` is defined
- `Customer hasMany CustomerUser` is defined
- email uniqueness is defined
- `ACTIVE / INVITED / DISABLED` status rules are defined
- password hash storage rules are defined
- invite/reset token storage rules are defined
- audit expectations are defined
- out-of-scope items are clearly excluded
- verification and completion criteria are defined

## Completion Criteria

Phase 17.7 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- the `customer_users` table is defined
- required fields are listed
- customer-user to customer association is defined
- email uniqueness is defined
- status rules are defined
- password-hash rules are defined
- invite/reset token storage rules are defined
- audit expectations are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema was implemented
- no migrations were created
- no authentication was implemented
- no portal UI was implemented
- no permissions were implemented

## Final Statement

Phase 17.7 defines Jupiter's `customer_users` schema as a dedicated login-identity table separate from `customers`, with required identity, credential-hash, invite, reset, status, and timestamp fields, a `CustomerUser -> Customer` association, unique email login direction, controlled `ACTIVE / INVITED / DISABLED` status handling, strict no-plaintext-password and no-passwords-on-customers rules, and auditable identity-event expectations for later implementation.
