# Phase 10.12G - Apply Workpack Closed Status Decision

## Phase

- Active Phase: 10.12G - Apply Workpack Closed Status Decision
- Mode: IMPLEMENT
- Execution Type: READ-ONLY documentation phase

## Scope

This phase applies the locked Phase 10.12F decision to the Jupiter workpack lifecycle definition.

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

## Decision Applied

Applied branch:

- `ADD CLOSED STATUS TO rf_workpack_status`

No other branch is applied in this phase.

## 1. Final Workpack Lifecycle Meaning

Workpack lifecycle must treat certification and final administrative close as separate states.

Required meaning:

- `CERTIFIED` = execution and certification requirements have passed
- `CLOSED` = final administrative close has completed

Meaning:

- a workpack is not finally closed merely because it is `CERTIFIED`
- certification happens before final close
- close must use a distinct final status

## 2. Final Workpack Close Transition

The final approved close transition must be:

- `IN_PROGRESS -> CERTIFIED`
- `CERTIFIED -> CLOSED`

This removes ambiguity by making:

- `CERTIFIED` the pre-close certified state
- `CLOSED` the final administrative state

## 3. Required rf_workpack_status Outcome

To apply the decision correctly, `rf_workpack_status` must contain:

- `CLOSED`

This status must be added as a reference/status-data phase, not reinterpreted from another existing code.

This phase does not perform that change.

## 4. Phase 10.5 Close Enforcement Behavior

After the status decision is applied in implementation, Phase 10.5 close enforcement must behave as follows:

### 4.1 Entry Condition

Close must only be attempted from:

- `workpack.status = CERTIFIED`

### 4.2 Immediate Pre-Close Validation

Immediately before close, all of the following must still pass:

- all `task_cards.status` values are `CERTIFIED_BY_ENGINEER` or `LOCKED`
- all `workpack_executions.status` values are `CERTIFIED_BY_ENGINEER`
- all applicable compliance items are `COMPLETED`
- all related snags are `CLOSED`
- `certified_by` exists
- `certified_at` exists

### 4.3 Success Outcome

If all close checks pass:

- `workpack.status -> CLOSED`

### 4.4 Failure Outcome

If any close check fails:

- do not close
- do not change status
- return blocking errors

## 5. Certification Behavior Must Remain Separate

Certification must remain separate from final close.

Required certification behavior:

- workpack may become `CERTIFIED` only when certification-state rules pass
- certification stores:
  - `certified_by`
  - `certified_at`
- certification does not itself mean the workpack is administratively closed

This means:

- certification is not a substitute for close
- close must not overwrite the meaning of `CERTIFIED`

## 6. UI Display Meaning For Final State

The execution and workpack UI must display final workpack states with distinct meanings.

Required display meaning:

- `CERTIFIED`
  - workpack is fully certified
  - eligible for final close if close rules still pass
  - not yet the final administrative state
- `CLOSED`
  - final administrative close completed
  - workpack is no longer pending close
  - UI must present this as terminal

UI meaning must not imply:

- `RELEASED = CLOSED`
- `CERTIFIED = CLOSED`

## 7. RELEASED Must Not Be Used As Close Alias

This phase applies the 10.12F decision that:

- `RELEASED` is not the approved administrative close state

Therefore:

- close logic must not substitute `RELEASED` for `CLOSED`
- UI must not label `RELEASED` as the approved final close state
- any future use of `RELEASED` must remain separate unless explicitly redesigned in a later approved phase

## 8. Ambiguity Removed

After this decision is implemented in a later change phase, the workpack states must be interpreted as:

- `CERTIFIED` = certified and close-ready, subject to immediate revalidation
- `CLOSED` = final administrative close completed

This removes the previous ambiguity where:

- `CERTIFIED` was being used as both certification state and final close state

## 9. Required Follow-Up Implementation Scope

The next implementation phase applying this document must:

- add `CLOSED` to `rf_workpack_status`
- verify the inserted status exists in live reference data
- align lifecycle transitions to use `CERTIFIED -> CLOSED`
- align close enforcement to require `CERTIFIED` before final close
- align UI display to distinguish `CERTIFIED` from `CLOSED`

## 10. Summary

- the applied branch is `ADD CLOSED STATUS TO rf_workpack_status`
- certification and close remain separate
- final administrative close must end at `CLOSED`
- Phase 10.5 close enforcement must run from `CERTIFIED` and transition only to `CLOSED`
- UI must clearly distinguish `CERTIFIED` from `CLOSED`
- `RELEASED` must not be used as a substitute for the approved close state

## Verification

- Phase 10.12F decision read and applied: PASS
- exactly one branch applied: PASS
- final close transition defined: PASS
- Phase 10.5 close enforcement behavior defined: PASS
- UI final-state meaning defined: PASS
- certification and close kept separate: PASS
- ambiguity between `CERTIFIED` and final administrative state removed in the design: PASS
