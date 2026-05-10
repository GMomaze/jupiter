# Phase 13.5 - Planning Validation Engine

## Status

DEFINE ONLY

This phase defines the planning validation engine for Jupiter.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, audit, template, library, applicability, planning, persistence, visibility, status-management, or lifecycle behavior established in Phase 10 through Phase 13.4.

## Purpose

The purpose of this phase is to ensure that planning sessions are valid before they can move to generation readiness or create a workpack.

Validation is a planning control mechanism only.

It prevents invalid planning content from progressing into workpack generation.

## Validation Scope

The planning validation engine must be applied:

- before transition to `READY_FOR_GENERATION`
- before workpack generation

### Before Transition To `READY_FOR_GENERATION`

Validation must run before a planning session is allowed to move from `IN_PROGRESS` to `READY_FOR_GENERATION`.

This ensures that a session is marked ready only when its planning content passes the required validation checks.

### Before Workpack Generation

Validation must also run before the system generates a workpack from a planning session.

This is required even if the planning session is already marked `READY_FOR_GENERATION`.

Generation must not proceed on invalid planning data.

## Validation Checks

The planning validation engine must enforce the following checks:

- no duplicate items
- required items present
- applicability resolved
- no invalid or missing references

### No Duplicate Items

The planning session must not contain duplicate items in the candidate content selected for generation.

Duplicate maintenance content must be identified and rejected so the generated workpack does not contain repeated unintended items.

### Required Items Present

The planning session must contain all required planning content needed to produce a valid workpack candidate.

This includes the required selected content necessary for the chosen planning context.

This phase defines the presence requirement only.

It does not define a new maintenance rule set outside the existing planning and template model.

### Applicability Resolved

All planning content intended for generation must have resolved applicability.

This means the system must confirm that the selected items remain valid for the planning context, including:

- aircraft
- aircraft model
- installed components
- maintenance type where relevant to planning selection

Items with unresolved or invalid applicability must fail validation.

### No Invalid Or Missing References

The planning session must not contain broken, invalid, stale, or missing references.

This includes references to content that no longer exists or can no longer be resolved within the planning context.

Validation must detect and reject such references before readiness or generation is allowed.

## Behavior On Failure

If validation fails, the system must:

- block transition to `READY_FOR_GENERATION`
- block workpack generation
- return clear validation errors

### Block Transition To `READY_FOR_GENERATION`

A planning session that fails validation must remain outside the `READY_FOR_GENERATION` state.

Validation failure prevents the session from being treated as complete and generation-ready.

### Block Workpack Generation

If validation fails at generation time, the system must not create a workpack.

No partial or degraded generation path is allowed under this phase.

### Return Clear Validation Errors

Validation failure must return clear and understandable error messages.

The user must be able to see what failed and why, so the planning session can be corrected before retrying.

## Behavior On Success

If validation succeeds, the system must:

- allow transition to `READY_FOR_GENERATION`
- allow generation

### Allow Transition To `READY_FOR_GENERATION`

When the planning session passes validation, it may transition into the `READY_FOR_GENERATION` state.

This indicates that the planning content is valid for explicit generation confirmation.

### Allow Generation

When the planning session passes validation at generation time, the system may proceed with workpack generation using the existing generation logic.

Validation success authorizes generation readiness and generation execution only within the planning workflow boundary.

## Invariants

The following invariants are locked for the planning validation engine:

- validation does not modify planning data
- no execution triggered
- no lifecycle changes
- no audit changes

### Validation Does Not Modify Planning Data

Validation is an inspection step only.

It must not rewrite, remove, add, or automatically correct planning content.

Any planning changes must remain explicit user actions outside the validation engine itself.

### No Execution Triggered

Validation must not automatically:

- start a workpack
- start a task
- create in-progress execution state
- certify anything
- close anything

Validation only determines whether planning content may progress.

### No Lifecycle Changes

This phase does not change:

- workpack lifecycle
- task lifecycle
- snag lifecycle
- planning session state model beyond validation gating already defined in earlier phases

Validation must operate within the existing locked lifecycle and planning-state framework.

### No Audit Changes

This phase does not redefine audit structure, audit capture, audit UI behavior, or audit write logic.

## Boundary

This phase defines planning validation behavior only.

It does not define:

- execution logic
- certification logic
- close logic
- schema implementation
- new lifecycle models

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 13.5 defines Jupiter’s planning validation engine as a non-mutating planning control that runs before `READY_FOR_GENERATION` and before workpack generation, checks for duplicates, required content, resolved applicability, and valid references, blocks invalid sessions with clear errors, and allows readiness and generation only when validation succeeds, without changing execution, lifecycle, or audit behavior.
