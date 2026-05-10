# Phase 10.3B - Legacy SIGNED Status Reference

## Phase

- Active Phase: 10.3B - Resolve Legacy SIGNED Status Reference
- Mode: IMPLEMENT
- Execution Type: READ-ONLY analysis

## Scope

This phase identifies and documents all legacy `SIGNED` status references in Jupiter.

It covers:

- live DB status values
- `task_cards.status`
- `workpack_executions.status`
- services
- controllers
- models
- validation logic
- execution UI/views

This phase does not modify code, data, schema, models, services, routes, or UI.

## Files Checked

- `docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md`
- `docs/ChatGPT/ver3/phase-10.3-status-rules-verification.md`
- `docs/ChatGPT/ver3/phase-10.3A-live-status-data-integrity-verification.md`
- `src/modules/workpacks/services/workpack-execution.service.ts`
- `src/modules/workpacks/services/task-execution.service.ts`
- `src/modules/workpacks/workpack.controller.ts`
- `src/modules/tasks/task.service.ts`
- `src/modules/tasks/task.controller.ts`
- `src/modules/tasks/task.routes.ts`
- `src/views/workpacks/execution.ejs`
- `migrations/060_create_task_cards_table.ts`
- `docs/ChatGPT/ver3/schema.sql`
- live `task_cards`
- live `workpack_executions`

## 1. Search Scope

Search terms used:

- `SIGNED`
- `SIGNED_OFF`
- `signed`
- `signed_off`

Important distinction:

- this phase separates legacy lifecycle status references from ordinary signature fields such as `signed_by` and `signed_at`
- `signed_by` and `signed_at` are not themselves legacy status values

## 2. Live DB Values Found

Read-only live database verification found:

- `task_cards.status = SIGNED`: `0`
- `task_cards.status = SIGNED_OFF`: `0`
- `workpack_executions.status = SIGNED`: `0`
- `workpack_executions.status = SIGNED_OFF`: `0`

Conclusion:

- no live database rows currently use `SIGNED` or `SIGNED_OFF` as stored status values

## 3. task_cards.status References Found

### 3.1 Legacy standalone task module

File:

- `src/modules/tasks/task.service.ts`

Legacy status references found:

- `TaskStatus` type includes `SIGNED`
- `signOff(...)` updates `task_cards.status` from `OPEN` to `SIGNED`
- `lockTask(...)` requires `task.status === 'SIGNED'`
- `updateDescription(...)` treats `SIGNED` as immutable
- audit logging writes `SIGNED` as a status transition

Related controller/route:

- `src/modules/tasks/task.controller.ts`
- `src/modules/tasks/task.routes.ts`

Controller language found:

- `Legal transition to SIGNED`
- route `POST /:id/sign-off`

Meaning:

- this older task module still models an `OPEN -> SIGNED -> LOCKED` lifecycle

## 4. workpack_executions.status References Found

File:

- `src/modules/workpacks/services/workpack-execution.service.ts`

Legacy compatibility reference found:

- `mapTaskStatusToExecutionStatus(...)` maps `SIGNED` to `CERTIFIED_BY_ENGINEER`

Important observation:

- this does not store `SIGNED` in `workpack_executions.status`
- it treats `SIGNED` as a legacy alias that collapses into `CERTIFIED_BY_ENGINEER`

Conclusion:

- `SIGNED` is not an execution-row status
- it survives only as compatibility mapping logic

## 5. Validation Logic References Found

File:

- `src/modules/workpacks/services/task-execution.service.ts`

Legacy status references found:

- `lockTask(...)` allows locking if task status is `CERTIFIED_BY_ENGINEER` or legacy `SIGNED`

Meaning:

- the current workpack execution lifecycle is primarily:
  - `OPEN`
  - `IN_PROGRESS`
  - `COMPLETED_BY_MECHANIC`
  - `CERTIFIED_BY_ENGINEER`
  - `LOCKED`
- but lock validation still accepts `SIGNED` for backward compatibility

Impact:

- current execution flow is not fully normalized on `CERTIFIED_BY_ENGINEER`

## 6. Controller References Found

### 6.1 Legacy task controller

File:

- `src/modules/tasks/task.controller.ts`

Legacy references found:

- comment states `Legal transition to SIGNED`
- action name is `signOff`

### 6.2 Workpack controller

File:

- `src/modules/workpacks/workpack.controller.ts`

No legacy `SIGNED` status transition logic was found there.

Only ordinary English wording was found:

- `signed off and certified`

This wording appears descriptive, not as a persisted status enum.

## 7. UI References Found

### 7.1 Execution UI

File:

- `src/views/workpacks/execution.ejs`

Result:

- no execution-page lifecycle branch uses `SIGNED`
- visible task actions are based on:
  - `OPEN`
  - `IN_PROGRESS`
  - `COMPLETED_BY_MECHANIC`
  - `CERTIFIED_BY_ENGINEER`
  - `LOCKED`

### 7.2 Other text/UI wording

Some files contain ordinary “signed” wording related to signatures or narrative text:

- PDF output labels like `Signed:`
- workpack controller message text like `signed off and certified`

These are not status enums.

Conclusion:

- no active execution UI branch depends on `SIGNED` as a visible task status

## 8. Models / Schema / Enum Findings

### 8.1 Schema

Checked:

- `migrations/060_create_task_cards_table.ts`
- `docs/ChatGPT/ver3/schema.sql`

Result:

- `task_cards.status` has default `OPEN`
- no audited DB check constraint was found enumerating `SIGNED`
- schema includes signature-support columns:
  - `signed_by`
  - `signed_at`

These columns support signature capture, not a required `SIGNED` status.

### 8.2 Models

No dedicated shared enum/constants module defining `SIGNED` as the current official lifecycle was identified in the inspected execution stack.

The explicit legacy enum-like usage exists mainly in:

- `src/modules/tasks/task.service.ts`

## 9. Likely Intended Meaning

`SIGNED` most likely represents an older engineering sign-off lifecycle stage that existed before the current workpack execution model standardized on:

- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`
- `LOCKED`

Most likely historical meaning:

- `SIGNED` = engineer-approved / signed-off task before final lock

In the current workpack execution model, that intent is already represented by:

- `CERTIFIED_BY_ENGINEER`

## 10. Impact on Lifecycle

Current impact of legacy `SIGNED` references:

- introduces lifecycle ambiguity between old task module and current workpack execution flow
- keeps lock logic partially backward-compatible instead of fully standardized
- increases risk that older task routes could reintroduce non-standard `SIGNED` rows into `task_cards`
- forces compatibility mapping logic in execution services

Current practical effect:

- live data currently has no `SIGNED` rows
- active execution UI does not expose `SIGNED`
- current workpack flow works without needing `SIGNED`

This means the risk is latent rather than currently active in live data.

## 11. Resolution Strategy

Recommended strategy:

- `MAP TO CERTIFIED_BY_ENGINEER`

Reasoning:

- live DB contains no `SIGNED` rows, so there is no evidence that `SIGNED` is still needed as an independent lifecycle state
- current workpack execution flow already uses `CERTIFIED_BY_ENGINEER` as the engineer sign-off state
- `WorkpackExecutionService.mapTaskStatusToExecutionStatus(...)` already treats `SIGNED` as equivalent to `CERTIFIED_BY_ENGINEER`
- `TaskExecutionService.lockTask(...)` already treats `SIGNED` as a legacy-compatible pre-lock state alongside `CERTIFIED_BY_ENGINEER`
- removing `SIGNED` immediately without an approved implementation phase could break older task routes or stale callers

Therefore the safest phased resolution is:

1. treat `SIGNED` as a legacy alias of `CERTIFIED_BY_ENGINEER`
2. remove legacy `SIGNED` transition paths only in a later approved implementation phase

## 12. Analysis Result

- live DB `SIGNED` values found: PASS
- live DB `SIGNED` values exist: FAIL
  - none exist
- code references identified: PASS
- UI references identified: PASS
- likely intended meaning documented: PASS
- lifecycle impact documented: PASS
- resolution strategy selected: PASS

## 13. Conclusion

Legacy `SIGNED` status references still exist in code, but not in live status data.

They are concentrated in:

- the older standalone task module
- backward-compatibility checks in current workpack execution services

The current active workpack execution lifecycle does not require `SIGNED` as a distinct state.

Best resolution path:

- `MAP TO CERTIFIED_BY_ENGINEER`

This keeps compatibility safe while aligning with the current Jupiter execution model.

Phase 10.3B result: `PASS`
