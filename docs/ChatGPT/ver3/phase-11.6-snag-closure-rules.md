# Phase 11.6 - Snag Closure Rules

## Status

DEFINE ONLY

This phase defines how snag closure status affects workpack close validation within Jupiter.

This phase does not implement code, change schema, alter lifecycle behavior, or modify the locked behavior of Phase 10.12 or Phase 11.1 through Phase 11.5.

## Purpose

Snag closure rules ensure that a workpack cannot be finally closed while linked snags remain unresolved in the snag lifecycle.

This phase defines the blocking rule, accepted snag end-state requirement, scope of enforcement, UI expectations, and non-effects.

## Core Rule

A workpack cannot be `CLOSED` if any linked snag is not `CLOSED`.

This is the locked snag-closure rule for Phase 11.6.

## Acceptable Snag State Before Workpack Close

Before a workpack may be closed:

- all linked snags must be `CLOSED`

No other snag state is acceptable for final workpack close.

## Blocking Conditions

The following linked snag states block workpack close:

- `OPEN`
- `IN_PROGRESS`
- `RESOLVED`

Interpretation:

- `OPEN` snags block close because they have not entered active handling
- `IN_PROGRESS` snags block close because corrective work is still underway
- `RESOLVED` snags still block close because they must be formally moved to `CLOSED`

`RESOLVED` is not sufficient for workpack close.

## Validation Timing

The block occurs at workpack close validation only.

This means:

- snag status is checked when the system validates a close attempt
- the validation may prevent the close action from completing
- the rule does not itself move the workpack into another lifecycle state

## Lifecycle Boundary

This rule does not alter workpack lifecycle states.

The locked workpack lifecycle remains:

`DRAFT -> ISSUED -> IN_PROGRESS -> CERTIFIED -> CLOSED`

The snag closure rule adds a close-validation requirement only.

It does not:

- create a new workpack lifecycle state
- rename a workpack lifecycle state
- skip a workpack lifecycle state
- automatically transition the workpack backward or forward

## Scope

This rule applies only to snags linked to the workpack being closed.

That means:

- only snags whose `workpack_id` references the target workpack participate in the blocking check
- independently created snags do not block unrelated workpacks
- snags attached to other workpacks do not block the current workpack

## Linked-Snag Interpretation

For Phase 11.6, a snag is considered relevant to workpack close only when it is linked to that specific workpack.

Independent snag records remain outside the close-validation scope of unrelated workpacks unless they are explicitly linked.

## UI Requirement

When workpack close is blocked by snags:

- the user must see a clear blocking message
- the blocking reason must list unresolved snags

The UI must make it clear that workpack close failed because one or more linked snags are not yet `CLOSED`.

## Blocking Message Expectation

The blocking feedback should communicate both:

- that workpack close is blocked
- which snag conditions are still unresolved

At minimum, the user-facing result must identify that unresolved linked snags exist.

Where practical, the blocking output should list the unresolved snags or summarize them clearly enough for the user to act on them.

## Non-Effects

This rule does not:

- auto-close snags
- auto-change snag lifecycle
- auto-create tasks

This means:

- the system must not force a snag from `RESOLVED` to `CLOSED`
- the system must not mutate snag state simply because a workpack close was attempted
- the system must not create follow-up maintenance tasks as part of the block itself

## Additional Non-Effects

This rule also does not:

- auto-certify a workpack
- auto-reopen a workpack
- auto-resolve a snag
- auto-assign snag ownership

It is strictly a validation gate at close time.

## Audit Interpretation

The close block is derived from current linked snag states at validation time.

The rule relies on the existing snag records and their lifecycle states rather than inventing a separate stored blocking status.

## Invariants

The following invariants are established by Phase 11.6:

- a workpack cannot be closed if any linked snag is not `CLOSED`
- all linked snags must be `CLOSED` before workpack close
- `OPEN` linked snags block close
- `IN_PROGRESS` linked snags block close
- `RESOLVED` linked snags block close
- the block is enforced at workpack close validation only
- the rule does not alter workpack lifecycle states
- the rule applies only to snags linked to the target workpack
- independent snags do not block unrelated workpacks
- the user must receive a clear blocking message
- unresolved snag reasons must be listed or clearly summarized
- the rule does not auto-close snags
- the rule does not auto-change snag lifecycle
- the rule does not auto-create tasks

## Final Statement

Phase 11.6 defines snag closure enforcement as a workpack close-validation rule under which every snag linked to the target workpack must already be `CLOSED`, with `OPEN`, `IN_PROGRESS`, and `RESOLVED` snags all blocking workpack close, while independent snags remain out of scope and no automatic lifecycle mutation, task creation, or snag closure is performed by the block itself.
