# Phase 10.2 - Generated Task Execution Compatibility

## Phase

- Active Phase: 10.2 - Generated Task Execution Compatibility
- Mode: IMPLEMENT
- Execution Type: READ-ONLY verification

## Scope

This phase verifies whether generated tasks are compatible with the current Jupiter execution system.

It covers:

- generated `task_cards`
- `workpack_tasks`
- `workpack_executions`
- execution services
- `/workpacks/:id/execution` UI

This phase does not change code, schema, models, services, routes, or UI.

## Files Checked

- `docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md`
- `docs/ChatGPT/ver3/phase-10.1-current-execution-audit.md`
- `docs/ChatGPT/ver3/phase-9.10-workpack-generation-e2e-verification.md`
- `src/modules/workpacks/services/workpack-generation.service.ts`
- `src/modules/workpacks/services/task-execution.service.ts`
- `src/modules/workpacks/services/workpack-execution.service.ts`
- `src/modules/workpacks/workpack.controller.ts`
- `src/views/workpacks/execution.ejs`
- `src/models/core/WorkpackTask.ts`
- `src/models/core/WorkpackExecution.ts`
- `migrations/060_create_task_cards_table.ts`
- `migrations/070_create_workpacks.ts`
- `migrations/310_create-workpack-executions.ts`

## 1. Verification Basis

This verification uses:

- direct inspection of current generation service behavior
- direct inspection of current execution services
- direct inspection of current execution page/controller behavior
- direct schema/migration checks for `task_cards`, `workpack_tasks`, and `workpack_executions`
- previously documented controlled generation evidence from Phase 9.10

Phase 9.10 already verified that the generation path successfully creates:

- one `workpacks` row
- one `task_cards` row per template item
- one `workpack_tasks` link per task card
- one `workpack_executions` row per linked task

That evidence is reused here because Phase 10.2 is compatibility verification, not a new write phase.

## 2. Generated task_cards Required Field Compatibility

Generated task cards are created in `WorkpackGenerationService.buildTaskCardPayload(...)`.

For all generated task cards, the service sets:

- `task_card_number`
- `aircraft_id`
- `status`
- `component_id`
- `version`
- `title`
- `description`

Additional source-linked fields are populated as supported by current schema:

- `template_source_id` for `STANDARD_TASK`
- `compliance_item_id` for `COMPLIANCE_ITEM`
- `service_bulletin_id` when compliance source type is `SB`

Compared with current `task_cards` migration requirements:

- `task_card_number` required: satisfied
- `title` required: satisfied
- `description` required: satisfied
- `status` required: satisfied
- `aircraft_id` required: satisfied

Result:

- generated `task_cards` contain all required fields for current execution compatibility

## 3. Default Status Compatibility

Generated task cards are created with:

- `task_cards.status = OPEN`

Generated execution rows are created with:

- `workpack_executions.status = OPEN`
- `attempt_no = 1`

This matches current execution expectations for a newly generated task.

## 4. workpack_tasks Link Compatibility

Current schema requires generated tasks to be linked through:

- `workpack_tasks.workpack_id`
- `workpack_tasks.task_id`

Current generation service creates this link immediately after each task card is created.

This matches:

- current controller queries
- current workpack/task relationship mapping
- current execution page loading pattern

Result:

- each generated task card is correctly linked into `workpack_tasks`

## 5. workpack_executions Compatibility

Current generation service creates one execution row per generated task card using:

- `workpack_id`
- `task_id`
- `status = OPEN`
- `attempt_no = 1`
- `version = 1`

This matches current execution-service lookup behavior:

- `WorkpackExecutionService.ensureExecutionForTask(...)`
- latest execution lookup by `workpack_id + task_id`
- ordering by `attempt_no DESC`

This also matches the current unique constraint:

- `(workpack_id, task_id, attempt_no)`

Result:

- one compatible `workpack_executions` row exists per generated task

## 6. Generated Task Lifecycle Compatibility

Generated tasks enter the existing task lifecycle at:

- `OPEN`

From there, current execution services support the same generated tasks moving through:

- `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`
- `LOCKED`

Compatibility by stage:

- `OPEN`: supported
- `IN_PROGRESS`: supported
- `COMPLETED_BY_MECHANIC`: supported
- `CERTIFIED_BY_ENGINEER`: supported
- `LOCKED`: supported on `task_cards`

Important current-system caveat:

- `LOCKED` is supported on `task_cards.status`
- `LOCKED` is not supported on `workpack_executions.status`
- execution mapping collapses `LOCKED` to `CERTIFIED_BY_ENGINEER`

Result:

- generated tasks can move through the current visible execution lifecycle
- execution-row status compatibility is complete through `CERTIFIED_BY_ENGINEER`
- `LOCKED` remains a task-card-only terminal state in the current design

## 7. Execution UI Compatibility

Current execution UI at `/workpacks/:id/execution` renders task cards using:

- `task.task_card_number`
- `task.title`
- `task.description`
- `task.status`
- `task.work_performed`

Generated tasks populate the required visible fields:

- task card number
- title
- description
- status

The page action logic is status-driven and does not depend on whether the task originated from manual planning or template generation.

Current UI action compatibility:

- generated `OPEN` task shows `Start Task`
- generated `IN_PROGRESS` task shows `Complete (Mechanic)`
- generated `COMPLETED_BY_MECHANIC` task shows engineer certification action
- generated `CERTIFIED_BY_ENGINEER` or `LOCKED` task becomes read-only

Result:

- generated tasks render correctly in the current execution UI

## 8. Execution Action Compatibility

Current execution actions operate on `TaskCard` identity plus linked workpack lookup.

They do not require a special “generated task” subtype.

Current generated-task compatibility with execution actions:

- start task: compatible
- save work performed: compatible
- complete task: compatible
- certify task: compatible
- lock task: compatible

The key reason this works is:

- generated tasks are created as normal `task_cards`
- they are linked through normal `workpack_tasks`
- they have normal `workpack_executions`

Result:

- current execution actions work on generated tasks

## 9. FK and NOT NULL Compatibility

### 9.1 task_cards

Generated task cards satisfy current required fields:

- no `task_cards` NOT NULL violation is introduced by generation

### 9.2 workpack_tasks

Generated link rows satisfy:

- `workpack_id` present
- `task_id` present

Both foreign keys point to created parent rows.

### 9.3 workpack_executions

Generated execution rows satisfy:

- `workpack_id` present
- `task_id` present
- `attempt_no` present
- `status` present

Both foreign keys point to created parent rows.

Result:

- no FK violation is introduced by the current generated-task flow
- no NOT NULL violation is introduced by the current generated-task flow

## 10. Duplicate Execution Record Compatibility

Current generation service creates exactly one execution row per generated task.

Current uniqueness protection exists at:

- `workpack_executions(workpack_id, task_id, attempt_no)`

Current generation value:

- `attempt_no = 1`

Current runtime execution service:

- reuses latest execution where present
- does not create a duplicate attempt `1` row for an already-generated task

Result:

- no duplicate execution record is expected in the normal generated-task flow

## 11. Inconsistencies Relevant to Compatibility

### 11.1 LOCKED is only partially represented

Generated tasks are compatible with the task lifecycle including `LOCKED`, but:

- `workpack_executions` cannot store `LOCKED`
- execution status remains `CERTIFIED_BY_ENGINEER` after task lock

This is a current-system inconsistency, not a generated-task-specific failure.

### 11.2 Close/finalize logic remains stricter than some downstream consumers

Current execution UI and close logic require:

- every task status = `CERTIFIED_BY_ENGINEER`

Other downstream document logic may also accept:

- `LOCKED`

Generated tasks inherit this current-system behavior unchanged.

### 11.3 Compliance-linked generated tasks can mutate compliance state on certification

When a generated task includes `compliance_item_id`, current certification logic updates:

- `workpack_compliance`
- `aircraft_compliance`

This is current execution behavior and applies equally to generated compliance-linked tasks.

## 12. Verification Results

- generated `task_cards` contain all required fields: PASS
- default generated task status is `OPEN`: PASS
- each generated task is linked through `workpack_tasks`: PASS
- one `workpack_executions` row exists per generated task: PASS
- generated execution status starts as `OPEN`: PASS
- generated execution `attempt_no` starts as `1`: PASS
- generated tasks can move through `IN_PROGRESS`: PASS
- generated tasks can move through `COMPLETED_BY_MECHANIC`: PASS
- generated tasks can move through `CERTIFIED_BY_ENGINEER`: PASS
- generated tasks can move through `LOCKED`: PASS
- generated tasks render correctly in execution UI: PASS
- execution actions work on generated tasks: PASS
- no FK violations introduced by generated-task flow: PASS
- no NOT NULL violations introduced by generated-task flow: PASS
- no duplicate execution records expected in normal flow: PASS

## 13. Conclusion

Generated tasks are compatible with the current execution system.

Compatibility is confirmed because generated items are created as normal:

- `task_cards`
- `workpack_tasks`
- `workpack_executions`

This means the current execution services and execution page can operate on generated tasks without requiring a separate execution path.

Known deviation retained from current system:

- `LOCKED` is a valid terminal task-card state, but not a valid execution-row state

This is a current execution design inconsistency, but it does not block generated-task compatibility with the existing execution flow.

Phase 10.2 result: `PASS`
