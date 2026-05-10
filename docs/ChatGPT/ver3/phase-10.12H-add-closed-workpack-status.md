# Phase 10.12H - Add CLOSED Workpack Status

## Phase

- Active Phase: 10.12H - Add CLOSED Workpack Status
- Mode: IMPLEMENT
- Execution Type: READ-ONLY documentation phase

## Scope

This phase defines the missing `CLOSED` workpack status required by the approved Phase 10 execution model.

This phase does not change:

- code
- schema
- migrations
- models
- services
- controllers
- UI
- live data

## Files Checked

- `docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md`
- `docs/ChatGPT/ver3/phase-10.12F-workpack-closed-status-decision.md`
- `docs/ChatGPT/ver3/phase-10.12G-apply-workpack-closed-status-decision.md`

## 1. CLOSED Workpack Status

Required status:

- `CLOSED`

Required label meaning:

- final administrative close completed

`CLOSED` must exist as a distinct workpack status in `rf_workpack_status`.

## 2. Meaning Of CLOSED

`CLOSED` means:

- the workpack was already certified
- all final close validations passed
- final administrative close has been completed
- the workpack is in its terminal post-close state

`CLOSED` does not mean:

- pre-close certified only
- merely released for operational use
- an alternate name for `CERTIFIED`

## 3. Final Administrative State

`CLOSED` is the final administrative state.

Meaning:

- no additional normal execution actions are allowed
- no further close action is allowed
- no further certification action is allowed
- the workpack is no longer pending final administrative processing

## 4. No Further Actions Allowed

After `workpack.status = CLOSED`:

- no workpack close action may run again
- no workpack certification action may run again
- no workpack execution reopening may occur through normal lifecycle paths
- no planner or execution workflow may treat the workpack as still active

This preserves `CLOSED` as terminal.

## 5. Required Transition

The required final close transition is:

- `CERTIFIED -> CLOSED`

This phase preserves the already approved earlier transition:

- `IN_PROGRESS -> CERTIFIED`

Meaning:

- close must never jump directly from `IN_PROGRESS` to `CLOSED`
- certification and final administrative close remain separate lifecycle steps

## 6. Relationship With RELEASED

Required relationship:

- `RELEASED = pre-close operational state`
- `CLOSED = final administrative state`

Applied interpretation:

- `RELEASED` must not be used as a substitute for `CLOSED`
- `RELEASED` must not collapse the distinction between certified/released operations and final administrative close
- `CLOSED` is the approved final state for Phase 10 close enforcement

## 7. Relationship With CERTIFIED

Required relationship:

- `CERTIFIED` is not final close
- `CERTIFIED` is the state reached when certification requirements pass
- `CLOSED` is the state reached only after final close enforcement passes

Meaning:

- `CERTIFIED` remains the pre-close certified state
- `CLOSED` removes the previous ambiguity where `CERTIFIED` was acting like both certification and final close

## 8. Schema Impact

Required schema/reference-data impact:

- `rf_workpack_status` must include `CLOSED`

This is a status-reference addition, not a model redesign.

No existing workpack status meaning should be silently reassigned to avoid adding `CLOSED`.

## 9. Future Migration Requirement

The required future migration behavior is:

- idempotently insert `CLOSED`
- do not alter existing statuses

Required migration behavior details:

- insert only if `CLOSED` does not already exist
- preserve all current status rows
- do not rename `RELEASED`
- do not delete `RELEASED`
- do not change existing status IDs except as naturally assigned to the new inserted row

## 10. Close Enforcement After CLOSED Exists

Once `CLOSED` exists, Phase 10.5 close enforcement must behave as follows:

- entry condition:
  - `workpack.status = CERTIFIED`
- validation must pass immediately before close:
  - all `task_cards.status` values are `CERTIFIED_BY_ENGINEER` or `LOCKED`
  - all `workpack_executions.status` values are `CERTIFIED_BY_ENGINEER`
  - all applicable compliance items are `COMPLETED`
  - all related snags are `CLOSED`
  - `certified_by` exists
  - `certified_at` exists
- success:
  - `workpack.status -> CLOSED`
- failure:
  - do not close
  - return blocking errors

## 11. Enforcement Rules After CLOSED

After `CLOSED` exists and is active in the lifecycle:

- `CLOSED` must be terminal
- no transition may move from `CLOSED` back to:
  - `CERTIFIED`
  - `IN_PROGRESS`
  - `ISSUED`
  - `DRAFT`
- no execution workflow may continue mutating the workpack as active work
- document, reporting, and visibility layers must treat `CLOSED` as final administrative close

## 12. UI Behavior For CLOSED

UI must display `CLOSED` as:

- final
- terminal
- no further actions available

Required UI behavior:

- show a final closed badge/state
- hide close controls
- hide certification controls
- do not present the workpack as still pending finalization
- distinguish clearly between:
  - `CERTIFIED`
  - `CLOSED`

UI must not imply:

- `CERTIFIED = CLOSED`
- `RELEASED = CLOSED`

## 13. Summary

- `CLOSED` is the required final administrative workpack state
- no further normal actions are allowed after `CLOSED`
- the final close transition is `CERTIFIED -> CLOSED`
- `RELEASED` must not replace `CLOSED`
- `rf_workpack_status` must include `CLOSED`
- the future migration must idempotently insert `CLOSED` without altering existing statuses
- close enforcement and UI behavior must treat `CLOSED` as terminal and distinct from `CERTIFIED`

## Verification

- `CLOSED` status defined: PASS
- final administrative meaning defined: PASS
- no-further-actions rule defined: PASS
- `CERTIFIED -> CLOSED` transition defined: PASS
- `RELEASED` relationship defined: PASS
- schema impact defined: PASS
- future migration requirement defined: PASS
- post-`CLOSED` enforcement rules defined: PASS
- UI behavior for `CLOSED` defined: PASS
