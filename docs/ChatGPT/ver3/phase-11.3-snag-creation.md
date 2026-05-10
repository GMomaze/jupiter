# Phase 11.3 - Snag Creation

## Status

DEFINE ONLY

This phase defines the rules for snag creation in Jupiter.

This phase does not implement code, change schema, alter lifecycle behavior, or modify the locked behavior of Phase 10.12, Phase 11.1, or Phase 11.2.

## Purpose

A snag is created to record a defect condition that requires tracking and corrective maintenance handling.

This phase defines what minimum data must exist at creation time, where a snag may be created, how ownership is captured, and what creation must not automatically trigger.

## Required Fields

The following fields are required for snag creation:

- `aircraft_id`
- defect text
- `created_by`

The following field is optional:

- `component_id`
- `workpack_id`

## Field Definitions

### `aircraft_id`

Required.

This identifies the aircraft on which the defect exists.

Every snag must be tied to a real aircraft.

### Defect Text

Required.

This is the human-readable description of the defect, snag, or discrepancy being reported.

It is the core operational description of the issue and must not be empty.

### `created_by`

Required.

This identifies the user who created the snag record.

The system must capture this ownership at creation time.

### `component_id`

Optional.

This may be provided when the defect is associated with a specific tracked component.

If omitted, the snag remains aircraft-level only.

### `workpack_id`

Optional.

This references `workpacks.id`.

This is used when a snag is created inside or linked to a workpack.

It must be `NULL` when a snag is created independently.

## Creation Context

A snag may be created in either of the following contexts:

- independently
- inside a workpack

### Independent Creation

A snag may be created as a standalone defect record outside any specific workpack.

This supports defect-driven operational reporting and future creation of dedicated snag workpacks where appropriate.

### In-Workpack Creation

A snag may also be created while working inside an existing workpack.

This supports defects discovered during scheduled or active maintenance.

## Ownership and Initial State

The following ownership and initial-state rules are locked by this phase:

- `created_by` must always be captured
- initial snag status must be `OPEN`

Creation does not permit any alternate initial snag lifecycle state.

New snags must begin in `OPEN`.

## Relationship Rules

The following relationship rules apply to every snag at creation time:

- a snag must be tied to an aircraft
- a snag may optionally be tied to a component
- a snag may optionally be linked to a workpack

Interpretation:

- aircraft linkage is mandatory
- component linkage is conditional and only used when relevant
- workpack linkage is optional because snags may exist either independently or inside a workpack

## Validation Rules

The following validations are required for snag creation:

- aircraft must exist
- defect text must not be empty
- `created_by` must be a valid user

### Aircraft Validation

The provided `aircraft_id` must resolve to an existing aircraft record.

If no such aircraft exists, snag creation must be rejected.

### Defect Text Validation

Defect text must contain meaningful content.

Blank, null, or whitespace-only defect text is invalid and must be rejected.

### User Validation

The provided `created_by` value must resolve to a valid user record.

If the user is not valid, snag creation must be rejected.

## Explicit Non-Automations

Snag creation must not automatically trigger unrelated workflow side effects.

Creation does not:

- auto-create tasks
- auto-change workpack status
- auto-trigger execution lifecycle

This means a snag record is created as a tracked defect entity only.

Any later linkage to execution, task handling, or workpack operational flow must happen explicitly in later phases or user actions.

## Audit Expectation

Snag creation must be auditable.

At minimum, the system must support traceability for:

- who created the snag
- when the snag was created
- what aircraft the snag belongs to
- what defect text was recorded
- whether the snag was linked to a component
- whether the snag was linked to a workpack

This phase does not define the exact audit implementation mechanism.

It defines the requirement that snag creation must produce an auditable record.

## Lifecycle Boundary

This phase does not change the snag lifecycle defined in Phase 11.2.

Creation only defines the entry condition:

- new snag status starts at `OPEN`

No other snag lifecycle state may be assigned at creation.

This phase also does not modify:

- task lifecycle
- workpack lifecycle
- certification rules
- close-enforcement rules

## Invariants

The following invariants are established by Phase 11.3:

- every snag must belong to an aircraft
- every snag must have defect text
- every snag must capture `created_by`
- every new snag starts in `OPEN`
- component linkage is optional
- workpack linkage is optional
- creation is auditable
- creation does not automatically create downstream execution or task behavior

## Final Statement

Phase 11.3 defines snag creation as an auditable defect-record creation event that always requires `aircraft_id`, defect text, and `created_by`, optionally allows `component_id` and workpack linkage, initializes the snag in `OPEN`, and does not automatically trigger tasks, workpack transitions, or execution lifecycle behavior.
