# Phase 9 - Scheduled Task Due Recalculation

## Mode

DEFINE only.

No implementation, migrations, refactors, calendar monitor, notification engine, automatic workpack creation, automatic grounding, or frontend due calculations are part of this phase definition.

## Goal

Define how scheduled maintenance tasks derive due status from:

- aircraft utilisation authority;
- calendar time;
- recurring intervals;
- task/program applicability;
- existing workpack/task completion evidence;
- the unified `DueStatusService`.

Phase 9 defines a future backend due-calculation authority for scheduled tasks. It does not create workpacks or mutate task/workpack lifecycle state.

## Current Implementation Status

Status: PARTIAL.

Jupiter has task and maintenance-program structures, but no dedicated scheduled-task due recalculation service.

Existing foundations:

- `TaskTemplate`
  - stores standard task definitions with scope, source type, hour interval, month interval, model applicability, aircraft applicability, and applicability flags.
- `MaintenanceTemplate`
  - stores maintenance program/template definitions with model, template type, hour interval, and month interval.
- `MaintenanceTemplateItem`
  - links maintenance templates to standard tasks, compliance items, and SIDs.
- `TaskCard`
  - stores executable tasks, status, work performed, template source, compliance/SB links, aircraft, component, and completion/certification fields.
- `WorkpackTask`
  - links task cards to workpacks.
- `WorkpackExecution`
  - stores execution attempts and completion/certification timestamps.
- `MaintenanceRequirement`
  - stores older maintenance requirements with model, title, hour interval, and month interval.
- `WorkpackGenerationService`
  - turns maintenance template items into task cards and workpack executions after applicability filtering.
- `TaskImportService` and `standard-task-import.controller`
  - import standard task templates, including interval fields where available.
- `DueStatusService`
  - provides the due status vocabulary and mixed-limit evaluation helpers.

Missing today:

- no scheduled-task due service;
- no aircraft/task due snapshot table;
- no last-complied aircraft hours/cycles for standard tasks;
- no next-due hours/cycles/date fields for scheduled tasks;
- no cycle interval fields on standard tasks or maintenance templates;
- no tolerance/escalation fields;
- no explicit task recurrence flag;
- no backend authority that recalculates scheduled task due status after utilisation events.

## Files Inspected

- `src/models/core/TaskTemplate.ts`
- `src/models/core/TaskCard.ts`
- `src/models/core/WorkpackTask.ts`
- `src/models/core/WorkpackExecution.ts`
- `src/models/MaintenanceTemplate.ts`
- `src/models/MaintenanceTemplateItem.ts`
- `src/models/MaintenanceRequirement.ts`
- `src/models/core/Workpack.ts`
- `src/modules/workpacks/services/workpack-generation.service.ts`
- `src/modules/workpacks/services/workpack-preview.service.ts`
- `src/modules/workpacks/services/TaskImportService.ts`
- `src/modules/library/standard-task-import.controller.ts`
- `src/modules/tasks/task.service.ts`
- `src/modules/due-status/due-status.service.ts`
- `migrations/060_create_task_cards_table.ts`
- `migrations/070_create_workpacks.ts`
- `migrations/130_create_maintenance_requirements.ts`
- `migrations/190_workpack_workflow_foundation.ts`
- `migrations/210_create_task_templates.ts`
- `migrations/230_add_task_template_source_to_task_cards.ts`
- `migrations/310_create-workpack-executions.ts`
- `migrations/470_add_standard_task_import_fields_to_task_templates.ts`
- `migrations/520_create_maintenance_templates.ts`

## Existing Scheduled Task Structures

### `task_templates`

Model:

- `TaskTemplate`

Stored fields relevant to due calculation:

- `scope`
- `task_card_number`
- `sort_order`
- `title`
- `description`
- `source_type`
- `interval_hours`
- `interval_months`
- `model_applicability`
- `aircraft_applicability`
- `aircraft_model_id`
- `aircraft_id`
- `is_active`
- aircraft-feature applicability flags such as `is_required_for_wood` and `is_required_for_fabric`

Current role:

- standard task source library.
- workpack generation can copy standard tasks into executable task cards.

Current limitations:

- no cycle interval;
- no last-done fields;
- no next due fields;
- no tolerance fields;
- no explicit recurrence mode;
- no initial baseline fields.

### `maintenance_templates`

Model:

- `MaintenanceTemplate`

Stored fields relevant to due calculation:

- `name`
- `description`
- `template_type`
- `model_id`
- `interval_hours`
- `interval_months`
- `is_active`

Current role:

- maintenance program/check template for an aircraft model.
- template intervals describe the program/check cadence, not necessarily each individual task's last-done state.

Current limitations:

- no cycle interval;
- no last completion basis;
- no next due basis;
- no tolerance fields;
- no stored due status.

### `maintenance_template_items`

Model:

- `MaintenanceTemplateItem`

Stored fields:

- `template_id`
- `item_type`
- `item_id`
- `sequence_no`
- `is_required`
- `notes`

Supported item types:

- `STANDARD_TASK`
- `COMPLIANCE_ITEM`
- `SID`

Current role:

- defines the contents of a maintenance template.

Current limitation:

- no per-item interval override;
- no per-item recurrence/tolerance data.

### `task_cards`

Model:

- `TaskCard`

Stored fields relevant to due calculation:

- `task_card_number`
- `title`
- `description`
- `status`
- `work_performed`
- `template_source_id`
- `service_bulletin_id`
- `compliance_item_id`
- `aircraft_id`
- `component_id`
- `mechanic_completed_at`
- `engineer_certified_at`
- `version`

Current role:

- executable task instance, usually inside a workpack.

Current limitation:

- no last-complied aircraft hours/cycles at task completion;
- no next due hours/cycles/date;
- no due status explanation;
- status is workflow status, not due status.

### `workpack_tasks`

Model:

- `WorkpackTask`

Stored fields:

- `workpack_id`
- `task_id`

Current role:

- links task cards to workpacks.

Current limitation:

- no due data.

### `workpack_executions`

Model:

- `WorkpackExecution`

Stored fields relevant to completion:

- `workpack_id`
- `task_id`
- `attempt_no`
- `status`
- `started_at`
- `completed_at`
- `certified_at`

Current role:

- execution attempt tracking.

Current limitation:

- no aircraft hours/cycles at completion;
- completion date may help calendar recurrence, but cannot alone support hour/cycle recurrence.

### `maintenance_requirements`

Model:

- `MaintenanceRequirement`

Stored fields:

- `model_id`
- `title`
- `interval_hours`
- `interval_months`
- `description`

Current role:

- older maintenance requirement structure.
- legacy TBO warning logic can create maintenance requirements and attach them to workpacks.

Current limitation:

- no task-completion ledger;
- no due recalculation authority;
- no cycle interval.

## Proposed Backend Authority

Define a future backend-only service:

`ScheduledTaskDueRecalculationService`

Responsibilities:

- calculate due status for scheduled maintenance tasks;
- determine task applicability before calculation;
- use aircraft utilisation snapshot hours/cycles;
- evaluate hour/calendar/mixed intervals through `DueStatusService`;
- return explainable scheduled-task due results;
- return `UNKNOWN` where last compliance or baseline data is missing;
- expose entry points for utilisation, completion, import, applicability, and manual recalculation.

Non-responsibilities:

- creating workpacks;
- closing workpacks;
- mutating task lifecycle status;
- sending notifications;
- grounding aircraft;
- running calendar jobs;
- frontend due calculations.

Frontend rule:

- frontend must display backend due results only.
- frontend must not calculate due status, remaining values, next due values, or governing limits.

## Scheduled Task Due Rule Model

Scheduled task due status must be calculated only for tasks applicable to the aircraft.

Supported dimensions:

- aircraft hours;
- aircraft cycles, when future cycle intervals exist;
- calendar/date;
- mixed hour/cycle/date.

Current available dimensions:

- hours from `TaskTemplate.interval_hours`, `MaintenanceTemplate.interval_hours`, or `MaintenanceRequirement.interval_hours`;
- months from `TaskTemplate.interval_months`, `MaintenanceTemplate.interval_months`, or `MaintenanceRequirement.interval_months`.

Missing dimensions:

- cycle interval fields;
- next due cycles;
- last complied cycles.

### Hour-Based Intervals

Rule:

- next due hours = last complied hours + interval hours.
- if no last complied hours exists, use an approved initial/imported baseline.
- if neither last complied hours nor baseline exists, return `UNKNOWN`.

Current limitation:

- no standard task last complied hours are stored today.
- task completion currently stores dates/users but not aircraft hours.

### Cycle-Based Intervals

Rule:

- next due cycles = last complied cycles + interval cycles.
- if no last complied cycles exists, use an approved initial/imported baseline.
- if no cycle interval or baseline exists, return `UNKNOWN`.

Current limitation:

- no scheduled task cycle interval fields exist today.
- no task completion cycle baseline exists today.

Phase 9 DEFINE keeps cycles in the contract but does not assume current cycle calculation is possible.

### Calendar-Based Intervals

Rule:

- next due date = last complied date + interval months/days.
- if no last complied date exists, use an approved initial/imported baseline date.
- if no date basis exists, return `UNKNOWN`.

Current possible sources:

- `TaskCard.mechanic_completed_at`;
- `TaskCard.engineer_certified_at`;
- `WorkpackExecution.completed_at`;
- `WorkpackExecution.certified_at`;
- imported baseline date if later added.

Calendar calculations must use date-only semantics.

### Mixed Intervals

Rule:

- evaluate each dimension independently;
- combine through `DueStatusService.evaluateMixed()`;
- most restrictive limit wins;
- partial UNKNOWN warnings remain visible.

Example:

- hours remaining: `20` -> `NOT_DUE`
- calendar days remaining: `5` -> `DUE_SOON`
- aggregate status: `DUE_SOON`, governing limit: calendar.

## Last-Compliance Basis

A scheduled-task due calculation must identify the last compliance basis used.

Required future basis values:

- last complied hours;
- last complied cycles;
- last complied date;
- initial baseline hours;
- initial baseline cycles;
- initial baseline date;
- imported baseline hours/cycles/date;
- source workpack/task/execution reference.

Current possible evidence:

- `TaskCard.template_source_id` links an executed task to a standard task template.
- `TaskCard.mechanic_completed_at` and `engineer_certified_at` can support date recurrence.
- `WorkpackExecution.completed_at` and `certified_at` can support date recurrence.
- `TaskCard.status` and `WorkpackExecution.status` can identify completed/certified tasks.

Current missing evidence:

- aircraft hours at task completion;
- aircraft cycles at task completion;
- explicit initial due baseline;
- imported last-done baseline table;
- structured one-task-per-aircraft recurrence ledger.

UNKNOWN rule:

- If the task is applicable and recurring but the required last-compliance or baseline data is missing, return `UNKNOWN`.

## Recurring Behavior

### Recurring Tasks

A task is recurring when it has an hour, cycle, or calendar interval and no terminating one-time rule has stopped recurrence.

For recurring tasks:

- use last compliance basis plus interval;
- calculate next due;
- evaluate due status from current aircraft values/date.

### One-Time Tasks

A task is one-time when:

- it has no recurrence interval and is defined as a one-off requirement; or
- it is marked complete with a terminating action once future fields exist.

One-time behavior:

- if completed/terminated, return `NOT_DUE` or `NOT_APPLICABLE` according to the source semantics;
- if not completed and applicable, return `DUE` if required now, or `UNKNOWN` if no due basis exists.

### Repetitive Inspections

Repetitive inspections use the same recurrence model as recurring tasks:

- last inspection basis + repeat interval;
- mixed limits evaluated through `DueStatusService`.

### Escalation Handling

No escalation model exists today.

Future escalation fields may define:

- grace period expired;
- repeat finding escalated;
- inspection severity increased;
- authority override.

Until such fields exist, Phase 9 due calculation must not invent escalation behavior.

### Tolerance Handling

No tolerance fields exist today.

Future tolerance fields may define:

- early/late hour tolerance;
- cycle tolerance;
- calendar-day tolerance.

Until such fields exist:

- due thresholds come from `DueStatusService`;
- no maintenance tolerance may be applied.

## Applicability Rules

Scheduled task due status must be calculated only after applicability is resolved.

Applicability sources:

- `TaskTemplate.scope`
  - `GLOBAL`
  - `MPI`
  - `MODEL`
  - `AIRCRAFT`
- `TaskTemplate.aircraft_model_id`
- `TaskTemplate.aircraft_id`
- `TaskTemplate.model_applicability`
- `TaskTemplate.aircraft_applicability`
- task-template applicability flags;
- `MaintenanceTemplate.model_id`;
- `MaintenanceTemplateItem.item_type`;
- `MaintenanceTemplateItem.is_required`;
- installed component context when `TaskCard.component_id` or future component-task links exist.

Workpack generation already applies some template-item applicability:

- standard task active/scope/model/aircraft filtering;
- SB compliance item applicability;
- SID model applicability.

Future scheduled-task due service must reuse or mirror those rules as backend authority.

Applicability outcomes:

- applicable -> calculate due status.
- not applicable -> return `NOT_APPLICABLE`.
- cannot determine applicability -> return `UNKNOWN`.

## Recalculation Triggers

Future recalculation should occur after:

- confirmed utilisation event;
- task completion/certification;
- task baseline import;
- maintenance template import/update;
- task template import/update;
- applicability change;
- aircraft model/configuration change;
- installed component change where tasks are component-applicable;
- manual recalculation request;
- later calendar/date monitor tick.

Phase 9 DEFINE does not implement triggers.

## Explanation Output Contract

Each scheduled-task due result must explain the calculation.

Recommended result shape:

```ts
type ScheduledTaskDueResult = {
  task_identity: {
    task_template_id: string | null;
    maintenance_template_id: string | null;
    maintenance_template_item_id: string | null;
    task_card_id: string | null;
    reference: string;
    title: string;
  };
  source_program: {
    source_type:
      | 'TASK_TEMPLATE'
      | 'MAINTENANCE_TEMPLATE'
      | 'MAINTENANCE_REQUIREMENT'
      | 'WORKPACK_TASK'
      | 'IMPORTED_BASELINE';
    source_id: string | null;
    template_type: string | null;
  };
  applicability: {
    status: 'APPLICABLE' | 'NOT_APPLICABLE' | 'UNKNOWN';
    source: string | null;
    reason: string | null;
  };
  interval: {
    interval_hours: number | null;
    interval_cycles: number | null;
    interval_months: number | null;
    interval_days: number | null;
    interval_type: 'HOURS' | 'CYCLES' | 'CALENDAR' | 'MIXED' | 'NONE';
  };
  current_aircraft: {
    hours: number | null;
    cycles: number | null;
    date: string;
  };
  last_compliance: {
    hours: number | null;
    cycles: number | null;
    date: string | null;
    source: string | null;
  };
  next_due: {
    hours: number | null;
    cycles: number | null;
    date: string | null;
    source: string | null;
  };
  due_status: DueStatusResult;
  status: 'NOT_DUE' | 'DUE_SOON' | 'DUE' | 'OVERDUE' | 'UNKNOWN' | 'NOT_APPLICABLE';
  governing_limit: DueStatusResult['governing_limit'];
  remaining_value: number | string | null;
  unknown_reason: string | null;
  explanation: string;
  calculated_at: string;
};
```

Required explanation fields:

- task identity;
- source program/template;
- interval type;
- current aircraft values;
- last compliance basis;
- next due basis;
- remaining value;
- status;
- governing limit;
- UNKNOWN reason where applicable.

## Relationship To Existing Workpacks

Scheduled task due calculation is upstream of workpack planning.

Rules:

- due calculation must not create workpacks;
- due calculation must not close workpacks;
- due calculation must not mutate task-card lifecycle;
- due calculation must not insert `workpack_tasks`;
- due calculation must not create `workpack_executions`;
- workpack generation/planning may later consume due results;
- workpack lifecycle remains its own authority.

Current workpack generation:

- creates task cards and executions from selected maintenance template items.
- uses template applicability to decide what can be generated.
- does not currently ask a scheduled-task due service whether an item is due.

Future integration:

- planning screens can show due results;
- generation can filter or prioritize due tasks only after an explicit later phase approves that behavior.

## Implementation Scope For Future Phase 9

Future Phase 9 IMPLEMENT should be limited to:

- add backend-only `ScheduledTaskDueRecalculationService`;
- calculate due status for standard task templates where required basis exists;
- calculate due status for maintenance templates/program checks where required basis exists;
- use `DueStatusService` for all due-state decisions;
- return `UNKNOWN` for missing last-compliance/baseline values;
- return `NOT_APPLICABLE` for non-applicable tasks;
- add entry points for utilisation, completion, baseline import, applicability change, and manual recalculation;
- add focused tests for:
  - hour interval due;
  - calendar interval due;
  - mixed hour/calendar due;
  - missing last-compliance UNKNOWN;
  - imported baseline;
  - not applicable;
  - one-time completed task;
  - workpack boundary no-mutation behavior.

## Out Of Scope

Do not implement in Phase 9 DEFINE:

- calendar monitor;
- notification engine;
- automatic workpack creation;
- automatic workpack closure;
- automatic workpack refresh;
- automatic grounding;
- frontend due calculations;
- due snapshot persistence;
- migrations.

## Risks

- Current task completion records do not capture aircraft hours or cycles, so hour/cycle recurrence cannot be safely derived without future baseline/completion fields.
- No cycle interval fields exist for scheduled tasks today.
- Maintenance template intervals may represent check/package cadence, not every individual task's due basis.
- Workpack task status is execution state, not due status.
- Existing task templates include applicability text/flags that may need normalization before due calculations are reliable.
- Imported standard tasks may have interval fields, but not last-done history.
- Applying due results to workpack creation would change planning behavior and must remain out of scope until explicitly approved.
