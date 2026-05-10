# Phase 11.2 - Snag Lifecycle

## Status

DEFINE ONLY

This phase defines the snag lifecycle for Jupiter.

This phase does not implement code, change schema, alter the locked Phase 10.12 workpack lifecycle, or change the locked task lifecycle.

## Lifecycle Definition

The snag lifecycle is defined as:

`OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED`

This lifecycle applies to snag records only.

It is a separate operational lifecycle for defect handling and must not be treated as a replacement for either the task lifecycle or the workpack lifecycle.

## State Meanings

### OPEN

`OPEN` means:

- the snag has been identified
- the snag is active
- corrective work has not yet formally begun
- the snag remains an unresolved defect

### IN_PROGRESS

`IN_PROGRESS` means:

- corrective work on the snag has begun
- the snag is actively being investigated, repaired, or processed
- the snag is still unresolved

### RESOLVED

`RESOLVED` means:

- the defect condition has been addressed
- the snag no longer requires active corrective work
- the snag is awaiting formal closure or administrative completion if applicable

`RESOLVED` does not mean the parent workpack is closed.

### CLOSED

`CLOSED` means:

- the snag record is complete
- no further snag lifecycle transition is allowed
- the snag is no longer considered open or unresolved for workpack close enforcement

`CLOSED` applies to the snag only.

It does not imply that the workpack is closed.

## Allowed Transitions Only

Only the following snag transitions are allowed:

- `OPEN -> IN_PROGRESS`
- `IN_PROGRESS -> RESOLVED`
- `RESOLVED -> CLOSED`

No other transitions are allowed.

Explicitly forbidden transitions include:

- `OPEN -> RESOLVED`
- `OPEN -> CLOSED`
- `IN_PROGRESS -> CLOSED`
- any reverse transition
- any reopen transition after `CLOSED`
- any skip transition

## Transition Authority

The following role authority is defined for snag lifecycle movement.

### OPEN -> IN_PROGRESS

Allowed roles:

- mechanic
- engineer
- supervisor

Meaning:

- any operationally authorized maintenance role may begin work on a snag

### IN_PROGRESS -> RESOLVED

Allowed roles:

- mechanic
- engineer
- supervisor

Meaning:

- the snag may be marked resolved by the role that completes or confirms the corrective action

### RESOLVED -> CLOSED

Allowed roles:

- engineer
- supervisor

Meaning:

- formal snag closure is restricted to higher-authority roles
- mechanics may perform work and resolve the snag, but do not perform final closure under this definition

## Independence From Task Lifecycle

The snag lifecycle is independent from the task lifecycle.

The locked task lifecycle remains:

`OPEN -> IN_PROGRESS -> COMPLETED_BY_MECHANIC -> CERTIFIED_BY_ENGINEER -> LOCKED`

Snag records do not use task states.

Task records do not use snag states.

No snag transition may implicitly move a task to a task lifecycle state, and no task transition may implicitly move a snag to a snag lifecycle state.

## Independence From Workpack Lifecycle

The snag lifecycle must not interfere with the workpack lifecycle.

The locked workpack lifecycle remains:

`DRAFT -> ISSUED -> IN_PROGRESS -> CERTIFIED -> CLOSED`

Snag transitions do not:

- create new workpack states
- modify workpack transition rules
- bypass certification
- alter CLOSED behavior

Snag handling is a blocking and operational concern, not a replacement lifecycle for workpacks.

## CLOSED Snag Does Not Imply CLOSED Workpack

A snag in `CLOSED` state means only that the snag itself is closed.

It does not mean:

- the workpack is closed
- the workpack is certified
- the workpack can bypass close checks
- any task lifecycle requirement has been satisfied

Workpack closure remains governed by the locked workpack lifecycle and all associated certification and close-enforcement rules.

## Unresolved Snags and Workpack Close

Unresolved snags must block workpack close.

For close-enforcement purposes, unresolved means any snag not in `CLOSED`.

Therefore:

- `OPEN` snags block workpack close
- `IN_PROGRESS` snags block workpack close
- `RESOLVED` snags still block workpack close until formally closed
- only `CLOSED` snags stop blocking workpack close

This is a close-enforcement rule only.

It does not alter the workpack lifecycle itself and does not introduce any new workpack lifecycle state.

## Invariants

The following invariants are locked by this phase:

- snag lifecycle is `OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED`
- only defined forward transitions are allowed
- snag lifecycle is separate from task lifecycle
- snag lifecycle is separate from workpack lifecycle
- `CLOSED` snag does not imply `CLOSED` workpack
- unresolved snags block workpack close

## Final Statement

Phase 11.2 defines snags as a separate defect lifecycle with states `OPEN`, `IN_PROGRESS`, `RESOLVED`, and `CLOSED`, operating independently of task and workpack lifecycle logic, while still enforcing that non-closed snags block workpack close.
