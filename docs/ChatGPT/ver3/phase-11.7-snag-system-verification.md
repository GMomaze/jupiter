# Phase 11.7 - Snag System Verification

## Status

DEFINE ONLY

This phase defines how the Jupiter snag system must be verified end to end.

This phase does not implement code, change schema, alter lifecycle behavior, or modify the locked behavior of Phase 10.12 or Phase 11.1 through Phase 11.6.

## Purpose

Snag system verification exists to confirm that snag creation, linkage, execution visibility, lifecycle transitions, recurring detection, and close blocking all work together correctly without altering the locked lifecycle core.

This phase defines the required verification flow, blocking checks, recurrence checks, independence checks, UI expectations, and invariants.

## End-to-End Verification Flow

The required verification flow is:

1. create snag
2. link snag to workpack
3. view snag in execution
4. move snag `OPEN -> IN_PROGRESS`
5. move snag `IN_PROGRESS -> RESOLVED`
6. move snag `RESOLVED -> CLOSED`

Each step must be verifiable and must preserve the separate snag lifecycle.

## Creation Verification

Verification must confirm that:

- a snag can be created with the required fields
- the snag starts in `OPEN`
- the snag can exist independently
- the snag can be linked to a workpack

The creation check must also confirm that snag creation does not automatically create tasks, change workpack lifecycle state, or trigger task execution lifecycle.

## Linkage Verification

Verification must confirm that a snag linked to a workpack is treated as a workpack-linked snag for execution visibility and close validation.

This includes confirming that:

- linked snags appear in the correct workpack context
- independent snags remain outside unrelated workpack scope

## Execution Visibility Verification

Verification must confirm that the linked snag is visible on the execution page.

This includes confirming that:

- the snag appears in execution
- the snag is distinguishable from tasks
- snag status is displayed
- snag defect information is displayed
- component information is shown where present

## Snag Lifecycle Transition Verification

The snag lifecycle must be verified step by step:

- `OPEN -> IN_PROGRESS`
- `IN_PROGRESS -> RESOLVED`
- `RESOLVED -> CLOSED`

Verification must confirm that:

- only allowed transitions are accepted
- each transition results in the correct next status
- no task lifecycle state changes occur as a side effect
- no workpack lifecycle state changes occur as a side effect

## Close Enforcement Verification

The required workpack-close verification flow is:

- attempt to close workpack with `OPEN` snag -> blocked
- attempt to close workpack with `IN_PROGRESS` snag -> blocked
- attempt to close workpack with `RESOLVED` snag -> blocked
- close succeeds only when all snags are `CLOSED`

These checks must confirm that snag close enforcement is active at workpack close validation and nowhere else.

## Close Blocking Verification Details

Verification must confirm all of the following:

- linked `OPEN` snags block workpack close
- linked `IN_PROGRESS` snags block workpack close
- linked `RESOLVED` snags block workpack close
- linked `CLOSED` snags do not block workpack close
- workpack close succeeds only after every linked snag is `CLOSED`

The verification must also confirm that the close block does not mutate snag status automatically.

## Recurrence Verification

The required recurrence verification flow is:

1. create the same snag multiple times on the same aircraft
2. verify occurrence count
3. verify recurring indicator appears

This confirms that recurring snag detection is derived from historical aircraft-level snag history.

## Recurrence Verification Details

Verification must confirm that:

- recurrence counts are based on the same aircraft
- repeated matching or normalized defect patterns increase occurrence count
- the threshold `occurrence_count >= 2` causes recurrence to be indicated
- the recurring indicator is visible in execution
- the count is displayed clearly

Verification must also confirm that recurrence remains informational only.

## Independence Verification

The required independence test is:

- independent snag does not block unrelated workpack

This must confirm that snag close blocking is scoped only to snags linked to the target workpack.

Verification must show that:

- independently created snags remain independent unless explicitly linked
- an unrelated workpack is not blocked by an independent snag with no link to that workpack

## UI Verification Expectations

The UI verification must confirm:

- snags are visible in execution
- clear separation from tasks
- correct action buttons
- correct status transitions

This includes confirming that:

- snag rows or sections are distinct from task rows or sections
- snag actions are labeled as snag actions
- task completion and snag resolution are not visually conflated
- the available snag buttons match the current snag status

## Action Button Verification

Verification must confirm correct snag execution controls:

- `OPEN` snag shows start action where appropriate
- `IN_PROGRESS` snag shows resolve action where appropriate
- `RESOLVED` snag is clearly shown as resolved until closed
- snag controls do not appear as task controls

## Blocking Message Verification

Verification must confirm that when workpack close is blocked by linked snags:

- the user sees a clear blocking message
- the reason identifies unresolved snags
- the user can understand why close failed

## Invariants

The following invariants must remain true throughout verification:

- no lifecycle changes
- no automatic actions
- no unintended side effects

Interpretation:

- snag verification must not modify the locked workpack lifecycle
- snag verification must not modify the locked task lifecycle
- snag verification must not introduce automatic task creation, snag closure, certification, or workpack progression
- each verified behavior must be explicit and scoped to the snag system definition

## Non-Effect Verification

Verification must explicitly confirm the absence of unintended automation:

- no auto-create tasks
- no auto-close snags
- no auto-change snag lifecycle
- no auto-change task lifecycle
- no auto-change workpack lifecycle
- no auto-block unrelated workpacks

## Final Acceptance Conditions

Phase 11.7 verification is satisfied only when all of the following are true:

- snag creation works as defined
- linked snags appear in execution
- snag lifecycle transitions work correctly
- close blocking works for linked unresolved snags
- close succeeds only when linked snags are `CLOSED`
- recurring snag detection shows count and indicator
- independent snags do not block unrelated workpacks
- UI remains clear and separate from task handling
- no unintended lifecycle or automation side effects occur

## Final Statement

Phase 11.7 defines snag system verification as the full end-to-end confirmation that snag creation, linkage, execution visibility, lifecycle transitions, recurring detection, close blocking, and independence rules all behave correctly while preserving separate snag behavior, clear UI separation, and the locked task and workpack lifecycle core.
