# Phase 10.12B - Close Enforcement Fix

## Phase

- Active Phase: 10.12B - Close Enforcement Fix
- Mode: IMPLEMENT
- Execution Type: READ-ONLY documentation phase

## Scope

This phase defines the required fix for the workpack close-enforcement path identified as failing in Phase 10.12.

This phase does not change:

- code
- schema
- migrations
- models
- services
- controllers
- UI

## Files Checked

- `docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md`
- `docs/ChatGPT/ver3/phase-10.4-execution-completion-rules.md`
- `docs/ChatGPT/ver3/phase-10.5-workpack-close-enforcement.md`
- `docs/ChatGPT/ver3/phase-10.12-execution-system-final-verification.md`

## 1. Failure Confirmed in Phase 10.12

Phase 10.12 confirmed that the active workpack close-enforcement path is not aligned with the approved close rules.

Confirmed failures:

- active close logic transitions the workpack to `CERTIFIED`, not `CLOSED`
- active close logic requires every task to be exactly `CERTIFIED_BY_ENGINEER`
- active close logic does not accept `LOCKED` as a valid terminal task state
- active close logic does not verify all related `workpack_executions.status = CERTIFIED_BY_ENGINEER`

Meaning:

- the current close path does not implement the approved final close contract
- the current close path blends certification and close behavior together

## 2. Approved Close Rule to Restore

The approved close rule from Phases 10.4 and 10.5 is:

- `workpack.status -> CLOSED`

only when all of the following are true:

- all related `task_cards.status` values are `CERTIFIED_BY_ENGINEER` or `LOCKED`
- all related `workpack_executions.status` values are `CERTIFIED_BY_ENGINEER`
- all applicable compliance items are `COMPLETED`
- all related snags are `CLOSED`
- required certification metadata exists

This is the rule the implementation must be brought back into alignment with.

## 3. Required Fix Scope

The close-enforcement fix must address only the close gate and close transition gap confirmed in Phase 10.12.

Required fix scope:

- separate close enforcement from workpack certification logic
- enforce the approved `CLOSED` success state
- accept `LOCKED` task cards as valid close-ready terminal states
- validate execution certification state before close
- preserve compliance-complete validation
- preserve snag-closed validation
- preserve certification metadata validation

This phase does not define UI fixes or broader lifecycle redesign outside close enforcement.

## 4. Close State Fix

Current failing behavior:

- active close logic ends with `workpack.status -> CERTIFIED`

Required corrected behavior:

- successful close must end with `workpack.status -> CLOSED`

Meaning:

- close must be a distinct final workpack state
- certification and close must not be treated as the same transition
- a workpack must not appear merely certified when the close operation has actually completed

## 5. Task-State Close Fix

Current failing behavior:

- close blocks unless every task is exactly `CERTIFIED_BY_ENGINEER`

Required corrected behavior:

- close must pass when every task is either:
  - `CERTIFIED_BY_ENGINEER`
  - `LOCKED`

Meaning:

- `LOCKED` must count as close-ready because it is a valid final task-card state
- close must not reject valid locked tasks

## 6. Execution-State Close Fix

Current failing behavior:

- close does not verify all related execution rows are certified

Required corrected behavior:

- close must verify every related `workpack_executions.status = CERTIFIED_BY_ENGINEER`

Meaning:

- task-card state alone is not sufficient for close
- execution completion evidence must also be complete
- no workpack may close while any execution remains:
  - `OPEN`
  - `IN_PROGRESS`
  - `COMPLETED_BY_MECHANIC`

## 7. Compliance and Snag Preservation

The close-enforcement fix must preserve the already approved close prerequisites:

- all applicable compliance items are `COMPLETED`
- all related snags are `CLOSED`

Meaning:

- the fix must not weaken compliance gating
- the fix must not weaken snag closure gating

## 8. Certification Metadata Preservation

The close-enforcement fix must preserve certification evidence requirements.

Required metadata before successful close:

- `certified_by`
- `certified_at`

Meaning:

- close must not rely on task status text alone
- close must not succeed without certification evidence already present

## 9. Failure Handling

If close validation fails:

- do not change workpack status
- do not partially close the workpack
- return controlled blocking errors

Blocking errors must cover at least:

- tasks not certified or locked
- executions not certified
- compliance incomplete
- snags not closed
- certification metadata missing

## 10. Data Integrity Requirements

The close-enforcement fix must preserve these integrity guarantees:

- validation runs immediately before close
- no bypass path may set `workpack.status = CLOSED` directly
- no partial close update may occur
- `LOCKED` remains valid only on `task_cards`
- execution rows remain `CERTIFIED_BY_ENGINEER` and never become `LOCKED`

## 11. Out of Scope for This Fix

This close-enforcement fix does not itself resolve:

- execution-page UI readiness presentation
- lock-button visibility
- broader UI-hardening changes outside the close gate

Those remain separate concerns linked to the UI failure documented in Phase 10.12.

## 12. Close Enforcement Fix Summary

- restore the approved close rule that ends with `workpack.status = CLOSED`
- accept both `CERTIFIED_BY_ENGINEER` and `LOCKED` as valid terminal task states for close
- add required validation that all related execution rows are `CERTIFIED_BY_ENGINEER`
- preserve compliance, snag, and certification-metadata validation
- block close cleanly if any rule fails
- keep the fix limited to close-enforcement behavior

## Verification

- close failure from Phase 10.12 identified: PASS
- approved close target state restated: PASS
- close-state fix defined: PASS
- locked-task acceptance fix defined: PASS
- execution-state validation fix defined: PASS
- compliance and snag preservation defined: PASS
- failure handling defined: PASS
- boundaries enforced: PASS
