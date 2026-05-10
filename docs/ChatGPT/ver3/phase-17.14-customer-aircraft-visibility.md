# Phase 17.14 - Customer Aircraft Visibility

## Status

DEFINE ONLY

This phase defines which aircraft an authenticated `CustomerUser` may see in the customer portal.

This phase does not implement code, does not change schema, does not change migrations, does not implement workpack visibility, does not implement document visibility, does not implement compliance visibility, does not implement permissions, and does not refactor existing behavior.

This phase preserves customer session isolation.

## Purpose

The purpose of this phase is to define the aircraft-visibility boundary for authenticated customer users.

Jupiter must allow a `CustomerUser` to see aircraft only through the linked `Customer` business entity and only through the explicit customer-aircraft relationship model.

This phase defines aircraft visibility only.

It does not implement customer workpack, document, or compliance visibility.

## Scope

This phase defines:

- the source of aircraft visibility
- role-based customer-aircraft visibility rules
- current versus historical relationship behavior
- allowed aircraft fields for customer display
- internal-only aircraft fields
- explicit exclusion of workpack, document, and compliance visibility
- audit and privacy expectations
- verification requirements
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.14:

- code changes
- schema changes
- migration changes
- workpack visibility implementation
- document visibility implementation
- compliance visibility implementation
- permissions implementation
- planning visibility
- audit visibility
- execution-control visibility
- customer portal redesign
- aircraft lifecycle redesign

This phase defines aircraft visibility boundaries only.

## Aircraft Visibility Source

Customer aircraft visibility must derive from the explicit `customer_aircraft_links` relationship model.

### Relationship Source Of Truth

Aircraft visibility must be derived from:

- the authenticated `CustomerUser`
- the linked `Customer`
- the relevant `customer_aircraft_links` rows

### No Inferred Visibility

Aircraft visibility must not be inferred from:

- customer email similarity
- free text
- invoices
- notes
- document distribution habits
- workpack references
- historical assumptions

### CustomerUser Visibility Path

A `CustomerUser` does not see aircraft directly as an identity alone.

A `CustomerUser` sees aircraft only through the linked `Customer` business entity and the customer-aircraft relationship model.

## Role-Based Customer-Aircraft Visibility Rules

Aircraft visibility must be role-aware.

### Roles That May Later Support Aircraft Visibility

The following relationship types may later support aircraft visibility, subject to explicit customer-safe implementation rules:

- `OWNER`
- `CO_OWNER`
- `OPERATOR`
- `MANAGEMENT_COMPANY`

### Roles That Must Not Automatically Grant Full Aircraft Visibility

The following relationship types must not automatically grant full aircraft visibility:

- `BILLING_CUSTOMER`
- `CONTACT_ONLY`

### No Automatic Full Visibility Rule

A linked customer does not automatically mean full visibility.

Even when a customer is linked to an aircraft, visibility must remain role-aware and customer-safe.

### Billing And Contact Restriction

`BILLING_CUSTOMER` and `CONTACT_ONLY` relationships may justify later limited communication or billing-safe presentation, but they must not automatically receive full aircraft visibility.

## Current Versus Historical Relationship Behavior

Aircraft visibility must distinguish current relationships from historical ones.

### Current Relationship Direction

Current active customer-aircraft relationship rows are the default source for aircraft visibility.

### Historical Relationship Retention

Historical customer-aircraft relationship rows remain preserved for business traceability and auditability.

### Historical Links Do Not Automatically Grant Current Visibility

Historical links do not automatically grant current customer visibility.

A previously linked customer must not automatically retain aircraft visibility after the relevant current relationship ends.

### Explicit Historical Policy Required

If historical aircraft visibility is ever allowed in the future, that must be defined explicitly in a later phase.

It must not be assumed from the existence of historical rows.

## Allowed Aircraft Fields For Customer Display

Only safe aircraft-identification information may later be displayed to customers.

### Allowed Customer-Safe Aircraft Fields

Customer-safe aircraft display may later include fields such as:

- aircraft registration
- aircraft model
- aircraft serial number
- manufacturer name where appropriate
- limited customer-safe aircraft status where explicitly approved later

### Minimal Safe Direction

Aircraft presentation should remain limited to identity and high-level customer-safe operational context.

This phase does not approve deeper operational detail.

## Internal-Only Aircraft Fields

Certain aircraft-related data must remain internal-only.

### Internal Aircraft Data Exclusions

Customer aircraft views must not expose internal-only aircraft data such as:

- internal planning metadata
- internal audit history
- internal assignment details
- execution-control state
- lock-state mechanics
- internal notes
- internal role-control details
- hidden operational identifiers not intended for customers

### No Internal Leakage

Aircraft visibility must not become a path into internal operational systems.

## No Workpack / Document / Compliance Visibility Yet

This phase defines aircraft visibility only.

### No Workpack Visibility Yet

Customer aircraft visibility must not yet expose:

- workpack lists
- workpack status
- workpack summaries
- workpack details

### No Document Visibility Yet

Customer aircraft visibility must not yet expose:

- aircraft-related document lists
- release documents
- downloadable maintenance files
- customer document access behavior

### No Compliance Visibility Yet

Customer aircraft visibility must not yet expose:

- compliance summaries
- AD status
- SB status
- maintenance compliance detail

## Audit / Privacy Expectations

Aircraft visibility must preserve strict privacy and customer-boundary controls.

### Privacy Boundary

Customer aircraft visibility must be restricted to aircraft within the valid linked-customer relationship scope.

No cross-customer leakage is allowed.

### Role-Aware Privacy

Aircraft visibility must remain role-aware and must not assume that every linked role has identical aircraft visibility rights.

### No Audit Visibility

Customers must not see internal audit records through aircraft views.

### No Planning Visibility

Customers must not see planning information through aircraft views.

### No Execution-Control Visibility

Customers must not see execution-control information through aircraft views.

## Verification Requirements

Phase 17.14 is correctly defined only if all of the following are true:

- aircraft visibility derives from `customer_aircraft_links`
- `CustomerUser` sees through linked `Customer`
- role-based customer-aircraft visibility rules are defined
- linked customer does not automatically mean full visibility
- `BILLING_CUSTOMER` and `CONTACT_ONLY` do not automatically get full aircraft visibility
- current versus historical relationship behavior is defined
- historical links do not automatically grant current visibility
- allowed aircraft fields for customer display are defined
- internal-only aircraft fields are defined
- no workpack visibility is introduced
- no document visibility is introduced
- no compliance visibility is introduced
- no planning visibility is allowed
- no audit visibility is allowed
- no execution-control visibility is allowed

## Completion Criteria

Phase 17.14 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- aircraft visibility source is defined
- role-based visibility rules are defined
- current versus historical behavior is defined
- allowed aircraft fields are defined
- internal-only aircraft fields are defined
- no workpack/document/compliance visibility is explicitly preserved
- audit/privacy expectations are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no workpack visibility was implemented
- no document visibility was implemented
- no compliance visibility was implemented
- no permissions implementation was performed
- customer session isolation was preserved

## Final Statement

Phase 17.14 defines Jupiter customer aircraft visibility as a customer-safe, role-aware boundary derived only from `customer_aircraft_links`, where a `CustomerUser` sees aircraft only through the linked `Customer`, current relationships govern default visibility, historical links do not automatically grant current access, `BILLING_CUSTOMER` and `CONTACT_ONLY` do not automatically receive full aircraft visibility, and no workpack, document, compliance, planning, audit, or execution-control visibility is introduced in this phase.
