# Phase 11.4 - Snag Execution Integration

## Status

DEFINE ONLY

This phase defines how snags appear and behave on the execution page.

This phase does not implement code, change schema, alter lifecycle behavior, or modify the locked behavior of Phase 10.12 or Phase 11.1 through Phase 11.3.

## Purpose

The execution page must support active visibility and handling of snags discovered, linked, or managed during maintenance execution.

This phase defines how snags are presented, what snag actions are allowed during execution, and how snag behavior remains separate from task execution behavior.

## Execution Page Presence

Snags must appear on the execution page.

They are part of execution visibility because snag handling is operationally relevant while work is being carried out.

## Core Visibility Rules

The following execution-page rules are locked by this phase:

- snags are visible alongside tasks
- snags are not tasks
- snags use their own lifecycle

Interpretation:

- the execution page may present both tasks and snags in the same overall operational workspace
- snag records must remain distinguishable from task records
- snag state transitions must use the snag lifecycle, not the task lifecycle

## Snag Lifecycle in Execution

The snag lifecycle remains the separately defined lifecycle from Phase 11.2:

`OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED`

Execution integration does not merge this lifecycle with the task lifecycle.

## Allowed Snag Actions During Execution

The following snag actions are allowed in the execution page:

- start snag: `OPEN -> IN_PROGRESS`
- resolve snag: `IN_PROGRESS -> RESOLVED`

These are the operational snag actions that must be supported during active execution handling.

This phase does not define snag close action as an execution-page requirement.

## Meaning of Allowed Execution Actions

### Start Snag

Starting a snag means:

- the snag is acknowledged for active work
- corrective action on the snag has begun
- the snag moves from `OPEN` to `IN_PROGRESS`

### Resolve Snag

Resolving a snag means:

- the defect has been addressed
- the snag no longer requires active corrective work
- the snag moves from `IN_PROGRESS` to `RESOLVED`

Resolving a snag is not the same as closing a snag and is not the same as completing a task.

## Non-Effect Rules

The following non-effect rules are mandatory:

- resolving a snag does not complete a task
- resolving a snag does not certify a workpack
- snags do not affect task lifecycle directly

This means:

- snag resolution cannot substitute for task completion
- snag status movement cannot substitute for engineer certification
- snag handling cannot directly move any task into `COMPLETED_BY_MECHANIC`, `CERTIFIED_BY_ENGINEER`, or `LOCKED`

## Interaction Rules

The following interaction rules apply on the execution page:

- snags must be visible during execution
- snags must be actionable during execution
- snag actions must not interfere with task execution

Interpretation:

- the user must be able to see snag state while performing execution work
- the user must be able to perform allowed snag actions without leaving the execution context
- snag actions must not block, mutate, or corrupt task actions unless a separately defined enforcement rule explicitly says so

## Separation Rules

Snag execution handling must remain distinct from task execution handling.

Required separation:

- snag controls operate on snag lifecycle only
- task controls operate on task lifecycle only
- snag action results must not be interpreted as task progress
- task action results must not be interpreted as snag progress

## UI Expectations

The execution page must make snag handling unambiguous.

Required UI expectations:

- snags must be clearly separated from tasks
- no mixing of controls
- no confusion between task completion and snag resolution

This means the UI must avoid presenting snag actions as if they were task actions.

Users must be able to tell:

- which rows are tasks
- which rows are snags
- which controls complete or certify tasks
- which controls start or resolve snags

## Explicit Prohibitions

This phase explicitly does not allow the following:

- merging snag lifecycle with task lifecycle
- modifying workpack lifecycle
- introducing automatic transitions

Also forbidden:

- automatic task completion when a snag is resolved
- automatic snag resolution when a task is completed
- automatic workpack certification based on snag actions
- automatic workpack closure based on snag actions

## Lifecycle Boundary

This phase does not change:

- workpack lifecycle
- task lifecycle
- certification rules
- close-enforcement rules already defined elsewhere

Snag execution integration is a visibility and actionability definition only.

It defines how snags are handled during execution, not how the core lifecycle engines are redesigned.

## Invariants

The following invariants are established by Phase 11.4:

- snags appear on the execution page
- snags are visible alongside tasks
- snags are not tasks
- snags use their own lifecycle
- execution supports `OPEN -> IN_PROGRESS` for snags
- execution supports `IN_PROGRESS -> RESOLVED` for snags
- snag actions do not directly alter task lifecycle
- snag actions do not certify the workpack
- snag UI and task UI must remain clearly separated

## Final Statement

Phase 11.4 defines snag execution integration as a clearly separated execution-page capability in which snags are visible and actionable alongside tasks, use their own lifecycle, support start and resolve actions during execution, and do not directly alter task lifecycle, certification, or workpack lifecycle behavior.
