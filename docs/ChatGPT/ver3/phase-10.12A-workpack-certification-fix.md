# Phase 10.12A - Workpack Certification Fix

## Phase

- Active Phase: 10.12A - Workpack Certification Fix
- Mode: IMPLEMENT
- Execution Type: READ-ONLY documentation phase

## Scope

This phase defines the required fix for the workpack certification path identified as failing in Phase 10.12.

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
- `docs/ChatGPT/ver3/phase-10.9-workpack-certification-state.md`
- `docs/ChatGPT/ver3/phase-10.12-execution-system-final-verification.md`

## 1. Failure Confirmed in Phase 10.12

Phase 10.12 confirmed that the active workpack certification path is not fully aligned with the approved certification-state rules.

Confirmed failures:

- workpack certification requires every task to be exactly `CERTIFIED_BY_ENGINEER`
- `LOCKED` tasks are not accepted as valid terminal task states for workpack certification
- workpack certification does not verify that all related `workpack_executions.status = CERTIFIED_BY_ENGINEER`

Meaning:

- the current implementation is stricter than the approved task-card terminal-state rule
- the current implementation is weaker than the approved execution-state validation rule

## 2. Approved Certification Rule to Restore

The approved workpack certification rule from Phase 10.9 is:

- `workpack.status -> CERTIFIED`

only when all of the following are true:

- all related `task_cards.status` values are `CERTIFIED_BY_ENGINEER` or `LOCKED`
- all related `workpack_executions.status` values are `CERTIFIED_BY_ENGINEER`
- all applicable compliance items are completed
- all related snags are `CLOSED`

This is the rule the implementation must be brought back into alignment with.

## 3. Required Fix Scope

The workpack certification fix must address only the certification-state gap confirmed in Phase 10.12.

Required fix scope:

- accept `LOCKED` task cards as valid certification-ready terminal task states
- validate execution certification state before workpack certification
- preserve compliance-complete validation
- preserve snag-closed validation
- preserve certification metadata requirements

This phase does not define broader close-state redesign or UI changes.

## 4. Task-State Certification Fix

Current failing behavior:

- certification blocks unless every task is exactly `CERTIFIED_BY_ENGINEER`

Required corrected behavior:

- certification must pass when every task is either:
  - `CERTIFIED_BY_ENGINEER`
  - `LOCKED`

Meaning:

- `LOCKED` must count as certification-ready because lock is only allowed after engineer certification
- workpack certification must not reject valid locked tasks

## 5. Execution-State Certification Fix

Current failing behavior:

- certification does not verify all related execution rows are certified

Required corrected behavior:

- certification must verify every related `workpack_executions.status = CERTIFIED_BY_ENGINEER`

Meaning:

- task-card state alone is not sufficient
- execution rows must confirm certified execution completion
- no workpack may become `CERTIFIED` while any execution remains:
  - `OPEN`
  - `IN_PROGRESS`
  - `COMPLETED_BY_MECHANIC`

## 6. Metadata Preservation

The fix must preserve workpack-level certification metadata requirements.

Required metadata on successful certification:

- `certified_by`
- `certified_at`

Meaning:

- no workpack may become `CERTIFIED` without certification evidence
- certification metadata must still be written atomically with the status transition

## 7. Failure Handling

If workpack certification validation fails:

- do not change workpack status
- do not set partial certification metadata
- return controlled blocking errors

Blocking errors must cover at least:

- tasks not certified or locked
- executions not certified
- compliance incomplete
- snags not closed
- certification metadata missing

## 8. Data Integrity Requirements

The certification fix must preserve these integrity guarantees:

- validation runs immediately before certification
- no bypass path may set `workpack.status = CERTIFIED` directly
- no partial certification update may occur
- locked tasks remain valid terminal task states
- execution rows never become `LOCKED`

## 9. Out of Scope for This Fix

This certification fix does not itself resolve:

- final close-state behavior using `CLOSED`
- execution-page close button behavior
- separate UI readiness presentation

Those remain separate failures documented in Phase 10.12.

## 10. Certification Fix Summary

- restore the approved certification rule that accepts both `CERTIFIED_BY_ENGINEER` and `LOCKED` task states
- add required validation that all related execution rows are `CERTIFIED_BY_ENGINEER`
- preserve compliance, snag, and metadata validation
- block certification cleanly if any rule fails
- keep the fix limited to workpack certification-state enforcement

## Verification

- certification failure from Phase 10.12 identified: PASS
- approved certification target state restated: PASS
- locked-task acceptance fix defined: PASS
- execution-state validation fix defined: PASS
- metadata preservation defined: PASS
- failure handling defined: PASS
- boundaries enforced: PASS
