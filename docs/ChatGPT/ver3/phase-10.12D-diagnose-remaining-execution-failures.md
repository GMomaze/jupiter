# Phase 10.12D - Diagnose Remaining Execution Final Verification Failures

## Phase

- Active Phase: 10.12D - Diagnose Remaining Execution Final Verification Failures
- Mode: IMPLEMENT
- Execution Type: READ-ONLY diagnosis phase

## Scope

This phase diagnoses only the remaining failed checks confirmed in Phase 10.12.

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
- `docs/ChatGPT/ver3/phase-10.12-execution-system-final-verification.md`
- `docs/ChatGPT/ver3/phase-10.12A-workpack-certification-fix.md`
- `docs/ChatGPT/ver3/phase-10.12B-close-enforcement-fix.md`
- `docs/ChatGPT/ver3/phase-10.12C-ui-enforcement-fix.md`

## Remaining Failed Checks From Phase 10.12

The only remaining failed checks from Phase 10.12 are:

- workpack certification
- close enforcement
- UI enforcement

All other Phase 10.12 verification areas were already `PASS` and are out of scope for this diagnosis.

## Failure 1 - Workpack Certification

- Category: `workpack certification`
- Priority: `HIGH`

### Expected Behavior

Workpack certification must allow:

- all `task_cards.status` values to be `CERTIFIED_BY_ENGINEER` or `LOCKED`
- all related `workpack_executions.status` values to be `CERTIFIED_BY_ENGINEER`
- all applicable compliance items to be complete
- all related snags to be closed
- workpack certification metadata to exist

### Actual Behavior

Phase 10.12 confirmed that the active workpack certification path:

- requires every task to be exactly `CERTIFIED_BY_ENGINEER`
- rejects `LOCKED` task cards as certification-ready
- does not verify execution certification state before setting `workpack.status -> CERTIFIED`

### Root Cause

The current certification gate still reflects an older task-only readiness rule:

- terminal task-state handling was not updated to count `LOCKED` as valid after engineer certification
- execution-row certification readiness was never added to the gate
- certification behavior remains embedded in a path that was not fully aligned with the approved Phase 10 certification contract

### Impacted Files, Components, and Tables

- `src/modules/workpacks/services/workpack-lifecycle.service.ts`
- `src/modules/workpacks/workpack.controller.ts`
- `workpacks`
- `task_cards`
- `workpack_executions`
- `workpack_compliance`
- `workpack_snags`

### Fix Direction

- update certification validation to accept `CERTIFIED_BY_ENGINEER` and `LOCKED` task states
- add mandatory validation that all related `workpack_executions.status = CERTIFIED_BY_ENGINEER`
- preserve compliance, snag, and certification metadata requirements
- keep the fix limited to workpack certification-state enforcement

## Failure 2 - Close Enforcement

- Category: `close enforcement`
- Priority: `CRITICAL`

### Expected Behavior

Workpack close enforcement must:

- validate immediately before close
- allow close only when all tasks are `CERTIFIED_BY_ENGINEER` or `LOCKED`
- require all related `workpack_executions.status = CERTIFIED_BY_ENGINEER`
- require all applicable compliance items to be complete
- require all related snags to be closed
- require certification metadata to exist
- end with `workpack.status -> CLOSED`

### Actual Behavior

Phase 10.12 confirmed that the active close path:

- transitions the workpack to `CERTIFIED`, not `CLOSED`
- requires every task to be exactly `CERTIFIED_BY_ENGINEER`
- does not accept `LOCKED` task cards as valid close-ready states
- does not verify all related `workpack_executions.status`

### Root Cause

The current close path is still coupled to an older certification-oriented transition:

- certification and close are blended into one lifecycle action
- the terminal workpack state used by the active close path is still `CERTIFIED`
- the task readiness predicate was not updated for `LOCKED`
- execution-state validation was omitted from the close gate

### Impacted Files, Components, and Tables

- `src/modules/workpacks/services/workpack-lifecycle.service.ts`
- `src/modules/workpacks/workpack.controller.ts`
- `src/views/workpacks/execution.ejs`
- `workpacks`
- `task_cards`
- `workpack_executions`
- `workpack_compliance`
- `workpack_snags`

### Fix Direction

- separate close enforcement from certification-state behavior
- restore the approved final close outcome `workpack.status -> CLOSED`
- accept `CERTIFIED_BY_ENGINEER` and `LOCKED` as valid terminal task states for close
- require all related execution rows to be certified before close
- preserve compliance, snag, and metadata enforcement

## Failure 3 - UI Enforcement

- Category: `UI enforcement`
- Priority: `HIGH`

### Expected Behavior

The execution UI must:

- show only valid actions for each lifecycle state
- treat `LOCKED` as a visible valid terminal task state
- treat `LOCKED` as close-ready where the approved backend rules allow it
- expose the lock action if lock remains part of the approved execution-page lifecycle
- keep locked tasks fully read-only

### Actual Behavior

Phase 10.12 confirmed that the active execution UI:

- treats only exact `CERTIFIED_BY_ENGINEER` as close-ready
- does not count `LOCKED` tasks as valid terminal close-ready states
- does not expose a lock action in the execution page even though `CERTIFIED_BY_ENGINEER -> LOCKED` is part of the approved lifecycle

### Root Cause

The page-level readiness and action display rules still reflect older lifecycle assumptions:

- close-readiness logic was written before `LOCKED` was treated as an approved terminal task state
- execution-page controls were not updated to surface the lock step
- UI predicates are not fully aligned with the approved backend terminal-state rules

### Impacted Files, Components, and Tables

- `src/views/workpacks/execution.ejs`
- `src/modules/workpacks/workpack.controller.ts`
- execution page close-readiness presentation
- execution page task action visibility

### Fix Direction

- update page readiness logic so `LOCKED` counts as a valid terminal close-ready state
- expose the lock action only if it remains part of the approved execution-page flow and only for authorized users
- preserve read-only behavior for locked tasks
- keep UI behavior aligned with service-side authority and lifecycle enforcement

## Diagnosis Summary

- `workpack certification` remains failed because locked tasks are not accepted and execution certification readiness is not validated
- `close enforcement` remains failed because the active close path still ends at `CERTIFIED` instead of `CLOSED` and does not enforce the approved final close contract
- `UI enforcement` remains failed because the execution page still treats `LOCKED` as not close-ready and does not fully surface the approved lifecycle

## Verification

- all remaining failed checks from Phase 10.12 identified: PASS
- expected vs actual behavior documented: PASS
- root cause documented: PASS
- impacted files, components, and tables documented: PASS
- bounded fix direction documented: PASS
- category assigned for each failure: PASS
- priority assigned for each failure: PASS
- unrelated passing areas excluded from diagnosis scope: PASS
