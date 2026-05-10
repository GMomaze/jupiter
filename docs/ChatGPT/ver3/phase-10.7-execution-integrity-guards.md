# Phase 10.7 - Execution Integrity Guards

## Phase

- Active Phase: 10.7 - Execution Integrity Guards
- Mode: IMPLEMENT
- Execution Type: READ-ONLY documentation phase

## Scope

This phase defines the execution integrity guards that must protect Jupiter's execution chain.

This phase does not change:

- implementation code
- schema
- migrations
- models
- services
- controllers
- UI

## Files checked:

- `docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md`
- `docs/ChatGPT/ver3/phase-10.1-current-execution-audit.md`
- `docs/ChatGPT/ver3/phase-10.2-generated-task-execution-compatibility.md`
- `docs/ChatGPT/ver3/phase-10.3D-status-rules-reverification.md`
- `docs/ChatGPT/ver3/phase-10.6-task-lock-enforcement.md`

## Files created:

- `docs/ChatGPT/ver3/phase-10.7-execution-integrity-guards.md`

## Files modified:

- `docs/ChatGPT/ver3/phase-10.7-execution-integrity-guards.md`

## 1. Execution Chain

The controlled execution chain is:

- `workpacks -> workpack_tasks -> task_cards -> workpack_executions`

Meaning:

- `workpacks` is the parent work package
- `workpack_tasks` is the assignment link between a workpack and a task card
- `task_cards` is the executable task state holder
- `workpack_executions` is the execution-tracking row for the assigned task

No execution logic may bypass this chain.

## 2. Single Execution Rule

There must be exactly one active `workpack_executions` row per `workpack_task`.

Meaning:

- one `workpack_task` link must correspond to one active execution record
- duplicate active execution rows for the same `workpack_id + task_id` are not allowed
- the system must treat the assigned workpack-task pair as the execution identity

Current compatible identity shape:

- `workpack_id`
- `task_id`
- `attempt_no = 1`

## 3. attempt_no Rule

The attempt rule for current Jupiter execution is:

- `attempt_no = 1` only

Required constraints:

- no retry logic
- no second attempts
- no attempt increment during normal execution flow
- no new execution attempt after lock

Meaning:

- multi-attempt history is out of scope for the current approved lifecycle
- current execution integrity must assume one execution attempt only

## 4. Orphan Prevention

Execution integrity must prevent all orphaned chain states.

### 4.1 No Execution Without Valid workpack_task

No `workpack_executions` row may exist unless there is a valid matching:

- `workpack_tasks.workpack_id`
- `workpack_tasks.task_id`

### 4.2 No workpack_task Without Valid workpack

No `workpack_tasks` row may exist unless:

- `workpack_id` points to a valid `workpacks.id`

### 4.3 No workpack_task Without Valid task_card

No `workpack_tasks` row may exist unless:

- `task_id` points to a valid `task_cards.id`

### 4.4 No Broken Execution Chain

All execution operations must assume and preserve:

- valid workpack
- valid workpack_task link
- valid task_card
- valid execution row

## 5. Status Consistency Rules

Task and execution status must remain consistent under the current approved lifecycle.

Required mappings:

- task `OPEN` -> execution `OPEN`
- task `IN_PROGRESS` -> execution `IN_PROGRESS`
- task `COMPLETED_BY_MECHANIC` -> execution `COMPLETED_BY_MECHANIC`
- task `CERTIFIED_BY_ENGINEER` -> execution `CERTIFIED_BY_ENGINEER`
- task `LOCKED` -> execution remains `CERTIFIED_BY_ENGINEER`

Meaning:

- execution rows never become `LOCKED`
- `LOCKED` is a task-card finalization state only
- task and execution state must not drift outside the approved mapping

## 6. Guard Locations

Execution integrity guards must exist at the following control points.

### 6.1 Workpack Generation Service

Guard responsibility:

- create execution rows only through the approved generation path
- ensure each generated task gets one execution row
- ensure no duplicate execution row is created for the same generated task

### 6.2 Task Execution Service

Guard responsibility:

- block invalid forward or reverse transitions
- update task and execution state together
- block mutation on locked tasks
- preserve approved task-to-execution status mapping

### 6.3 Lock / Certification Service

Guard responsibility:

- allow certification only from approved predecessor state
- allow lock only after certification
- preserve `task LOCKED -> execution CERTIFIED_BY_ENGINEER`
- prevent post-lock mutation

### 6.4 Lazy Execution Creation Path

Guard responsibility:

- create execution only if no valid execution exists yet
- create only for a valid assigned `workpack_task`
- create only with `attempt_no = 1`
- never create a second attempt

## 7. Failure Handling

When an integrity guard fails, the system must:

- block the operation
- return a controlled error
- leave no partial updates
- perform no auto-create unless explicitly approved by phase

Meaning:

- invalid transitions must fail cleanly
- invalid chain states must not be silently repaired in normal execution flow
- no hidden retry or fallback execution creation is allowed outside approved logic

## 8. Verification Requirements

Any implementation of execution integrity guards must be verified against the following:

- no duplicate active execution rows for the same `workpack_id + task_id`
- no orphan `workpack_executions`
- no orphan `workpack_tasks`
- `attempt_no` always remains `1`
- no retry flow exists
- task and execution statuses remain inside approved mapping
- locked tasks cannot mutate execution state or execution-linked data
- generation path produces exactly one execution row per assigned task

## 9. Boundaries

The current phase boundaries for execution integrity guards are:

- no retry logic
- no `attempt_no > 1`
- no lifecycle status changes
- no schema extension
- no migration-based cleanup
- no auto-repair routines
- no alternate execution chain outside:
  - `workpacks -> workpack_tasks -> task_cards -> workpack_executions`

## Integrity guard summary:

- defined the execution chain as `workpacks -> workpack_tasks -> task_cards -> workpack_executions`
- defined exactly one active execution row per `workpack_task`
- defined `attempt_no = 1` only with no retry logic and no second attempts
- defined orphan-prevention rules across `workpacks`, `workpack_tasks`, `task_cards`, and `workpack_executions`
- defined task-to-execution status consistency including `task LOCKED -> execution CERTIFIED_BY_ENGINEER`
- identified guard locations in generation, execution, certification/lock, and lazy execution creation paths
- defined failure handling as block + controlled error + no partial updates + no unapproved auto-create

## Verification:

- duplicate prevention defined: PASS
- orphan prevention defined: PASS
- attempt_no rule defined: PASS
- status consistency defined: PASS
- guard locations identified: PASS
- boundaries enforced: PASS

## Result:

PASS
