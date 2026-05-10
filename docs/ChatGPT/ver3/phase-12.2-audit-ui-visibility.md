# Phase 12.2 - Audit UI / Visibility Enhancement

## Status

DEFINE ONLY

This phase defines the audit UI and visibility expectations for Jupiter.

This phase does not implement code, change schema, alter lifecycle behavior, or modify the audit data model established in Phase 12.1 and Phase 12.1A.

## Purpose

The purpose of this phase is to make audit information operationally useful, readable, and accessible from the workpack context.

Audit must remain a trace tool, not a workflow control mechanism.

## Audit View Structure

The audit view must be structured around the workpack.

The primary audit presentation is:

- grouped by workpack
- presented as a chronological timeline

This means the user should be able to open a specific workpack and see the relevant operational history for that workpack in time order.

The timeline must represent the audit trail as a sequence of events, not as disconnected raw records.

## Audit Sections

The workpack audit view must support clear visibility of the following event families:

- workpack lifecycle events
- task lifecycle events
- snag lifecycle events

### Workpack Lifecycle Events

These include workpack state transitions and workpack-level actions such as:

- workpack creation
- issue
- start work
- certification
- close

### Task Lifecycle Events

These include task-level operational changes linked to the workpack, such as:

- task creation or linkage where relevant
- task start
- task completion
- task certification
- task lock or equivalent final task state actions

### Snag Lifecycle Events

These include snag-related changes linked to the workpack, such as:

- snag creation when linked to the workpack
- snag start
- snag resolution
- snag closure

## Readability Requirements

Audit presentation must be human-readable.

The UI must not depend on raw field diffs alone as the primary way to understand what happened.

Audit entries should use clear action language such as:

- `Workpack Issued`
- `Workpack Certified`
- `Task Started`
- `Task Completed`
- `Task Certified`
- `Snag Started`
- `Snag Resolved`
- `Snag Closed`

Raw technical values, before/after payloads, or metadata may still be visible as supporting detail, but the primary event label must be readable by operational users.

## Filtering Requirements

The audit UI must support filtering so users can isolate the events they care about.

Required filters:

- by entity type
- by user
- by time

### Entity Type Filter

The user must be able to filter audit events by:

- workpack
- task
- snag

This filter must reduce noise and make it easy to review only one class of operational history at a time.

### User Filter

The user must be able to filter events by the actor who performed them.

This is required for traceability and operational review.

### Time Filter

The user must be able to constrain the visible audit timeline by time.

This may be implemented using date range, time range, or equivalent bounded timeline filtering.

## UI Expectations

The audit UI must be operationally discoverable and easy to read.

Required UI expectations:

- accessible from the workpack view
- clearly visible timeline
- no mixing of unrelated data

### Accessible From Workpack View

Users must be able to reach the audit view directly from the workpack context.

Audit should not require a user to leave the workpack workflow and manually search elsewhere.

### Clearly Visible Timeline

Events must be displayed in a timeline-oriented format that emphasizes sequence and chronology.

Users should be able to quickly understand:

- what happened
- who did it
- when it happened

### No Mixing of Unrelated Data

The audit UI must show only audit events relevant to the selected workpack and its linked operational records.

Unrelated records from other workpacks must not appear in that timeline.

## Audit Invariants

The following invariants remain locked:

- audit remains immutable
- audit is read-only
- no editing capability

### Immutable

Audit history must not be alterable through the UI.

### Read-Only

The audit interface is for inspection only.

It must not provide create, update, delete, or correction controls for audit entries.

### No Editing Capability

No user-facing edit mechanism may exist for audit records in this phase.

## Relationship to Existing Audit Structure

This phase enhances visibility only.

It does not redefine the audit storage model created or stabilized in earlier phases.

This means:

- existing audit tables remain the source of truth
- existing append-only behavior remains the expected write pattern
- existing workpack, task, and snag audit capture remains structurally unchanged

## Non-Goals

This phase explicitly does not include:

- lifecycle changes
- data modification
- audit write changes

More specifically, this phase does not:

- change workpack lifecycle rules
- change task lifecycle rules
- change snag lifecycle rules
- change certification behavior
- change close behavior
- change audit generation logic
- change audit table design
- change how audit entries are written

## Final Statement

Phase 12.2 defines the audit UI as a per-workpack, chronological, human-readable, filterable, read-only timeline that clearly separates workpack, task, and snag events while preserving audit immutability and without changing lifecycle behavior, data structure, or audit write logic.
