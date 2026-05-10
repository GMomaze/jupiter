# Phase 13.4 - Planning Status & State Management

## Status

DEFINE ONLY

This phase defines controlled planning session states and transitions for Jupiter.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, audit, template, library, applicability, planning, persistence, visibility, or lifecycle behavior established in Phase 10 through Phase 13.3.

## Purpose

The purpose of this phase is to introduce an explicit state model for planning sessions so planning progress can be controlled and understood without treating planning sessions as workpacks.

Planning state management is a planning concern only.

## Planning Session States

The planning session states are defined as:

- `DRAFT`
- `IN_PROGRESS`
- `READY_FOR_GENERATION`
- `GENERATED`

## State Meaning

Each planning session state has the following meaning.

### `DRAFT`

`DRAFT` means:

- planning session has been created
- planning session is not yet populated

This is the initial planning state before meaningful candidate content review or editing has begun.

### `IN_PROGRESS`

`IN_PROGRESS` means:

- user is actively editing planning content

This state represents ongoing planning work where the user is reviewing, adding, removing, or refining candidate content.

### `READY_FOR_GENERATION`

`READY_FOR_GENERATION` means:

- planning session is valid
- planning session is complete

This state indicates that planning has passed the required planning validation and the session is ready for explicit user confirmation to generate a workpack.

### `GENERATED`

`GENERATED` means:

- workpack has been created
- planning session is locked

This is the final planning-session state after successful workpack generation.

## State Transitions

The allowed planning session transitions are:

- `DRAFT -> IN_PROGRESS`
- `IN_PROGRESS -> READY_FOR_GENERATION`
- `READY_FOR_GENERATION -> GENERATED`

### `DRAFT -> IN_PROGRESS`

This transition occurs when the user starts editing the planning session.

Editing includes meaningful planning interaction such as reviewing candidate content or making planning modifications.

### `IN_PROGRESS -> READY_FOR_GENERATION`

This transition occurs when planning validation passes.

Validation here refers to planning completeness and correctness within the planning workflow, not execution or certification logic.

### `READY_FOR_GENERATION -> GENERATED`

This transition occurs when the user explicitly confirms generation and the system successfully creates the workpack.

Generation must remain an explicit user action.

## Constraints

The following constraints are locked for planning state management:

- `GENERATED` sessions are read-only
- no reverse transition from `GENERATED`
- no automatic transitions to execution lifecycle

### `GENERATED` Is Read-Only

Once a planning session reaches `GENERATED`, it must no longer be editable.

The session may still be viewed, but it must remain locked as a finalized planning artifact.

### No Reverse Transition From `GENERATED`

There is no allowed transition from `GENERATED` back to:

- `READY_FOR_GENERATION`
- `IN_PROGRESS`
- `DRAFT`

`GENERATED` is terminal for the planning session state model.

### No Automatic Transition To Execution Lifecycle

Planning session state changes must not automatically start:

- workpack execution
- task execution
- certification
- close

Planning state remains separate from operational lifecycle behavior.

## Invariants

The following invariants are locked:

- planning session is not a workpack
- no lifecycle changes
- no audit changes

### Planning Session Is Not A Workpack

Planning session states must not be confused with, mapped onto, or substituted for workpack lifecycle states.

They are separate planning-only states.

### No Lifecycle Changes

This phase does not change:

- workpack lifecycle
- task lifecycle
- snag lifecycle

Planning state management must coexist with the already-locked lifecycle framework without altering it.

### No Audit Changes

This phase does not redefine audit structure, audit capture, audit UI behavior, or audit write logic.

## Boundary

This phase defines planning session state management only.

It does not define:

- execution logic
- certification logic
- close logic
- schema implementation
- lifecycle redesign

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 13.4 defines Jupiter planning session state management as a controlled planning-only state model of `DRAFT`, `IN_PROGRESS`, `READY_FOR_GENERATION`, and `GENERATED`, with explicit forward-only transitions, a terminal read-only generated state, and no impact on execution, lifecycle, or audit behavior.
