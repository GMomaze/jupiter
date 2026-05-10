# Phase 13.7 - Planning Metadata

## Status

DEFINE ONLY

This phase defines lightweight planning-session metadata for Jupiter.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, audit, template, library, applicability, planning, persistence, visibility, validation, integrity, status-management, or lifecycle behavior established in Phase 10 through Phase 13.6.

This phase is not the audit system.

## Purpose

The purpose of this phase is to provide minimal informational tracking for planning sessions without introducing a second audit framework.

Planning metadata is intended only to identify who created, updated, and finalized a planning session and when those events occurred.

## Metadata Fields

The following planning-session metadata fields are required:

- `created_by`
- `created_at`
- `updated_at`
- `finalized_by`
- `finalized_at`

### `created_by`

`created_by` identifies the user who created the planning session.

### `created_at`

`created_at` records when the planning session was first created.

### `updated_at`

`updated_at` records the most recent time the planning session was saved or otherwise updated within the planning workflow.

### `finalized_by`

`finalized_by` identifies the user who successfully finalized the planning session into a generated workpack.

### `finalized_at`

`finalized_at` records when the planning session was successfully finalized into a generated workpack.

## Behavior

The planning metadata behavior is defined as follows:

- `created_*` set on session creation
- `updated_at` updates on save
- `finalized_*` set on successful workpack generation

### Creation Behavior

When a planning session is first created:

- `created_by` must be set
- `created_at` must be set

These values identify the origin of the planning session.

### Save Behavior

Whenever a planning session is saved:

- `updated_at` must reflect the latest save time

This phase does not require a change history of every save.

Only the current latest update timestamp is required.

### Finalization Behavior

When a planning session successfully generates a workpack:

- `finalized_by` must be set
- `finalized_at` must be set

These values identify who completed the planning-to-workpack handoff and when it occurred.

The finalization metadata is only set on successful generation.

## Constraints

The following constraints are mandatory:

- metadata is informational only
- no history tracking required
- no versioning required
- no hash chaining

### Informational Only

Planning metadata must not control workflow behavior beyond its informational purpose.

It is for visibility and traceability at a simple session level only.

### No History Tracking

This phase does not require a record of every metadata change over time.

Only the current metadata fields are required.

### No Versioning

This phase does not introduce planning-session version history or revision numbering.

### No Hash Chaining

This phase does not introduce tamper-evident chaining, immutable event logs, or audit-style hash structures.

## Invariants

The following invariants are locked:

- no audit system changes
- no lifecycle changes
- no execution triggered

### No Audit System Changes

This phase does not redefine audit capture, audit immutability, audit UI behavior, audit storage, or audit write logic established in Phase 12.

Planning metadata must remain separate from the audit system.

### No Lifecycle Changes

This phase does not change:

- workpack lifecycle
- task lifecycle
- snag lifecycle
- planning status transitions already defined in earlier phases

### No Execution Triggered

Planning metadata updates must not automatically:

- start a workpack
- start a task
- certify anything
- close anything
- alter generated execution state

## Boundary

The boundary of this phase is defined as follows:

- this is not a replacement for audit logs
- this does not track field-level changes

### Not A Replacement For Audit Logs

Planning metadata provides only lightweight informational tracking.

It must not be treated as a substitute for formal audit records.

### No Field-Level Change Tracking

This phase does not track before/after values, field diffs, or detailed change history for planning sessions.

That level of traceability remains outside the scope of this phase.

## Final Statement

Phase 13.7 defines Jupiter planning metadata as a minimal informational layer on planning sessions using `created_by`, `created_at`, `updated_at`, `finalized_by`, and `finalized_at`, with creation, save, and successful generation setting the appropriate values, while explicitly avoiding audit replacement, field-level change tracking, lifecycle changes, and execution effects.
