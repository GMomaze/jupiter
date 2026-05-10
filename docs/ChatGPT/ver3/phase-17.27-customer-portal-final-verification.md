# Phase 17.27 - Customer Portal Final Verification

## Status

DEFINE ONLY

This phase defines the final verification matrix for the complete Phase 17 customer subsystem.

This phase does not implement code, does not change schema, does not change migrations, does not redesign permissions, does not redesign visibility boundaries, and does not refactor existing behavior.

This phase is verification-definition only.

## Purpose

The purpose of this phase is to define the final verification matrix for the complete Phase 17 customer subsystem.

Jupiter must have a clear final verification definition that confirms customer identity boundaries, customer-aircraft visibility boundaries, customer-safe portal behavior, and customer-safe exclusion of internal systems and internal operational data.

This phase defines verification expectations only.

It does not alter subsystem behavior.

## Scope

This phase defines verification checks for:

- customer master records
- multi-owner aircraft relationships
- `CustomerUser` identity separation
- customer invite flow
- customer login flow
- password reset flow
- customer session isolation
- portal shell
- aircraft visibility
- workpack summary visibility
- document visibility
- compliance summary visibility
- navigation and UX boundary
- audit and security boundary
- no internal leakage
- verification requirements
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.27:

- code changes
- schema changes
- migration changes
- permissions redesign
- visibility redesign
- audit-system redesign
- portal redesign
- authentication redesign
- workflow redesign
- refactoring

This phase defines final verification only.

## Final Verification Matrix

The Phase 17 customer subsystem is correct only if all defined customer boundaries and customer-safe visibility rules can be verified together as a single consistent model.

## Customer Master Records

Customer master-record verification must confirm that the customer business entity remains distinct from login identity handling.

### Customer Master Verification Checks

The final verification must confirm:

- `Customer` exists as the customer business/entity record
- customer records support customer-aircraft relationship resolution
- customer records do not become the login identity
- customer master data does not bypass the `CustomerUser` identity boundary

## Multi-Owner Aircraft Relationships

Multi-owner relationship verification must confirm that aircraft visibility can support multiple valid customer relationships without collapsing identity or access boundaries.

### Multi-Owner Verification Checks

The final verification must confirm:

- aircraft visibility can derive through multiple customer-aircraft relationships
- relationship handling remains based on `customer_aircraft_links`
- approved visibility relationships can coexist for a single aircraft
- relationship handling does not merge separate customers into a shared unrestricted visibility model

## CustomerUser Identity Separation

Identity verification must confirm that `CustomerUser` remains the login identity and `Customer` does not become one.

### Identity Separation Checks

The final verification must confirm:

- `CustomerUser` is the login identity
- `Customer` is not the login identity
- authentication, reset, invite, and session handling are all bound to `CustomerUser`
- customer business-record context does not replace user identity context

## Customer Invite Flow

Invite verification must confirm that customer invite behavior preserves the `CustomerUser` identity boundary.

### Invite Verification Checks

The final verification must confirm:

- customer invites target `CustomerUser` access onboarding
- invite behavior does not treat `Customer` as the login identity
- invite completion remains within customer-safe identity setup boundaries
- invite flow does not expand visibility beyond approved customer boundaries

## Customer Login Flow

Login verification must confirm that customer authentication remains customer-user based and portal-safe.

### Login Verification Checks

The final verification must confirm:

- customer login operates through `CustomerUser`
- login success establishes customer session state only for the authenticated `CustomerUser`
- login failure does not leak unnecessary internal detail
- login does not grant staff/admin visibility

## Password Reset Flow

Password-reset verification must confirm that password recovery remains a secure `CustomerUser`-only process.

### Password Reset Verification Checks

The final verification must confirm:

- password reset targets `CustomerUser`
- `Customer` is not used as the password-reset identity
- reset tokens are not stored in plaintext
- passwords are not stored in plaintext
- `password_hash` remains stored only on `customer_users`
- reset completion does not expand customer visibility or break customer session isolation

## Customer Session Isolation

Session verification must confirm that customer sessions remain isolated from internal system sessions and from other customer contexts.

### Session Isolation Checks

The final verification must confirm:

- customer session state remains customer-only
- customer session handling remains bound to the authenticated `CustomerUser`
- customer sessions do not imply staff/admin session state
- customer sessions do not bypass customer visibility boundaries

## Portal Shell

Portal-shell verification must confirm that the customer portal entry boundary remains safe, minimal, and customer-only.

### Portal Shell Verification Checks

The final verification must confirm:

- the portal shell exists within the customer portal boundary
- the portal shell requires authenticated customer-user access
- the portal shell presents only customer-safe identity and navigation context
- the portal shell does not expose staff/admin areas or internal operational controls

## Aircraft Visibility

Aircraft visibility verification must confirm that visible aircraft derive only from approved current customer-aircraft relationships.

### Aircraft Visibility Checks

The final verification must confirm:

- aircraft visibility derives from `customer_aircraft_links`
- only current valid customer-aircraft relationships grant current visibility
- historical links do not grant current visibility
- visibility is allowed for `OWNER`
- visibility is allowed for `CO_OWNER`
- visibility is allowed for `OPERATOR`
- visibility is allowed for `MANAGEMENT_COMPANY`
- `BILLING_CUSTOMER` does not receive full aircraft visibility where restricted by the defined customer-safe boundary
- `CONTACT_ONLY` does not receive full aircraft visibility where restricted by the defined customer-safe boundary

## Workpack Summary Visibility

Workpack verification must confirm that workpack summaries derive only from already visible aircraft under current approved relationship boundaries.

### Workpack Verification Checks

The final verification must confirm:

- visible workpacks derive through visible aircraft
- visible aircraft derive through `customer_aircraft_links`
- historical links do not grant current workpack visibility
- summary-only workpack presentation is preserved
- no execution-control workflow detail is exposed
- no planning metadata is exposed

## Document Visibility

Document verification must confirm that customer-visible documents remain restricted, customer-safe, and bounded by visible aircraft/workpack rules.

### Document Verification Checks

The final verification must confirm:

- customer document visibility derives from already approved customer visibility boundaries
- unrestricted document access is not granted
- document presentation remains customer-safe and bounded
- raw internal document storage exposure is not granted
- document visibility does not expose planning, audit, or execution-control detail

## Compliance Summary Visibility

Compliance verification must confirm that compliance summaries are derived only through the approved customer visibility chain.

### Compliance Verification Checks

The final verification must confirm:

- compliance visibility derives from `CustomerUser`
- compliance visibility derives through `Customer`
- compliance visibility derives through `customer_aircraft_links`
- compliance visibility derives through visible aircraft
- compliance visibility derives through visible workpacks
- customer-safe compliance summaries only are shown
- aircraft-level compliance items are not exposed outside the visible-workpack boundary
- `BILLING_CUSTOMER` does not receive full compliance visibility
- `CONTACT_ONLY` does not receive full compliance visibility
- no internal compliance notes are exposed

## Navigation / UX Boundary

Navigation and UX verification must confirm that the customer portal remains customer-only and does not expose internal route structures.

### Navigation / UX Verification Checks

The final verification must confirm:

- customer navigation remains customer-only
- no staff/admin route leakage is present
- no hidden operational navigation is exposed
- customer-safe menu boundaries are preserved
- customer-safe logout/session UX is preserved
- no internal workflow-state exposure appears in customer UX

## Audit / Security Boundary

Audit and security verification must confirm that customer access behavior may be audited internally without exposing audit systems to customer users.

### Audit / Security Verification Checks

The final verification must confirm:

- customer users do not see internal audit systems
- customer users do not see audit logs
- session/auth events are internally auditable where required
- invite/reset events are internally auditable where required
- internal audit visibility remains internal-only
- no audit UI or audit navigation is exposed to customers

## No Internal Leakage

Final verification must confirm that the entire customer subsystem remains free of internal leakage.

### Internal Leakage Checks

The final verification must confirm:

- no planning leakage
- no audit leakage
- no execution-control leakage
- no internal notes leakage
- no internal workflow-state leakage
- no unrestricted document access
- no staff/admin route leakage
- no reviewer-routing or approval leakage
- no hidden operational identifier leakage

## Locked Verification Constraints

The following constraints are explicitly preserved:

- `Customer` is not the login identity
- `CustomerUser` is the login identity
- visibility derives from `customer_aircraft_links`
- historical links do not grant current visibility
- `BILLING_CUSTOMER` and `CONTACT_ONLY` restrictions are preserved
- no planning leakage
- no audit leakage
- no execution-control leakage
- no internal notes leakage
- no unrestricted document access
- no staff/admin route leakage
- no permissions redesign in this phase
- no visibility-boundary expansion in this phase

## Verification Requirements

Phase 17.27 is correctly defined only if all of the following are true:

- customer master-record verification is defined
- multi-owner aircraft relationship verification is defined
- `CustomerUser` identity separation verification is defined
- customer invite-flow verification is defined
- customer login-flow verification is defined
- password-reset verification is defined
- customer session-isolation verification is defined
- portal-shell verification is defined
- aircraft visibility verification is defined
- workpack summary visibility verification is defined
- document visibility verification is defined
- compliance summary visibility verification is defined
- navigation and UX boundary verification is defined
- audit and security boundary verification is defined
- no internal leakage verification is defined
- `Customer` is explicitly preserved as not being the login identity
- `CustomerUser` is explicitly preserved as the login identity
- visibility derivation from `customer_aircraft_links` is explicitly verified
- historical-link exclusion is explicitly verified
- `BILLING_CUSTOMER` and `CONTACT_ONLY` restrictions are explicitly verified
- no planning leakage is explicitly verified
- no audit leakage is explicitly verified
- no execution-control leakage is explicitly verified
- no internal notes leakage is explicitly verified
- no unrestricted document access is explicitly verified
- no staff/admin route leakage is explicitly verified

## Completion Criteria

Phase 17.27 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- the final verification matrix is defined
- customer master-record verification checks are defined
- multi-owner aircraft relationship verification checks are defined
- `CustomerUser` identity separation verification checks are defined
- customer invite-flow verification checks are defined
- customer login-flow verification checks are defined
- password-reset verification checks are defined
- customer session-isolation verification checks are defined
- portal-shell verification checks are defined
- aircraft visibility verification checks are defined
- workpack summary visibility verification checks are defined
- document visibility verification checks are defined
- compliance summary visibility verification checks are defined
- navigation and UX boundary verification checks are defined
- audit and security boundary verification checks are defined
- no internal leakage verification checks are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no permissions redesign was performed
- no visibility redesign was performed
- no refactoring was performed

## Final Statement

Phase 17.27 defines Jupiter’s final Phase 17 customer-subsystem verification matrix as a complete customer-boundary confirmation model in which customer master records, multi-owner aircraft relationships, `CustomerUser` identity separation, invite/login/reset/session behavior, portal shell behavior, aircraft/workpack/document/compliance visibility, navigation and UX boundaries, audit and security boundaries, and internal-leakage exclusions are all verified together without treating `Customer` as the login identity, without bypassing `customer_aircraft_links`, without allowing historical-link visibility, without relaxing `BILLING_CUSTOMER` or `CONTACT_ONLY` restrictions, and without introducing planning, audit, execution-control, internal notes, unrestricted document, or staff/admin route leakage in this phase.
