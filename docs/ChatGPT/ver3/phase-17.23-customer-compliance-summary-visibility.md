# Phase 17.23 - Customer Compliance Summary Visibility

## Status

DEFINE ONLY

This phase defines customer-safe compliance summary visibility for authenticated customer users.

This phase does not implement code, does not change schema, does not change migrations, does not implement compliance visibility yet, does not implement execution-control visibility, does not implement planning visibility, does not implement audit visibility, does not implement permissions, and does not refactor existing behavior.

## Purpose

The purpose of this phase is to define customer-safe compliance summary visibility for authenticated customer users.

Jupiter must allow customer users to see only limited compliance summary information, and only for aircraft and workpacks already within their valid customer visibility boundary.

This phase defines summary-level compliance visibility only.

It does not implement compliance workflow control, execution detail, or internal compliance operations.

## Scope

This phase defines:

- the source of compliance visibility
- role-based visibility rules
- current versus historical customer-aircraft relationship behavior
- allowed customer-safe compliance summary fields
- internal-only compliance and execution fields
- compliance-status presentation rules
- exclusion of execution-control visibility
- exclusion of compliance workflow-control visibility
- exclusion of internal compliance-note visibility
- audit and privacy expectations
- verification requirements
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.23:

- code changes
- schema changes
- migration changes
- compliance implementation
- compliance workflow-control implementation
- execution-control visibility
- planning visibility
- audit visibility
- permissions implementation
- internal compliance operations UI
- compliance-rule redesign
- refactoring

This phase defines compliance summary visibility only.

## Compliance Visibility Source

Customer compliance visibility must derive from visible aircraft and visible workpacks.

### Visibility Chain

Compliance visibility derives from:

- authenticated `CustomerUser`
- linked `Customer`
- visible aircraft
- visible workpacks
- customer-safe compliance summaries attached to that visible aircraft or visible workpack scope

### Aircraft Source Of Truth

Visible aircraft derive from `customer_aircraft_links`.

### No Direct Compliance Ownership Inference

Compliance visibility must not be inferred directly from:

- internal compliance assignments
- internal notes
- planning records
- audit records
- document filenames
- historical assumptions

## Role-Based Visibility Rules

Compliance visibility must remain role-aware because aircraft and workpack visibility are role-aware.

### Roles That May Later Support Compliance Summary Visibility

The following relationship types may later support compliance summary visibility, subject to explicit customer-safe implementation rules:

- `OWNER`
- `CO_OWNER`
- `OPERATOR`
- `MANAGEMENT_COMPANY`

### Roles That Must Not Automatically Grant Full Compliance Visibility

The following relationship types must not automatically grant full compliance visibility:

- `BILLING_CUSTOMER`
- `CONTACT_ONLY`

### No Automatic Full Visibility

A linked customer does not automatically receive full compliance visibility.

Compliance visibility must remain bounded to explicit customer-safe summary fields only.

## Current Versus Historical Customer-Aircraft Relationship Behavior

Compliance summary visibility must distinguish current relationships from historical ones.

### Current Relationship Direction

Current valid aircraft visibility is the default source for current compliance summary visibility.

### Historical Links Do Not Automatically Grant Current Visibility

Historical customer-aircraft links do not automatically grant current compliance visibility.

A previously linked customer must not automatically retain visibility into current compliance summaries after the relevant current aircraft relationship ends.

### Explicit Historical Policy Required

If historical compliance visibility is ever allowed later, that must be explicitly defined in a future phase.

It must not be assumed from stored historical relationship rows.

## Allowed Customer-Safe Compliance Summary Fields

Only limited customer-safe compliance summary fields may later be shown.

### Allowed Summary Fields

Customer-safe compliance summary display may later include fields such as:

- aircraft registration
- compliance item type
- compliance reference code
- customer-safe compliance title
- high-level compliance status
- due date summary where customer-safe
- completed date summary where customer-safe
- high-level applicability or scope summary where customer-safe

### Summary-Only Boundary

These fields must remain summary-level.

This phase does not approve internal compliance operations detail.

## Internal-Only Compliance / Execution Fields

Certain compliance and execution data must remain internal-only.

### Internal Compliance Exclusions

Customer users must not see:

- internal compliance notes
- internal planning metadata
- internal audit traces
- internal assignment details
- internal reviewer comments
- internal approval routing
- internal escalation state
- hidden operational identifiers not intended for customers

### Internal Execution Exclusions

Customer users must not see:

- execution step detail tied to compliance closure
- engineer or mechanic workflow detail
- internal certification-control mechanics
- internal rework handling detail
- lock-state mechanics
- hidden execution-control transitions

### No Internal Compliance Notes Leakage

Internal compliance notes leakage is explicitly forbidden.

## Compliance-Status Presentation Rules

Compliance status must be customer-safe and high-level.

### Customer-Safe Status Direction

Customer-visible compliance statuses must later be presented as safe high-level summary states rather than internal workflow or control states.

### No Internal Workflow Leakage In Status

Status presentation must not expose:

- internal gate states
- internal approval states
- internal lock states
- execution-control transitions
- compliance workflow routing detail

### Summary Status Only

Status must remain summary-oriented and understandable without exposing internal compliance control structure.

## No Execution-Control Visibility

This phase must not expose execution-control visibility.

### No Execution-Control Data

Customer users must not see:

- task execution state
- mechanic activity detail
- engineer workflow detail
- certification workflow control detail
- internal start/stop control data

### No Execution-Control Leakage

Execution-control visibility is explicitly excluded.

## No Compliance Workflow-Control Visibility

This phase must not expose internal compliance workflow-control visibility.

### No Workflow-Control Exposure

Customer users must not see:

- internal compliance approval workflow
- reviewer routing
- internal escalation logic
- re-open or re-check mechanics
- internal queue or assignment control states

### No Internal Compliance Workflow Leakage

Internal compliance workflow leakage is explicitly forbidden.

## No Internal Compliance-Note Visibility

This phase must not expose internal compliance-note visibility.

### No Internal Note Exposure

Customer users must not see:

- internal compliance notes
- internal reviewer notes
- internal planning notes tied to compliance
- internal audit comments tied to compliance

## Audit / Privacy Expectations

Compliance summary visibility must preserve strict privacy and customer-boundary controls.

### Privacy Boundary

Customer compliance summary visibility must be limited to summaries attached to visible aircraft and visible workpacks within the valid customer relationship scope.

### No Cross-Customer Leakage

No cross-customer compliance leakage is allowed.

### No Audit Visibility

Customer users must not see internal audit data through compliance summaries.

### No Planning Visibility

Customer users must not see planning data through compliance summaries.

### No Execution-Control Visibility

Customer users must not see execution-control data through compliance summaries.

## Verification Requirements

Phase 17.23 is correctly defined only if all of the following are true:

- compliance visibility derives from visible aircraft and visible workpacks
- visible aircraft derive from `customer_aircraft_links`
- `CustomerUser` sees through linked `Customer`
- role-based visibility rules are defined
- current versus historical relationship behavior is defined
- historical links do not automatically grant current visibility
- allowed customer-safe compliance summary fields are defined
- internal-only compliance and execution fields are defined
- compliance-status presentation rules are defined
- no execution-control visibility is introduced
- no compliance workflow-control visibility is introduced
- no internal compliance-note visibility is introduced
- no planning visibility is allowed
- no audit visibility is allowed
- no execution-control visibility is allowed
- no internal compliance notes leakage is allowed
- no internal compliance workflow leakage is allowed

## Completion Criteria

Phase 17.23 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- compliance visibility source is defined
- role-based visibility rules are defined
- current versus historical relationship behavior is defined
- allowed customer-safe compliance summary fields are defined
- internal-only compliance and execution fields are defined
- compliance-status presentation rules are defined
- no execution-control visibility is explicitly preserved
- no compliance workflow-control visibility is explicitly preserved
- no internal compliance-note visibility is explicitly preserved
- audit and privacy expectations are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no compliance implementation was performed
- no permissions implementation was performed
- no refactoring was performed

## Final Statement

Phase 17.23 defines Jupiter customer compliance summary visibility as a customer-safe, summary-only boundary derived from visible aircraft and visible workpacks, where visible aircraft themselves derive from `customer_aircraft_links`, `CustomerUser` sees only through the linked `Customer`, historical links do not automatically grant current visibility, and no planning, audit, execution-control, internal compliance notes, or internal compliance workflow leakage is introduced in this phase.
