# Phase 10.4 - Execution Completion Rules

## Phase

- Active Phase: 10.4 - Execution Completion Rules
- Mode: IMPLEMENT
- Execution Type: READ-ONLY rules definition

## Scope

This phase defines the execution completion rules for Jupiter based on the currently verified execution lifecycle.

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
- `docs/ChatGPT/ver3/phase-10.1-current-execution-audit.md`
- `docs/ChatGPT/ver3/phase-10.2-generated-task-execution-compatibility.md`
- `docs/ChatGPT/ver3/phase-10.3-status-rules-verification.md`
- `docs/ChatGPT/ver3/phase-10.3A-live-status-data-integrity-verification.md`
- `docs/ChatGPT/ver3/phase-10.3D-status-rules-reverification.md`

## 1. Task Completion Rule

A task is considered completed for execution purposes only when:

- `task_cards.status = CERTIFIED_BY_ENGINEER`

Meaning:

- `OPEN` is not complete
- `IN_PROGRESS` is not complete
- `COMPLETED_BY_MECHANIC` is not complete
- `CERTIFIED_BY_ENGINEER` is the required completion state before any lock decision

## 2. Task Lock Rule

Task lock rules are:

- `LOCKED` is allowed only after `CERTIFIED_BY_ENGINEER`
- `LOCKED` is a final task-card state

Meaning:

- a task must not move directly to `LOCKED` from `OPEN`
- a task must not move directly to `LOCKED` from `IN_PROGRESS`
- a task must not move directly to `LOCKED` from `COMPLETED_BY_MECHANIC`
- once `task_cards.status = LOCKED`, the task is final and no further normal execution editing is allowed

## 3. Execution Completion Rule

Execution completion is defined separately from task lock.

Execution rule:

- `workpack_executions.status = CERTIFIED_BY_ENGINEER`

Execution never becomes:

- `LOCKED`

Meaning:

- task cards may end at `LOCKED`
- execution rows end at `CERTIFIED_BY_ENGINEER`
- `LOCKED` is a task-card finalization concept, not an execution-row status

## 4. Workpack Closure Rules

A workpack may close only when all of the following are true:

- all `task_cards` are `CERTIFIED_BY_ENGINEER` or `LOCKED`
- all `workpack_executions` are `CERTIFIED_BY_ENGINEER`
- all compliance items are completed, if applicable
- all snags are `CLOSED`

Practical interpretation:

- no task may remain `OPEN`
- no task may remain `IN_PROGRESS`
- no task may remain `COMPLETED_BY_MECHANIC`
- no execution row may remain `OPEN`
- no execution row may remain `IN_PROGRESS`
- no execution row may remain `COMPLETED_BY_MECHANIC`

## 5. Forbidden Close Conditions

Workpack closure is forbidden if any of the following exist:

- any `task_cards.status = OPEN`
- any `task_cards.status = IN_PROGRESS`
- any `task_cards.status = COMPLETED_BY_MECHANIC`
- any `workpack_executions.status = OPEN`
- any `workpack_executions.status = IN_PROGRESS`
- any `workpack_executions.status = COMPLETED_BY_MECHANIC`
- any required compliance item remains incomplete
- any snag remains not `CLOSED`
- any required certification step is missing

## 6. Certification Authority Requirements

Certification authority rules are:

- mechanic work completion may move a task to `COMPLETED_BY_MECHANIC`
- only authorized engineer certification may move a task to `CERTIFIED_BY_ENGINEER`
- only after engineer certification may a task be locked

Meaning:

- mechanic completion is necessary but not sufficient for final task completion
- engineer certification is the required authority for execution completion
- lock must not replace certification authority

## 7. Data Integrity Rules

Execution completion must preserve these integrity rules:

- every executable task must exist as a valid `task_cards` row
- every task assigned to a workpack must be linked through `workpack_tasks`
- every executable generated task must have a corresponding `workpack_executions` row
- `workpack_executions.status` must never use `LOCKED`
- no duplicate execution record may exist for the same `workpack_id + task_id + attempt_no`
- no orphan execution record may exist without a valid `workpack_task` relationship
- no invalid task status may exist outside:
  - `OPEN`
  - `IN_PROGRESS`
  - `COMPLETED_BY_MECHANIC`
  - `CERTIFIED_BY_ENGINEER`
  - `LOCKED`
- no invalid execution status may exist outside:
  - `OPEN`
  - `IN_PROGRESS`
  - `COMPLETED_BY_MECHANIC`
  - `CERTIFIED_BY_ENGINEER`

## 8. Completion Boundary

Completion and closure must be interpreted in this order:

1. task progresses to `COMPLETED_BY_MECHANIC`
2. engineer certifies task to `CERTIFIED_BY_ENGINEER`
3. task may optionally become `LOCKED`
4. execution row remains `CERTIFIED_BY_ENGINEER`
5. workpack may close only after all task, execution, compliance, and snag conditions are satisfied

## 9. Rules Summary

- task completion requires `task_cards.status = CERTIFIED_BY_ENGINEER`
- task lock is allowed only after `CERTIFIED_BY_ENGINEER`
- `LOCKED` is final on `task_cards`
- execution completion requires `workpack_executions.status = CERTIFIED_BY_ENGINEER`
- execution rows never become `LOCKED`
- workpack closure requires all tasks complete, all executions complete, all compliance complete if applicable, and all snags closed

## Verification

- task completion rule defined: PASS
- task lock rule defined: PASS
- execution completion rule defined: PASS
- workpack closure rules defined: PASS
- forbidden close conditions defined: PASS
- certification authority requirements defined: PASS
- data integrity rules defined: PASS
