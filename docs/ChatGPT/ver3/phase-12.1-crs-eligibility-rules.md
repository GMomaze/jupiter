# Phase 12.1 - CRS Eligibility Rules

## Status

DEFINE ONLY

This phase defines CRS eligibility rules for Jupiter.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, compliance, planning, audit, or lifecycle behavior established in other phases.

## Purpose

The purpose of this phase is to define exactly when a Certificate of Release to Service (`CRS`) may be generated.

CRS generation is an eligibility-gated document action only.

It must not act as a workflow transition.

## CRS Eligibility

A `CRS` may be generated only if all of the following are true:

- workpack is `CERTIFIED`
- all tasks are `CERTIFIED_BY_ENGINEER` or `LOCKED`
- compliance is `COMPLETE`
- all snags are `CLOSED`

### Workpack Must Be `CERTIFIED`

The workpack must already be in the `CERTIFIED` state before `CRS` generation is allowed.

If the workpack is not `CERTIFIED`, `CRS` generation is blocked.

### All Tasks Must Be `CERTIFIED_BY_ENGINEER` Or `LOCKED`

Every task linked to the workpack must be in a final eligible certification state.

Allowed task states for `CRS` eligibility are:

- `CERTIFIED_BY_ENGINEER`
- `LOCKED`

If any task is in any other state, `CRS` generation is blocked.

### Compliance Must Be `COMPLETE`

All compliance obligations linked to the workpack must be complete before `CRS` generation is allowed.

If compliance is incomplete, `CRS` generation is blocked.

### All Snags Must Be `CLOSED`

Every snag linked to the workpack must be fully `CLOSED`.

If any snag is not `CLOSED`, `CRS` generation is blocked.

## CRS Nature

The `CRS` is:

- a regulatory certification document
- not a report

### Regulatory Certification Document

The `CRS` is an operationally significant regulatory release document.

It represents formal release-to-service certification output.

### Not A Report

The `CRS` must not be treated as an informational report, dashboard summary, or general printable record.

Its eligibility standard is stricter because it is a certification document.

## CRS Generation Behavior

`CRS` generation must be:

- read-only
- must not change lifecycle
- must not change execution
- must not change compliance
- must not change snags

### Read-Only

Generating a `CRS` must not edit or mutate the underlying workpack, task, compliance, or snag data.

### Must Not Change Lifecycle

Generating a `CRS` must not:

- change workpack lifecycle
- change task lifecycle
- change snag lifecycle

### Must Not Change Execution

Generating a `CRS` must not:

- start work
- complete work
- certify tasks
- certify workpacks
- close workpacks

### Must Not Change Compliance

Generating a `CRS` must not mark compliance items complete, incomplete, or otherwise alter compliance state.

### Must Not Change Snags

Generating a `CRS` must not create, resolve, close, or alter snag records or snag state.

## Blocking Reasons

Blocking reasons must be clear and explicit.

Required blocking reason categories are:

- workpack not `CERTIFIED`
- one or more tasks not in `CERTIFIED_BY_ENGINEER` or `LOCKED`
- compliance not `COMPLETE`
- one or more snags not `CLOSED`

### Workpack Blocking Reason

If the workpack is not `CERTIFIED`, the blocking reason must clearly state that the workpack is not yet eligible for `CRS`.

### Task Blocking Reason

If any task is not in an eligible final certification state, the blocking reason must clearly state that task certification is incomplete.

### Compliance Blocking Reason

If compliance is not `COMPLETE`, the blocking reason must clearly state that compliance completion is required before `CRS` generation.

### Snag Blocking Reason

If any snag is not `CLOSED`, the blocking reason must clearly state that all snags must be closed before `CRS` generation.

## Boundary

This phase defines `CRS` eligibility only.

It does not define:

- lifecycle changes
- compliance logic changes
- snag logic changes
- planning logic changes
- schema changes

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 12.1 defines `CRS` eligibility as a strict read-only certification-document rule: a `CRS` may be generated only when the workpack is `CERTIFIED`, all tasks are `CERTIFIED_BY_ENGINEER` or `LOCKED`, compliance is `COMPLETE`, and all snags are `CLOSED`, with clear blocking reasons and no lifecycle, execution, compliance, or snag side effects.
