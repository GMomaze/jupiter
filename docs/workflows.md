# Jupiter Workflows (Current State)

This document describes the workflows that are implemented in the current Jupiter codebase today. It reflects actual routes, controllers, services, tables, and known gaps. It does not describe intended future behavior.

It must be read together with the locked canonical operational workflow:

- import
- applicability
- template
- workpack
- execute
- certify

Workpacks are operational snapshots inside that chain.

They are not the source of truth.

Planning sessions are not workpacks and remain separate from operational execution.

## 0. Canonical Workflow Boundary

The locked Jupiter workflow boundary is:

- import
- applicability
- template
- workpack
- execute
- certify

Operational workpack routes described below sit at the `workpack -> execute -> certify` end of the system.

Upstream source-of-truth ownership remains outside execution in:

- imported maintenance content
- applicability decisions
- templates
- planning sessions where used

## 1. Workpacks

### Entry points / routes
- `GET /workpacks` -> `WorkpackController.renderIndex`
- `GET /workpacks/planner` -> `WorkpackController.renderPlanner`
- `POST /workpacks` -> `WorkpackController.handleCreate`
- `POST /workpacks/:taskId/add` -> `WorkpackController.handleAddTask`
- `POST /workpacks/templates/:templateId/add` -> `WorkpackController.handleAddTemplateTask`
- `POST /workpacks/:id/service-bulletins/add` -> `WorkpackController.handleAddServiceBulletins`
- `POST /workpacks/:id/:taskId/remove` -> `WorkpackController.handleRemoveTask`
- `POST /workpacks/:id/delete` -> `WorkpackController.handleDeleteDraft`
- `POST /workpacks/:id/issue` -> `WorkpackController.handleIssue`
- `POST /workpacks/:id/start` -> `WorkpackController.handleStart`
- `POST /workpacks/:id/close` -> `WorkpackController.handleClose`

### Controller / service involved
- Controller: `src/modules/workpacks/workpack.controller.ts`
- Service: `src/modules/workpacks/workpack.service.ts`
- CSV import service used by planner: `src/modules/workpacks/services/TaskImportService.ts`

### Database tables used
- `workpacks`
- `rf_workpack_status`
- `workpack_tasks`
- `task_cards`
- `task_templates`
- `aircraft`
- `service_bulletins`
- `aircraft_sb_compliance`
- `workpack_snags`
- `audit_log` via generic `AuditService.log(...)`

### Verified persisted workpack fields
- `certified_by`
- `certified_at`
- `qa_reviewed_by`
- `qa_reviewed_at`
- `released_by`
- `released_at`

### Current process
1. A planner/admin opens `/workpacks/planner`.
2. The planner page loads only draft workpacks, all unassigned tasks, all aircraft, active task templates, and open service bulletins relevant to each draft workpack aircraft.
3. Creating a workpack:
- Requires authenticated user and `PLANNER` route role. `ADMIN` works as override through RBAC.
- `WorkpackService.create(...)` checks that the aircraft exists.
- It rejects duplicate `work_order_number`.
- It looks up `DRAFT` in `rf_workpack_status`.
- It rejects creation if the selected aircraft already has an existing draft workpack.
- It inserts a row into `workpacks` with version `0`.
- It logs a `CREATE` audit record.
- This creates an operational workpack snapshot and does not create upstream source-of-truth maintenance content.
4. Adding an existing unassigned task to a workpack:
- `WorkpackService.addTask(...)` requires the workpack to exist and still be `DRAFT`.
- It verifies the task exists.
- It inserts into `workpack_tasks` using `findOrCreate`.
- It does not enforce aircraft matching between the task and the workpack.
5. Adding a template task to a workpack:
- `WorkpackService.addTaskFromTemplate(...)` requires the workpack to be `DRAFT`.
- It loads the workpack aircraft.
- It loads the template and rejects inactive/missing templates.
- It enforces scope compatibility for `MODEL` and `AIRCRAFT` scoped templates.
- It checks whether a task from the same template is already linked to that workpack.
- It creates a new `task_cards` row, then links it through `workpack_tasks`.
6. Adding service bulletin tasks to a workpack:
- `WorkpackService.addServiceBulletins(...)` requires `DRAFT`.
- It pulls open applicable service bulletins for the workpack aircraft.
- It rejects invalid or unavailable bulletin selections.
- It creates one `task_cards` row per selected bulletin not already represented in that workpack.
- It links the new task to the workpack through `workpack_tasks`.
7. Removing a task from a workpack:
- `WorkpackService.removeTask(...)` requires `DRAFT`.
- It deletes the linking row from `workpack_tasks`.
- It does not delete the `task_cards` row itself.
8. Issuing a workpack:
- `WorkpackService.issue(...)` requires the workpack to be `DRAFT`.
- It rejects empty workpacks.
- It loads all linked tasks and requires every task status to be `OPEN`.
- It transitions the workpack to `ISSUED`.
9. Starting work at pack level:
- `WorkpackService.startWork(...)` requires `ISSUED`.
- It transitions the workpack to `IN_PROGRESS`.
10. Closing a workpack:
- `WorkpackService.close(...)` requires `IN_PROGRESS`.
- It rejects workpacks with no tasks.
- It requires the locked operational certification and closure rules to pass before close/certification can proceed.
- It blocks closure if any associated snag is not `CLOSED`.
- It sets persisted workpack fields `certified_by` and `certified_at`, then transitions status to `CERTIFIED`.
- Certification remains downstream of execution.
- Any document response returned after close is downstream read-only output and must not be treated as a lifecycle mutation.
11. Deleting a draft:
- `WorkpackService.deleteDraft(...)` only allows deletion in `DRAFT`.
- It deletes linking rows from `workpack_tasks`.
- It deletes the `workpacks` row.
- It does not delete the underlying `task_cards`.

### Locked workflow boundary notes
- The planner routes and workpack creation flow are operational preparation paths, not master source-of-truth ownership.
- Planning sessions are separate from workpacks and do not execute work directly.
- `CLOSED` workpacks remain immutable and must not be treated as active execution records.

### Gaps / broken / incomplete parts
- The planner UI now allows assigning an unassigned task to any draft workpack, but `WorkpackService.addTask(...)` does not validate aircraft compatibility. Cross-aircraft assignment is currently possible by design of the current code.
- Removing a task from a draft only removes the `workpack_tasks` link. The task row remains in `task_cards` and becomes unassigned again.
- The `workpacks` schema includes persisted lifecycle fields `certified_by`, `certified_at`, `qa_reviewed_by`, `qa_reviewed_at`, `released_by`, and `released_at`, but `src/models/core/Workpack.ts` does not currently declare them.
- The planner still loads all unassigned tasks globally. It does not distinguish tasks orphaned from deleted drafts versus newly created tasks.
- `renderPlanner` hardcodes several template requirement flags (`is_required_for_wood`, etc.) to `false` even though import code supports optional columns when present.

## 2. Tasks

### Entry points / routes
- `GET /workpacks/:id/tasks` -> `WorkpackController.renderPackTasks`
- `GET /workpacks/:id/service-bulletins` -> `WorkpackController.renderPackServiceBulletins`
- `POST /workpacks/tasks/:taskId/start` -> `WorkpackController.handleTaskStart`
- `POST /workpacks/tasks/:taskId/work-note` -> `WorkpackController.handleTaskWorkNote`
- `POST /workpacks/tasks/:taskId/complete` -> `WorkpackController.handleTaskComplete`
- `POST /workpacks/tasks/:taskId/sign` -> `WorkpackController.handleTaskSign`
- `POST /workpacks/tasks/:taskId/lock` -> `WorkpackController.handleTaskLock`

### Controller / service involved
- Controller: `WorkpackController`
- Service: `WorkpackService`
- Shared task UI partial: `src/views/partials/task_row.ejs`

### Database tables used
- `task_cards`
- `workpack_tasks`
- `workpack_executions`
- `workpack_measurements`
- `workpack_signatures`
- `workpack_audit_log`
- `users`

### Current process
1. `/workpacks/:id/tasks` loads the pack, aircraft, snags, and linked tasks, then filters out any tasks that came from service bulletins.
2. `/workpacks/:id/service-bulletins` loads the same pack/task set but keeps only tasks with `service_bulletin_id`.
3. Each task row is rendered through `partials/task_row.ejs`.
4. Task statuses currently used in code are:
- `OPEN`
- `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`
- `SIGNED`
- `LOCKED`
5. Starting a task:
- Requires mechanic route role. `ADMIN`/`SUPERVISOR` can still pass service-level ownership checks when already inside service methods, but the route itself is mechanic-only.
- `WorkpackService.startTask(...)` finds the executable workpack through `workpack_tasks`.
- If the pack is still `ISSUED`, it auto-transitions the pack to `IN_PROGRESS`.
- It only allows tasks in `OPEN`.
- It sets task status to `IN_PROGRESS`, assigns the task to the acting user, increments task version, and creates/updates an execution row.
6. Saving a work note:
- `WorkpackService.saveWorkPerformed(...)` also auto-transitions the pack from `ISSUED` to `IN_PROGRESS` if needed.
- It only allows editing when the task is `IN_PROGRESS`.
- For mechanics, the task must already be assigned to the current user.
- It updates `task_cards.work_performed`, `assigned_to`, and execution state.
- It rewrites measurement rows for the latest execution from the encoded work note payload.
7. Completing a task:
- `WorkpackService.completeTask(...)` requires the task to be `IN_PROGRESS`.
- It keeps/sets `work_performed`.
- It sets status to `COMPLETED_BY_MECHANIC`.
- It records mechanic completion user/date.
- It updates the execution row to `COMPLETED_BY_MECHANIC`.
- It writes execution measurements and a mechanic `WORK` signature.
8. Engineer certification:
- `WorkpackService.signTask(...)` requires the task to be `COMPLETED_BY_MECHANIC`.
- It sets status to `CERTIFIED_BY_ENGINEER`.
- It records engineer certification user/date.
- It updates the execution row to `CERTIFIED_BY_ENGINEER`.
- It writes an engineer `APPROVAL` signature.
9. QA/supervisor lock:
- `WorkpackService.lockTask(...)` requires the task to be `CERTIFIED_BY_ENGINEER` or `SIGNED`.
- It changes the task to `LOCKED`.
- It does not currently write a matching execution-state change.

### Gaps / broken / incomplete parts
- The active task UI in `partials/task_row.ejs` matches the registered routes, but `src/views/workpacks/execution.ejs` still points to old/nonexistent endpoints such as:
  - `/workpacks/tasks/:taskId/measurement`
  - `/workpacks/tasks/:taskId/note`
  - `/workpacks/tasks/:taskId/sign/mechanic`
  - `/workpacks/tasks/:taskId/sign/engineer`
  Those routes are not present in `workpack.routes.ts`.
- Because of that route mismatch, `execution.ejs` is not aligned with the current backend and should be treated as stale/broken.
- There is no dedicated unassign or reassign task workflow beyond removing and re-adding workpack links.
- `getExecutablePackForTask(...)` chooses an `IN_PROGRESS` pack first, then an `ISSUED` pack. If a task is linked to multiple packs, execution attaches to one chosen pack rather than rejecting the ambiguity.

## 3. Task execution

### Entry points / routes
- Triggered indirectly through task action routes:
  - `POST /workpacks/tasks/:taskId/start`
  - `POST /workpacks/tasks/:taskId/work-note`
  - `POST /workpacks/tasks/:taskId/complete`
  - `POST /workpacks/tasks/:taskId/sign`
- Read side:
  - `GET /workpacks/:id/tasks`
  - `GET /workpacks/:id/service-bulletins`
  - `GET /workpacks/:id/execution`

### Controller / service involved
- Read aggregation: `WorkpackController.attachLatestExecutions(...)`
- Write lifecycle: `WorkpackService.ensureExecutionForTask(...)`, `startTask(...)`, `saveWorkPerformed(...)`, `completeTask(...)`, `signTask(...)`

### Database tables used
- `workpack_executions`
- `workpack_measurements`
- `workpack_signatures`
- `workpack_audit_log`
- `task_cards`
- `workpack_tasks`

### Current process
1. Executions are not created when a workpack is created or issued.
2. An execution row is created lazily by `ensureExecutionForTask(...)` the first time a task action needs one.
3. The first execution always starts with `attempt_no = 1`.
4. Current code only fetches the latest execution per task by highest `attempt_no`.
5. There is no implemented workflow in the current service that creates a second execution attempt.
6. Execution status is derived from task status:
- `OPEN` -> execution `OPEN`
- `IN_PROGRESS` -> execution `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC` -> execution `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`, `SIGNED`, `LOCKED` -> execution `CERTIFIED_BY_ENGINEER`
7. Every significant task action appends hash-chained audit entries in `workpack_audit_log`.
8. `renderPackTasks`, `renderPackServiceBulletins`, and `renderExecution` all attempt to attach latest execution data plus measurements.
9. If `workpack_executions` or `workpack_measurements` is missing or behind schema, the controller catches that and continues without execution history.

### Gaps / broken / incomplete parts
- Attempt handling is only partially modeled. The schema has `attempt_no`, but the current code always creates `attempt_no = 1` and never starts a retry attempt.
- `lockTask(...)` updates the task to `LOCKED` but does not update the corresponding execution row or append execution audit entries for the lock.
- Execution history rendering is optional/fault-tolerant; if the execution schema is missing, the UI silently degrades instead of failing hard.

## 4. Measurements

### Entry points / routes
- There is no standalone measurement route in `workpack.routes.ts`.
- Measurements are currently saved only through `POST /workpacks/tasks/:taskId/work-note` and `POST /workpacks/tasks/:taskId/complete`.
- Measurement values are displayed through `partials/task_row.ejs`.

### Controller / service involved
- Parsing and carry-forward on read: `WorkpackController.attachLatestExecutions(...)`
- Parsing and persistence on write: `WorkpackService.getMeasurementDefinitions(...)`, `splitWorkPerformed(...)`, `parseCapturedValues(...)`, `syncExecutionMeasurements(...)`

### Database tables used
- `workpack_measurements`
- `workpack_executions`
- `task_cards`
- `workpack_audit_log`

### Current process
1. Measurement fields are inferred from task description text, not from a separate definition table.
2. Any bracketed token in the task description, e.g. `[Gap]` or `[]`, becomes a measurement field.
3. Each inferred measurement gets:
- `field_key` like `field_0`
- `field_label` from the bracket text, or fallback `Value N`
- `position` from order in description
4. In the active task UI, users edit measurements inline in `partials/task_row.ejs`.
5. The client script rebuilds a hidden `work_performed` payload using this format:
- `[Captured Values]`
- one `Label: Value` line per filled measurement
- `[/Captured Values]`
- then free-text work note below that block
6. On save/complete, the service:
- parses the encoded `work_performed`
- deletes existing `workpack_measurements` rows for the latest execution
- recreates measurement rows for every inferred field
7. On read, measurement display order comes from description token order.
8. If a current execution has no measurement row for a field, the UI can prefill from:
- latest execution measurements
- legacy captured values stored inside `task_cards.work_performed`
- carry-forward values from previous tasks in the same pack during controller-side read assembly

### Gaps / broken / incomplete parts
- There is no separate measurement API despite stale references to one in `execution.ejs`.
- Measurements are embedded into `task_cards.work_performed` as a transport format and also normalized into `workpack_measurements`, so the system currently has two representations of the same data.
- Measurement definitions depend on bracket syntax inside `task.description`. If the description text changes, measurement definitions change with it.
- Generic labels like `Value 1` are explicitly treated as weaker and are not carried forward the same way named fields are.

## 5. Snags

### Entry points / routes
- `GET /workpacks/:id/snags` -> `WorkpackController.renderPackSnags`
- `POST /workpacks/:id/snags` -> `WorkpackController.handleCreateSnag`
- `POST /workpacks/:id/snags/:snagId/start` -> `WorkpackController.handleStartSnag`
- `POST /workpacks/:id/snags/:snagId/complete` -> `WorkpackController.handleCompleteSnag`
- `POST /workpacks/:id/snags/:snagId/close` -> `WorkpackController.handleCloseSnag`

### Controller / service involved
- Controller: `renderPackSnags`, `handleCreateSnag`, `handleStartSnag`, `handleCompleteSnag`, `handleCloseSnag`
- Service: `reportSnag`, `startSnag`, `resolveSnag`, `closeSnag`

### Database tables used
- `workpack_snags`
- `workpack_snag_audit_log`
- `workpacks`
- `rf_workpack_status`
- `users`

### Current process
1. Snags exist and are first-class in the current code.
2. The snags page loads the workpack, aircraft, snag rows, user references, and optionally snag audit history.
3. Creating a snag:
- Mechanic-only route.
- Requires non-empty description.
- Rejects snags on `DRAFT` workpacks.
- Generates `snag_no` by taking the current max for that workpack and adding one.
- Creates a row in `workpack_snags` with status `OPEN`.
- Appends a chained snag audit entry.
4. Starting a snag:
- Mechanic-only route.
- Only allowed from `OPEN`.
- Sets status `IN_PROGRESS`, assigns the acting user, and records `started_by`/`started_at`.
5. Resolving a snag:
- Mechanic-only route.
- Only allowed from `IN_PROGRESS`.
- Allowed for the assigned mechanic, or admin/supervisor override at service level.
- Requires `resolution_notes`.
- Stores optional `parts_used` and `time_spent_minutes`.
- Sets status `RESOLVED`.
6. Closing a snag:
- Route allows `ENGINEER`, `SUPERVISOR`, or `ADMIN`.
- Service requires `ENGINEER` or admin/supervisor override.
- Only allowed from `RESOLVED`.
- Sets status `CLOSED` and records closer/date.
7. Workpack close is blocked until all snags are `CLOSED`.

### Gaps / broken / incomplete parts
- `renderPackSnags(...)` explicitly degrades if `workpack_snag_audit_log` is missing: it retries without audit history instead of failing the page.
- Snag reporting is blocked only for `DRAFT`; it is allowed once the pack is issued/in progress.
- The UI shows full snag lifecycle, but there is no reopen workflow in current code.

## 6. PDFs / reports

### Entry points / routes
- `GET /workpacks/:id/pdf/service` -> `WorkpackController.handleServicePdf`
- `GET /workpacks/:id/crs` -> `WorkpackController.handleCrsPdf`
- `GET /workpacks/:id/crma` -> `WorkpackController.handleCrmaPdf`
- `GET /workpacks/:id/pdf/release` -> `WorkpackController.handleReleasePdf`
- `GET /workpacks/:id/pdf/crma` -> `WorkpackController.handleCrmaPdf`
- `POST /workpacks/:id/close` -> `WorkpackController.handleClose` then returns CRS PDF immediately

### Controller / service involved
- Controller: `handleServicePdf`, `handleReleasePdf`, `handleCrmaPdf`, `handleClose`
- PDF generators:
  - `src/modules/workpacks/pdf.service.ts`
  - `src/modules/workpacks/pdf.release.ts`
  - `src/modules/workpacks/pdf.crma.ts`

### Database tables used
- `workpacks`
- `workpack_tasks`
- `task_cards`
- `aircraft`
- `component_models`
- `users`

### Current process
1. All PDF generators query the database directly using `pool.query(...)` instead of Sequelize models.
2. CRS PDF:
- pulls pack + aircraft + model details
- uses stored eligible operational data at generation time
- is a read-only document-generation step
- uses engineer certification timestamps as the release anchor
- strips `[Captured Values]...[/Captured Values]` blocks out of printed task text
3. Release PDF:
- available only when the controller sees workpack status `CERTIFIED`
- otherwise it throws `WORKPACK_RELEASE_PDF_BLOCKED`
4. CRMA PDF:
- separate generator, same general direct-SQL pattern
 - remains separate from full CRS behavior
5. Workpack close:
- after `WorkpackService.close(...)` succeeds, the controller immediately streams the CRS PDF back in the same request
- that document response must still be treated as downstream read-only output, not as lifecycle control

### Gaps / broken / incomplete parts
- PDFs rely on direct SQL and not the main service layer, so workflow logic and reporting logic are split.
- The CRS/service PDF only includes tasks in `CERTIFIED_BY_ENGINEER`. If tasks are later `LOCKED`, the query in `pdf.service.ts` does not show them.
- The release PDF is gated on pack status `CERTIFIED`; the close workflow must succeed first.

## 7. Known gaps and inconsistencies

- `src/views/workpacks/execution.ejs` is stale and points to routes that do not exist in `src/modules/workpacks/workpack.routes.ts`.
- Measurements are not saved through a dedicated measurement endpoint even though one stale UI still assumes that model.
- Task execution supports only a single attempt in practice even though `workpack_executions` has `attempt_no`.
- Removing a task from a draft leaves the task row behind as an unassigned task.
- Unassigned task assignment is currently broader than aircraft matching; the planner UI and service allow linking an unassigned task to any draft workpack.
- Some pages are intentionally tolerant of missing schema:
  - execution history pages continue if `workpack_executions` / `workpack_measurements` is missing
  - snags page continues if `workpack_snag_audit_log` is missing
- Some code and reporting paths still show drift against the locked workflow rules, especially around `LOCKED` task treatment in close/document logic.

## Verification Notes

- Correction: the generic audit table reference in this document is correct as `audit_log`. Verified in `src/models/audit/AuditLog.ts`.
- Correction: `task_templates` is the correct table name for template-backed workpack planning/import. Verified in `src/models/core/TaskTemplate.ts`.
- Correction: the stale-route warning for `src/views/workpacks/execution.ejs` is confirmed. That view still posts to endpoints such as `/workpacks/tasks/:taskId/measurement`, `/note`, `/sign/mechanic`, and `/sign/engineer`, while the registered routes in `src/modules/workpacks/workpack.routes.ts` only expose `/start`, `/work-note`, `/complete`, `/sign`, and `/lock`.
- Correction: the `workpacks` table does include persisted fields `certified_by`, `certified_at`, `qa_reviewed_by`, `qa_reviewed_at`, `released_by`, and `released_at`.
- Uncertainty: `renderPlanner` still hardcodes imported template applicability flags to `false` in the controller view model even though `TaskTemplate` supports those fields and `TaskImportService` conditionally imports them. That means the planner page behavior is confirmed, but whether those fields are used elsewhere in the app was not established in this review.
- Confirmed from `docs/ChatGPT/schema.sql` (schema source requested as `docs/schema.sql`).
- Files checked:
  - `src/modules/workpacks/workpack.routes.ts`
  - `src/modules/workpacks/workpack.controller.ts`
  - `src/modules/workpacks/workpack.service.ts`
  - `src/modules/workpacks/services/TaskImportService.ts`
  - `src/modules/workpacks/pdf.service.ts`
  - `src/modules/workpacks/pdf.release.ts`
  - `src/modules/workpacks/pdf.crma.ts`
  - `src/views/workpacks/tasks.ejs`
  - `src/views/workpacks/service-bulletins.ejs`
  - `src/views/workpacks/snags.ejs`
  - `src/views/workpacks/execution.ejs`
  - `src/views/partials/task_row.ejs`
  - `src/models/core/Workpack.ts`
  - `src/models/core/WorkpackTask.ts`
  - `src/models/core/TaskCard.ts`
  - `src/models/core/TaskTemplate.ts`
  - `src/models/core/WorkpackExecution.ts`
  - `src/models/core/WorkpackMeasurement.ts`
  - `src/models/core/WorkpackSignature.ts`
  - `src/models/core/WorkpackSnag.ts`
  - `src/models/core/WorkpackStatus.ts`
  - `src/models/audit/AuditLog.ts`
  - `src/models/audit/WorkpackAuditLog.ts`
  - `src/models/audit/WorkpackSnagAuditLog.ts`
  - `docs/ChatGPT/schema.sql`
