# Phase 17.16 - Customer Workpack Summary Visibility

## Status

DEFINE ONLY

This phase defines customer-safe workpack summary visibility for authenticated customer users.

This phase does not implement code, does not change schema, does not change migrations, does not implement document visibility, does not implement compliance visibility, does not implement execution-control visibility, does not implement planning visibility, does not implement audit visibility, does not implement permissions, and does not refactor existing behavior.

## Purpose

The purpose of this phase is to define customer-safe workpack summary visibility for authenticated customer users.

Jupiter must allow customer users to see only limited workpack summary information, and only for aircraft that are already within their valid customer-aircraft visibility boundary.

This phase defines summary-level workpack visibility only.

It does not implement task execution, document access, or compliance detail visibility.

## Scope

This phase defines:

- the source of workpack visibility
- role-based visibility rules
- current versus historical customer-aircraft relationship behavior
- allowed customer-safe workpack summary fields
- internal-only workpack and execution fields
- status presentation rules
- exclusion of task execution-control visibility
- exclusion of document download visibility
- exclusion of compliance detail visibility
- audit and privacy expectations
- verification requirements
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.16:

- code changes
- schema changes
- migration changes
- task execution visibility
- document download visibility
- CRS visibility
- compliance detail visibility
- planning visibility
- audit visibility
- permissions implementation
- customer execution UI
- internal workflow exposure

This phase defines workpack summary visibility only.

## Workpack Visibility Source

Customer workpack visibility must derive from visible aircraft.

### Visibility Chain

Workpack visibility derives from:

- authenticated `CustomerUser`
- linked `Customer`
- visible aircraft
- workpacks linked to those visible aircraft

### Aircraft Source Of Truth

Visible aircraft derive from `customer_aircraft_links`.

### No Direct Workpack Ownership Inference

Workpack visibility must not be inferred directly from:

- workpack text
- customer email
- work order assumptions
- documents
- notes
- historical assumptions

## Role-Based Visibility Rules

Workpack visibility must remain role-aware because aircraft visibility is role-aware.

### Roles That May Later Support Workpack Summary Visibility

The following relationship types may later support workpack summary visibility, subject to customer-safe implementation:

- `OWNER`
- `CO_OWNER`
- `OPERATOR`
- `MANAGEMENT_COMPANY`

### Roles That Must Not Automatically Grant Full Workpack Visibility

The following relationship types must not automatically grant full workpack visibility:

- `BILLING_CUSTOMER`
- `CONTACT_ONLY`

### No Automatic Full Visibility

A linked customer does not automatically receive full workpack visibility.

Workpack visibility must remain limited to the allowed customer-safe summary boundary defined in this phase.

## Current Versus Historical Customer-Aircraft Relationship Behavior

Workpack summary visibility must distinguish current from historical customer-aircraft relationships.

### Current Relationship Direction

Current valid aircraft visibility is the default source for current workpack summary visibility.

### Historical Links Do Not Automatically Grant Current Visibility

Historical customer-aircraft links do not automatically grant current workpack summary visibility.

A previously linked customer must not automatically retain visibility into workpacks after the relevant current aircraft relationship ends.

### Explicit Historical Policy Required

If historical workpack visibility is ever allowed later, that must be explicitly defined in a future phase.

It must not be assumed from stored historical relationship rows.

## Allowed Customer-Safe Workpack Summary Fields

Only limited customer-safe summary fields may later be shown.

### Allowed Summary Fields

Customer-safe workpack summary display may later include fields such as:

- workpack identifier
- work order number where customer-safe
- aircraft registration
- high-level workpack title or description where sanitized
- customer-safe status
- planned or actual date summary where explicitly approved later
- high-level maintenance summary
- created or opened date where customer-safe
- closed or completed date where customer-safe

### Summary-Only Boundary

These fields must remain summary-level.

This phase does not approve detailed execution records.

## Internal-Only Workpack / Execution Fields

Certain workpack and execution data must remain internal-only.

### Internal Workpack Exclusions

Customer users must not see:

- internal notes
- planning metadata
- internal comments
- task assignment details
- internal lock state
- internal approval mechanics
- internal workflow control fields
- hidden operational identifiers not intended for customers

### Internal Execution Exclusions

Customer users must not see:

- execution step detail
- mechanic activity detail
- engineer workflow detail
- certification-control internals
- internal timekeeping detail
- internal snag remediation control data

### No Internal Notes Leakage

Internal notes leakage is explicitly forbidden.

## Status Presentation Rules

Workpack status must be customer-safe and high-level.

### Customer-Safe Status Direction

Customer-visible statuses must later be presented as safe high-level operational states rather than internal workflow-state detail.

### No Internal Workflow Leakage In Status

Status presentation must not expose:

- internal gate states
- internal lock states
- internal execution-control transitions
- role-specific internal workflow mechanics

### Summary Status Only

Status must remain summary-oriented and understandable without exposing internal operational control structure.

## No Task Execution-Control Visibility

This phase must not expose task execution-control visibility.

### No Task-Level Control Data

Customer users must not see:

- task execution state transitions
- task assignees
- internal start/stop control details
- engineer/mechanic action states
- certification workflow control detail

### No Execution-Control Leakage

Execution-control visibility is explicitly excluded.

## No Document Download Visibility Yet

This phase must not expose customer document access yet.

### No Document Download Exposure

Customer users must not yet see:

- downloadable workpack documents
- CRS files
- release documents
- attached maintenance documents
- document download links

### No CRS Exposure In This Phase

CRS or related document download exposure is explicitly excluded.

## No Compliance Detail Visibility Yet

This phase must not expose detailed compliance visibility.

### No Compliance Detail Exposure

Customer users must not yet see:

- AD detail summaries
- SB detail summaries
- compliance item breakdowns
- compliance record internals
- maintenance compliance detail tied to workpacks

### Summary Boundary Preserved

This phase is limited to customer-safe workpack summary visibility only.

## Audit / Privacy Expectations

Workpack summary visibility must preserve strict privacy and customer-boundary controls.

### Privacy Boundary

Customer workpack summary visibility must be limited to workpacks attached to visible aircraft within the valid customer relationship scope.

### No Cross-Customer Leakage

No cross-customer workpack leakage is allowed.

### No Audit Visibility

Customer users must not see internal audit data through workpack summaries.

### No Planning Visibility

Customer users must not see planning data through workpack summaries.

### No Execution-Control Visibility

Customer users must not see execution-control data through workpack summaries.

## Verification Requirements

Phase 17.16 is correctly defined only if all of the following are true:

- workpack visibility derives from visible aircraft
- visible aircraft derive from `customer_aircraft_links`
- `CustomerUser` sees through linked `Customer`
- role-based visibility rules are defined
- current versus historical relationship behavior is defined
- historical links do not automatically grant current visibility
- allowed customer-safe workpack summary fields are defined
- internal-only workpack and execution fields are defined
- status presentation rules are defined
- no task execution-control visibility is introduced
- no document download visibility is introduced
- no compliance detail visibility is introduced
- no planning visibility is allowed
- no audit visibility is allowed
- no execution-control visibility is allowed
- no internal notes leakage is allowed
- no CRS or document download exposure is introduced

## Completion Criteria

Phase 17.16 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- workpack visibility source is defined
- role-based visibility rules are defined
- current versus historical relationship behavior is defined
- allowed customer-safe workpack summary fields are defined
- internal-only workpack and execution fields are defined
- status presentation rules are defined
- no task execution-control visibility is explicitly preserved
- no document download visibility is explicitly preserved
- no compliance detail visibility is explicitly preserved
- audit and privacy expectations are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no permissions implementation was performed
- no refactoring was performed

## Final Statement

Phase 17.16 defines Jupiter customer workpack summary visibility as a customer-safe, summary-only boundary derived from visible aircraft, where visible aircraft themselves derive from `customer_aircraft_links`, `CustomerUser` sees only through the linked `Customer`, historical links do not automatically grant current visibility, and no planning, audit, execution-control, internal notes, CRS, document download, or compliance detail exposure is introduced in this phase.
