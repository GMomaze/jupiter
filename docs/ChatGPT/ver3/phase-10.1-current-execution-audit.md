# Phase 10.1 - Current Execution Audit

## Phase

- Active Phase: 10.1 - Current Execution Audit
- Mode: IMPLEMENT
- Execution Type: READ-ONLY audit

## Scope

This document audits the current Jupiter execution flow as implemented today.

It covers:

- `workpacks`
- `task_cards`
- `workpack_tasks`
- `workpack_executions`
- execution services
- workpack services
- task-related services
- execution routes/controllers
- `/workpacks/:id/execution` UI/view

This phase does not change code, schema, models, services, routes, or UI.

## Files Checked

- `src/modules/workpacks/workpack.routes.ts`
- `src/modules/workpacks/workpack.controller.ts`
- `src/modules/workpacks/workpack.service.ts`
- `src/modules/workpacks/services/task-execution.service.ts`
- `src/modules/workpacks/services/workpack-execution.service.ts`
- `src/modules/workpacks/services/workpack-lifecycle.service.ts`
- `src/modules/workpacks/services/workpack-generation.service.ts`
- `src/views/workpacks/execution.ejs`
- `src/models/core/Workpack.ts`
- `src/models/core/WorkpackTask.ts`
- `src/models/core/TaskCard.ts`
- `src/models/core/WorkpackExecution.ts`
- `src/models/core/WorkpackStatus.ts`
- `src/models/associations.ts`
- `migrations/010_create_reference_tables.ts`
- `migrations/060_create_task_cards_table.ts`
- `migrations/070_create_workpacks.ts`
- `migrations/310_create-workpack-executions.ts`

## 1. Current Relationship Model

The current execution relationship is:

`workpacks -> workpack_tasks -> task_cards -> workpack_executions`

Practical meaning:

- `workpacks` is the parent work package record.
- `workpack_tasks` is the link table between a workpack and its task cards.
- `task_cards` holds the executable task record shown on the execution page.
- `workpack_executions` stores execution attempt/status history per `workpack_id + task_id`.

Current association pattern:

- `Workpack` belongs to many `TaskCard` through `WorkpackTask`
- `TaskCard` belongs to many `Workpack` through `WorkpackTask`
- `Workpack` has many `WorkpackExecution`
- `TaskCard` has many `WorkpackExecution`

## 2. How Execution Records Are Created

### 2.1 Generation Path

During template-to-workpack generation, `WorkpackGenerationService.generateWorkpackFromTemplate(...)` creates:

- one `workpacks` row
- one `task_cards` row per template item
- one `workpack_tasks` link row per generated task card
- one `workpack_executions` row per generated task card

Current generation execution insert behavior:

- `workpack_id` = generated workpack id
- `task_id` = generated task card id
- `status` = `OPEN`
- `attempt_no` = `1`
- `version` = `1`

### 2.2 Runtime Execution Path

During live execution actions, `TaskExecutionService` uses `WorkpackExecutionService.ensureExecutionForTask(...)`.

This happens in:

- `startTask(...)`
- `completeTask(...)`
- `signTask(...)`
- `saveWorkPerformed(...)`

`ensureExecutionForTask(...)` behavior:

- looks up latest execution by `workpack_id + task_id`
- orders by `attempt_no DESC`
- returns existing execution if found
- otherwise creates a new row with `attempt_no = 1`

Current observed behavior does not create attempt `2+` rows. The current implementation behaves as single-attempt execution unless future logic adds retry/version branching.

## 3. Status Storage by Table

### 3.1 Workpack Status

Workpack status is held in:

- `workpacks.status_id`

This is a foreign key to:

- `rf_workpack_status.id`

Code currently expects workpack statuses such as:

- `DRAFT`
- `ISSUED`
- `IN_PROGRESS`
- `CERTIFIED`

These are workpack-level lifecycle states, not task execution states.

### 3.2 Task Status

Task execution UI and most task lifecycle logic use:

- `task_cards.status`

Actual task statuses observed in code:

- `OPEN`
- `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`
- `LOCKED`

Legacy status reference still present in code:

- `SIGNED`

### 3.3 Execution Status

Execution status is held in:

- `workpack_executions.status`

Actual allowed execution statuses from migration constraint:

- `OPEN`
- `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`

`LOCKED` is not allowed in `workpack_executions.status`.

## 4. Actual Status Change Flow

### 4.1 Workpack Status Changes

`WorkpackLifecycleService` currently allows:

- `DRAFT -> ISSUED`
- `ISSUED -> IN_PROGRESS`
- `IN_PROGRESS -> CERTIFIED`

No further transition is allowed from `CERTIFIED`.

### 4.2 Task and Execution Status Changes

#### Start Task

When a mechanic starts a task:

- task must currently be `OPEN`
- if workpack is `ISSUED`, workpack moves to `IN_PROGRESS`
- `task_cards.status` becomes `IN_PROGRESS`
- `workpack_executions.status` becomes `IN_PROGRESS`

#### Complete Task

When a mechanic completes a task:

- task must currently be `IN_PROGRESS`
- if workpack is `ISSUED`, workpack moves to `IN_PROGRESS`
- `task_cards.status` becomes `COMPLETED_BY_MECHANIC`
- `workpack_executions.status` becomes `COMPLETED_BY_MECHANIC`

#### Certify / Sign Task

When an engineer certifies a task:

- task must currently be `COMPLETED_BY_MECHANIC`
- `task_cards.status` becomes `CERTIFIED_BY_ENGINEER`
- `workpack_executions.status` becomes `CERTIFIED_BY_ENGINEER`

If `task.compliance_item_id` exists, current logic also updates compliance state:

- `workpack_compliance.status = COMPLETED`
- `aircraft_compliance.status = COMPLIANT`

#### Lock Task

When a task is locked:

- task must currently be `CERTIFIED_BY_ENGINEER` or legacy `SIGNED`
- `task_cards.status` becomes `LOCKED`
- execution row is not moved to `LOCKED`
- execution status remains effectively mapped to `CERTIFIED_BY_ENGINEER`

### 4.3 Execution Status Mapping

`WorkpackExecutionService.mapTaskStatusToExecutionStatus(...)` currently maps:

- `IN_PROGRESS -> IN_PROGRESS`
- `COMPLETED_BY_MECHANIC -> COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER -> CERTIFIED_BY_ENGINEER`
- `SIGNED -> CERTIFIED_BY_ENGINEER`
- `LOCKED -> CERTIFIED_BY_ENGINEER`
- any other status -> `OPEN`

## 5. Do Actual Statuses Match Defined Rules?

Defined target execution rule for Phase 10 expects:

- `OPEN`
- `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`
- `LOCKED`

Audit result:

- `task_cards.status` supports this rule set in practice, including `LOCKED`
- `workpack_executions.status` does not support `LOCKED`
- execution rows stop at `CERTIFIED_BY_ENGINEER`

Conclusion:

- task-level status flow partially matches the defined rule
- execution-row status flow does not fully match, because `LOCKED` is not a valid execution status in the current schema

## 6. Task / Execution Data Flow

Current execution page and services follow this flow:

1. Workpack is loaded.
2. Related task cards are loaded through `workpack_tasks`.
3. Latest execution row is resolved per `workpack_id + task_id`.
4. UI renders task status primarily from `task_cards.status`.
5. User actions update `task_cards.status`.
6. Matching `workpack_executions.status` is updated or ensured.
7. Compliance state may also be updated during task certification for compliance-linked tasks.

Important current behavior:

- the execution page is driven mainly by `task_cards.status`
- `workpack_executions` acts as execution tracking/history, not the primary visible task state source

## 7. Uniqueness Rules

### 7.1 workpacks

- `workpacks.work_order_number` is unique

### 7.2 workpack_tasks

- composite primary key:
  - `workpack_id`
  - `task_id`

This prevents duplicate linkage of the same task card to the same workpack.

### 7.3 workpack_executions

Unique constraint:

- `(workpack_id, task_id, attempt_no)`

This allows multiple attempts only if `attempt_no` changes.

Current service behavior does not increment `attempt_no`, so present-day usage behaves as one active execution record per task per workpack.

## 8. Foreign Keys

### 8.1 workpacks

- `status_id -> rf_workpack_status.id`
- `aircraft_id -> aircraft.id`

### 8.2 workpack_tasks

- `workpack_id -> workpacks.id`
- `task_id -> task_cards.id`

### 8.3 task_cards

- `aircraft_id -> aircraft.id`
- `assigned_to -> users.id`
- `signed_by -> users.id`
- `mechanic_completed_by -> users.id`
- `engineer_certified_by -> users.id`

### 8.4 workpack_executions

- `workpack_id -> workpacks.id`
- `task_id -> task_cards.id`
- `started_by -> users.id`
- `completed_by -> users.id`
- `certified_by -> users.id`

## 9. NOT NULL Constraints

### 9.1 workpacks

Required fields confirmed:

- `id`
- `work_order_number`
- `status_id`
- `aircraft_id`
- `version`

### 9.2 workpack_tasks

Required fields confirmed:

- `workpack_id`
- `task_id`

### 9.3 task_cards

Required fields confirmed from migration:

- `id`
- `task_card_number`
- `title`
- `description`
- `status`
- `aircraft_id`

### 9.4 workpack_executions

Required fields confirmed:

- `id`
- `workpack_id`
- `task_id`
- `attempt_no`
- `status`

## 10. attempt_no Behavior

Current intended meaning:

- `attempt_no` distinguishes multiple execution attempts for the same `workpack_id + task_id`

Current implemented behavior:

- generation creates `attempt_no = 1`
- runtime ensure logic creates `attempt_no = 1` if no record exists
- runtime logic reuses latest execution row if one already exists
- no current audited path increments `attempt_no`

Conclusion:

- schema supports multi-attempt execution history
- current implementation behaves as single-attempt execution tracking

## 11. Execution Page Behavior

Route:

- `GET /workpacks/:id/execution`

Controller behavior:

- loads workpack, aircraft, task cards, latest executions, and snag data
- enforces access for `ENGINEER` and `MECHANIC`

UI behavior in `/src/views/workpacks/execution.ejs`:

- shows workpack header and status badge
- shows snag register and snag entry actions
- lists task cards with current task status
- shows work instructions and work performed fields
- disables normal editing after `CERTIFIED_BY_ENGINEER` or `LOCKED`

Visible task action flow:

- `OPEN` -> show `Start Task`
- `IN_PROGRESS` -> show `Complete (Mechanic)`
- `COMPLETED_BY_MECHANIC`:
  - mechanic sees waiting state
  - engineer sees certification action

Close/finalize behavior:

- page only enables close/finalize if every task status is exactly `CERTIFIED_BY_ENGINEER`
- `LOCKED` does not satisfy this page-level completion test

## 12. Inconsistencies and Deviations Found

### 12.1 LOCKED mismatch between task state and execution state

- `task_cards.status` uses `LOCKED`
- `workpack_executions.status` cannot store `LOCKED`
- execution mapping collapses `LOCKED` to `CERTIFIED_BY_ENGINEER`

This means task terminal state and execution terminal state are not identical.

### 12.2 Close gate mismatch

Execution close logic and page validation require:

- every task status = `CERTIFIED_BY_ENGINEER`

But other downstream document logic accepts:

- `CERTIFIED_BY_ENGINEER`
- `LOCKED`

This creates inconsistent interpretation of terminal task status across the system.

### 12.3 Legacy SIGNED status still referenced

Current execution lifecycle mainly uses:

- `OPEN`
- `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`
- `LOCKED`

But some logic still accepts:

- `SIGNED`

This indicates legacy status compatibility remains in code.

### 12.4 Compliance mutation happens during execution

Task certification is not isolated to task/execution status only.

`TaskExecutionService.signTask(...)` also mutates:

- `workpack_compliance`
- `aircraft_compliance`

This is important because execution actions currently affect compliance state directly.

### 12.5 Model/schema drift

Observed drift includes:

- `TaskCard` model allows nullable `description`, while migration defines `description` as required
- `WorkpackExecution` migration includes fields such as `notes` and `failure_reason`, but the model does not expose them
- timestamp exposure also differs between migration and model surface

These are audit observations only. No changes are made in this phase.

## 13. Audit Conclusion

Current execution in Jupiter is task-card driven.

The effective runtime flow is:

- workpack lifecycle status is stored through `workpacks.status_id`
- executable task state is primarily stored in `task_cards.status`
- execution tracking/history is stored in `workpack_executions`
- linkage between workpacks and executable tasks is stored in `workpack_tasks`

The audited system supports the current workpack generation path and execution page, but there are important deviations:

- `LOCKED` is a task-card state, not an execution-row state
- close/finalization logic is stricter than some downstream document logic
- `attempt_no` exists structurally but is not actively advanced
- task certification currently mutates compliance state

## Verification

- Execution creation path audited: PASS
- Execution status transition path audited: PASS
- `workpack -> workpack_tasks -> task_cards -> workpack_executions` relationship audited: PASS
- actual statuses identified: PASS
- status storage by table identified: PASS
- status-rule match/deviation identified: PASS
- FK and NOT NULL constraints identified: PASS
- uniqueness rules identified: PASS
- `attempt_no` behavior identified: PASS
- execution page behavior identified: PASS
- inconsistencies/deviations documented: PASS
