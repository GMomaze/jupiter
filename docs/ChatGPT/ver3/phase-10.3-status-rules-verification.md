# Phase 10.3 - Status Rules Verification

## Phase

- Active Phase: 10.3 - Status Rules Verification
- Mode: IMPLEMENT
- Execution Type: VERIFY only

## Scope

This phase verifies the currently implemented Jupiter execution status rules using read-only inspection.

It covers:

- task lifecycle enforcement
- generated task lifecycle compatibility
- task status ownership
- execution status ownership
- UI transition exposure
- current consistency between `task_cards` and `workpack_executions`

This phase does not change code, schema, models, services, routes, or UI.

## Files Checked

- `docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md`
- `docs/ChatGPT/ver3/phase-10.1-current-execution-audit.md`
- `docs/ChatGPT/ver3/phase-10.2-generated-task-execution-compatibility.md`
- `src/modules/workpacks/services/task-execution.service.ts`
- `src/modules/workpacks/services/workpack-execution.service.ts`
- `src/modules/workpacks/services/workpack-generation.service.ts`
- `src/modules/workpacks/services/workpack-lifecycle.service.ts`
- `src/modules/workpacks/workpack.controller.ts`
- `src/views/workpacks/execution.ejs`
- `migrations/060_create_task_cards_table.ts`
- `migrations/310_create-workpack-executions.ts`

## 1. Target Rule Being Verified

Requested lifecycle:

- `OPEN -> IN_PROGRESS -> COMPLETED_BY_MECHANIC -> CERTIFIED_BY_ENGINEER -> LOCKED`

Expected ownership:

- `task_cards.status` owns the full lifecycle including `LOCKED`
- `workpack_executions.status` must not include `LOCKED`

## 2. Lifecycle Enforcement Verification

Current `TaskExecutionService` enforces the forward task lifecycle as follows:

### Start

- only `OPEN` tasks can start
- invalid state throws `TASK_START_BLOCKED`
- next task status becomes `IN_PROGRESS`

### Complete

- only `IN_PROGRESS` tasks can complete
- invalid state throws `TASK_COMPLETE_BLOCKED`
- next task status becomes `COMPLETED_BY_MECHANIC`

### Certify

- only `COMPLETED_BY_MECHANIC` tasks can be certified
- invalid state throws `TASK_CERTIFY_BLOCKED`
- next task status becomes `CERTIFIED_BY_ENGINEER`

### Lock

- only `CERTIFIED_BY_ENGINEER` tasks can lock in the intended flow
- current code also allows legacy `SIGNED`
- invalid state throws `TASK_LOCK_BLOCKED`
- next task status becomes `LOCKED`

Verification result:

- forward lifecycle is enforced in service logic
- legacy `SIGNED` remains accepted in the lock step

## 3. task_cards.status Ownership Verification

Current task lifecycle state is owned by:

- `task_cards.status`

Verified states used on `task_cards.status`:

- `OPEN`
- `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`
- `LOCKED`

Execution UI and task action decisions are driven from `task_cards.status`, not from `workpack_executions.status`.

Verification result:

- `task_cards.status` owns the full visible lifecycle including `LOCKED`

## 4. workpack_executions.status LOCKED Exclusion Verification

Current `workpack_executions.status` constraint allows only:

- `OPEN`
- `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`

`LOCKED` is excluded by the current migration check constraint.

`WorkpackExecutionService.mapTaskStatusToExecutionStatus(...)` also maps:

- `LOCKED -> CERTIFIED_BY_ENGINEER`

Verification result:

- `workpack_executions.status` does not include `LOCKED`

## 5. No Code Sets workpack_executions.status = LOCKED

Verified status assignment behavior:

- generation creates `workpack_executions.status = OPEN`
- task start sets `workpack_executions.status = IN_PROGRESS`
- task complete sets `workpack_executions.status = COMPLETED_BY_MECHANIC`
- task certify sets `workpack_executions.status = CERTIFIED_BY_ENGINEER`
- note-save path remaps from task status through `mapTaskStatusToExecutionStatus(...)`

No audited code path assigns:

- `workpack_executions.status = LOCKED`

Verification result:

- no current code sets execution status to `LOCKED`

## 6. Service Logic Invalid Transition Blocking

Current service logic blocks invalid transitions:

- start blocked unless task is `OPEN`
- complete blocked unless task is `IN_PROGRESS`
- certify blocked unless task is `COMPLETED_BY_MECHANIC`
- lock blocked unless task is `CERTIFIED_BY_ENGINEER` or legacy `SIGNED`
- note editing blocked once task is `CERTIFIED_BY_ENGINEER` or `LOCKED`

Verification result:

- invalid forward transitions are actively blocked
- legacy `SIGNED` remains a deviation from the target simplified rule

## 7. Generated Task Lifecycle Verification

Generated tasks are created by `WorkpackGenerationService` as normal `task_cards` with:

- `status = OPEN`

Because generated tasks are normal `task_cards` linked through normal `workpack_tasks` and normal `workpack_executions`, they use the same runtime task lifecycle as all other executable tasks.

Verification result:

- generated tasks follow the same lifecycle rules

## 8. UI Transition Exposure Verification

Current `/workpacks/:id/execution` UI exposes only these actions:

- `OPEN` -> `Start Task`
- `IN_PROGRESS` -> `Complete (Mechanic)`
- `COMPLETED_BY_MECHANIC` -> `Certify (Engineer Sign)`

The page also makes tasks read-only after:

- `CERTIFIED_BY_ENGINEER`
- `LOCKED`

Important UI observation:

- no `LOCK` button is exposed on the execution page even though `TaskExecutionService.lockTask(...)` exists

Verification result:

- UI exposes only valid forward execution actions
- UI does not expose an invalid direct jump
- lock capability is not represented as a visible execution-page action

## 9. Invalid Status Record Verification

### workpack_executions

Current schema check constraint prevents invalid stored values outside:

- `OPEN`
- `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`

This means `workpack_executions` is structurally protected against invalid status values such as `LOCKED`.

### task_cards

Current audit did not identify a matching schema-level check constraint for `task_cards.status`.

Task status correctness is enforced primarily by service logic and UI flow, not by an audited DB status check constraint on `task_cards`.

Verification result:

- no invalid execution status values are allowed in `workpack_executions`
- full live-data proof of “no invalid task status records exist anywhere” was not established in this phase

## 10. task_cards vs workpack_executions Consistency Verification

Current expected design is:

- task cards may reach `LOCKED`
- execution rows must stop at `CERTIFIED_BY_ENGINEER`

Current actual behavior:

- when task is locked, `task_cards.status = LOCKED`
- `workpack_executions.status` remains `CERTIFIED_BY_ENGINEER`

This means the two tables intentionally diverge at the terminal task state.

That divergence is already reflected in:

- `WorkpackExecutionService.mapTaskStatusToExecutionStatus(...)`
- execution audit findings from Phase 10.1

Verification result:

- inconsistent terminal state exists between `task_cards` and `workpack_executions`

## 11. Verification Results

- lifecycle enforced as `OPEN -> IN_PROGRESS -> COMPLETED_BY_MECHANIC -> CERTIFIED_BY_ENGINEER -> LOCKED`: PASS
- `task_cards.status` owns full lifecycle including `LOCKED`: PASS
- `workpack_executions.status` does not include `LOCKED`: PASS
- no code sets `workpack_executions.status = LOCKED`: PASS
- service logic blocks invalid transitions: PASS
- generated tasks follow same lifecycle: PASS
- UI actions only expose valid transitions: PASS
- no invalid status records exist: FAIL
- no inconsistent states exist between `task_cards` and `workpack_executions`: FAIL

## 12. Conclusion

Jupiter’s current status rules are mostly enforced as designed for the active execution flow:

- task lifecycle progresses in the correct forward order
- generated tasks follow the same lifecycle
- execution rows correctly exclude `LOCKED`
- no code attempts to store `LOCKED` in `workpack_executions`

However, this phase cannot return a full pass because two requested conditions are not satisfied:

- “no invalid status records exist” was not fully provable for all live `task_cards` rows from this read-only audit alone
- terminal state consistency does not hold between `task_cards` and `workpack_executions`, because `LOCKED` exists only on task cards while execution rows remain `CERTIFIED_BY_ENGINEER`

Phase 10.3 result: `FAIL`
