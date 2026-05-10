# Phase 17.6 - Customer User Login Foundation

## Status

DEFINE ONLY

This phase defines the architectural foundation for customer viewer login identities.

This phase does not implement code, does not change schema yet, does not implement authentication, does not implement portal UI, does not implement permissions, and does not refactor existing system behavior.

## Purpose

The purpose of this phase is to define the identity boundary for customer-facing login users.

Jupiter must distinguish between:

- customer business entities
- customer user login identities

This phase defines the login-foundation direction only.

It does not implement authentication or customer access.

## Scope

This phase defines:

- the difference between `Customer` and `CustomerUser`
- the customer-user login identity model
- email-as-login direction
- password handling direction
- invite and reset-password direction
- support for multiple users per customer
- customer-user visibility-boundary direction
- audit and security expectations
- future authentication direction
- future permissions direction
- verification requirements
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.6:

- code changes
- schema changes
- authentication implementation
- password implementation
- session implementation
- portal UI implementation
- permissions implementation
- customer-facing workpack UI
- customer-facing document UI
- lifecycle changes
- audit redesign
- planning redesign
- execution redesign

This phase defines architectural foundation only.

## Difference Between Customer And CustomerUser

Jupiter must treat `Customer` and `CustomerUser` as different concepts.

### Customer

`Customer` is a business entity.

It represents the business organization or linked party associated with aircraft through customer-aircraft relationships.

`Customer` is not a login identity.

### CustomerUser

`CustomerUser` is a login identity associated with a customer business entity.

It represents an individual person who may later authenticate and view customer-scoped information.

`CustomerUser` is not the customer business entity itself.

### Locked Separation

The following separation must be preserved:

- customers are business entities
- customer users are human login identities
- customer visibility derives from customer-aircraft relationships, not from the existence of a login alone

## CustomerUser Login Identity Model

Jupiter must later support a dedicated customer-user identity model.

### Identity Direction

A `CustomerUser` should later be modeled as a distinct identity record linked to a customer entity.

This identity model should support:

- one login identity per person
- linkage from the person to one customer business entity
- future support for more than one user under the same customer

### Identity Ownership

The customer business entity owns the business relationship scope.

The `CustomerUser` identity only provides person-level access into that customer scope.

### No Login-On-Customer Pattern

The system must not store login credentials directly on the `customers` table.

Customers are not login identities.

## Email-As-Login Direction

The default login direction should be email-based.

### Email As Primary Login Identifier

Each `CustomerUser` should later authenticate using an email address as the primary login identifier.

### Email Direction Requirements

The email direction should support:

- unique login identity per customer user
- human-friendly invite and reset flow
- clear audit traceability of login identity

### Business Entity Separation

Customer business email fields on the customer record do not automatically become login identities.

A customer contact email and a customer-user login email are related concepts, but they are not automatically the same record.

## Password Handling Direction

Password handling must remain separated from business customer records.

### No Passwords On Customers Table

Passwords must never be stored on the `customers` table.

### Credential Direction

If password-based login is later implemented, password material must belong only to the `CustomerUser` identity model.

### Secure Storage Direction

The future direction must use:

- one-way password hashing
- no plaintext storage
- no reversible password storage
- no password exposure in logs, views, exports, or audit payloads

This phase defines only the security direction, not the implementation.

## Invite / Reset-Password Direction

Customer-user onboarding should later follow an invite-based direction rather than a direct unmanaged password creation model.

### Invite Direction

The later architecture should support a controlled invite flow for creating customer-user access.

### Reset Direction

The later architecture should support password reset or credential recovery through a dedicated customer-user identity flow.

### Security Boundary

Invite and reset mechanisms must belong to `CustomerUser` identity handling only.

They must not modify customer business-entity data except where explicit audit-safe user association is required.

## Multiple Users Per Customer Support

Jupiter must support multiple users under the same customer business entity.

### Business Need

A customer organization may require multiple people to access the same aircraft and workpack scope later.

### Required Direction

The architectural model must support:

- one customer to many customer users
- separate user identities for separate people
- shared customer-level visibility boundary governed by the customer-aircraft relationship model

### No Shared Login Identity

The system should not assume one shared login per customer.

## Customer-User Visibility Boundary Direction

Customer-user visibility must remain downstream of the customer-aircraft relationship model.

### Visibility Still Derives From Customer Relationship

Customer visibility still derives from customer-aircraft relationships.

A `CustomerUser` may later see only the information allowed to the linked customer entity.

### Login Does Not Create Scope

A login identity alone does not create aircraft, workpack, execution, document, or compliance visibility.

Visibility must still be evaluated from:

- the linked customer entity
- the customer-aircraft relationship model
- later explicit visibility rules

### No Internal Leakage

Future customer-user visibility must not leak:

- internal audit detail
- planning sessions
- planning metadata
- execution-control internals
- internal task-assignment mechanics
- internal role-control state

## Audit / Security Expectations

Customer-user identity architecture must preserve audit and security boundaries.

### Audit Expectations

Future customer-user identity actions must later be auditable, including:

- invite creation
- account activation
- password reset initiation
- password reset completion
- login-relevant account status changes

### No Audit Leakage

Customer users must not see internal audit records, audit actor internals, or internal audit payloads.

### Security Expectations

The architectural direction must preserve:

- least-privilege identity design
- secure credential separation
- customer-scope isolation
- no password leakage
- no cross-customer visibility leakage

## Future Authentication Direction

This phase defines the later authentication direction without implementing it.

### Dedicated Customer Authentication Flow

Future customer login must use a dedicated customer-user authentication path rather than reusing internal staff identities by assumption.

### Identity Isolation

Customer-user authentication must remain distinct from internal operational staff authentication unless a later explicit architecture phase defines a shared identity strategy safely.

### No Auth Implementation In This Phase

This phase does not implement:

- login routes
- session handling
- password hashing
- reset tokens
- invite tokens
- auth middleware

It defines only the architectural direction.

## Future Permissions Direction

This phase defines only the permissions direction, not the implementation.

### Customer Permissions Must Be Separate

Future customer-user permissions must be designed as customer-facing access rules, not assumed to be identical to internal staff RBAC.

### Relationship-Bounded Permissions

Any future permission model must remain bounded by:

- the linked customer entity
- customer-aircraft relationships
- customer-safe visibility rules

### No Permissions Implementation In This Phase

This phase does not create:

- permission tables
- permission middleware
- customer RBAC
- customer access policy code

## Verification Requirements

Phase 17.6 is correctly defined only if all of the following are true:

- the difference between `Customer` and `CustomerUser` is explicitly defined
- customers are treated as business entities, not login identities
- customer-user login identity direction is defined
- email-as-login direction is defined
- password handling direction is defined
- invite/reset-password direction is defined
- multiple users per customer are supported in the architecture
- customer visibility still derives from customer-aircraft relationships
- no portal implementation is introduced
- no authentication implementation is introduced
- no permissions implementation is introduced
- no audit leakage is allowed
- no planning leakage is allowed
- no execution-control leakage is allowed

## Completion Criteria

Phase 17.6 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- the difference between `Customer` and `CustomerUser` is defined
- the customer-user login identity model is defined
- email-as-login direction is defined
- password handling direction is defined
- invite/reset-password direction is defined
- multiple-users-per-customer support is defined
- customer-user visibility-boundary direction is defined
- audit and security expectations are defined
- future authentication direction is defined
- future permissions direction is defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no authentication implementation was performed
- no portal UI was implemented
- no permissions implementation was performed

## Final Statement

Phase 17.6 defines Jupiter’s customer login foundation by separating customer business entities from customer-user login identities, preserving customer-aircraft relationships as the source of visibility scope, requiring email-based identity direction and secure password separation outside the customers table, supporting multiple users per customer organization, and forbidding any portal, authentication, permissions, audit-leakage, planning-leakage, or execution-control-leakage implementation in this phase.
