# Phase 10 - Calendar Due Monitor

## Mode

DEFINE only.

No implementation, code changes, migrations, refactors, notification engine, automatic emails, automatic workpack creation, automatic grounding, or frontend date calculations are part of this phase definition.

## Goal

Define how Jupiter will keep date and calendar-based due items current when the aircraft hours and cycles do not change.

Calendar due status must be recalculated from the current date, domain due dates, and `DueStatusService`. The frontend must display backend results only.

## Current Implementation Status

Status: PARTIAL.

Existing date-based due calculation exists inside domain services:

- `DueStatusService`
  - provides `evaluateCalendarDays()` and a default calendar warning threshold.
- `ComplianceDueRecalculationService`
  - evaluates AD/SB/SID date due values when recalculation is manually called through service entry points.
- `ScheduledTaskDueRecalculationService`
  - evaluates scheduled task calendar intervals when recalculation is manually called through service entry points.
- `ComponentLimitMonitoringService`
  - evaluates component calendar life and hard-life date dimensions.
- `LibraryService.evaluateSerializedComponentLifeLimits()`
  - still contains legacy serialized component life-limit calendar evaluation.

Missing today:

- no `CalendarDueMonitorService`;
- no scheduler for due status becoming due/overdue as today changes;
- no manual Admin/QA "Recalculate Due Status" action dedicated to calendar due monitoring;
- no persisted due-status snapshot table for calendar monitor output;
- no notification engine;
- no automatic workpack refresh based on date changes;
- no automatic grounding based on calendar due changes.

There is an existing background cron mechanism for service bulletin sync only. It must not be treated as a due monitor.

## Files Inspected

- `src/modules/due-status/due-status.service.ts`
- `src/modules/compliance/compliance-due-recalculation.service.ts`
- `src/modules/tasks/scheduled-task-due-recalculation.service.ts`
- `src/modules/aircraft/component-limit-monitoring.service.ts`
- `src/modules/library/library.service.ts`
- `src/modules/compliance/compliance.service.ts`
- `src/modules/compliance/applicability-engine.service.ts`
- `src/modules/service-bulletins/service-bulletin-sync.service.ts`
- `src/server.ts`
- `src/models/AirworthinessDirective.ts`
- `src/models/ServiceBulletin.ts`
- `src/models/SupplementalInspectionDocument.ts`
- `src/models/aircraft_sid_tracking`
- `src/models/SerializedComponentLifeState.ts`
- `src/models/ComponentLifeLimit.ts`
- `src/models/core/TaskTemplate.ts`
- `src/models/MaintenanceTemplate.ts`
- `src/models/MaintenanceRequirement.ts`
- `migrations/440_create_aircraft_compliance.ts`
- `migrations/480_create_airworthiness_directive_schema.ts`
- `migrations/410_create_aircraft_sid_status.ts`
- `migrations/470_add_standard_task_import_fields_to_task_templates.ts`
- `migrations/520_create_maintenance_templates.ts`

## Existing Date-Based Logic

### DueStatusService

`DueStatusService.evaluateCalendarDays()` evaluates a date/calendar limit using:

- current value;
- due value;
- remaining days;
- calendar-day threshold;
- `NOT_DUE`, `DUE_SOON`, `DUE`, `OVERDUE`, `UNKNOWN`, or `NOT_APPLICABLE`.

It is the due-state authority. Calendar monitor must call it rather than ranking date statuses itself.

### Compliance AD/SB/SID

`ComplianceDueRecalculationService` supports date due calculation for:

- AD/SB through `aircraft_compliance.next_due_at`;
- recurring AD/SB when `last_complied_at` and `interval_months` are available;
- SID through `aircraft_sid_status.next_due_date`;
- SID initial/repeat date intervals through `initial_interval_months` and `repeat_interval_months`.

It calculates remaining days using today's date at call time. However, it only updates returned results when the service is invoked. It is not currently scheduled to run just because the date changed overnight.

### Scheduled Tasks

`ScheduledTaskDueRecalculationService` supports calendar intervals through:

- `TaskTemplate.interval_months`;
- `MaintenanceTemplate.interval_months`;
- `MaintenanceRequirement.interval_months`;
- completion date evidence from `TaskCard` and `WorkpackExecution`;
- imported baseline dates.

It evaluates calendar due status through `DueStatusService.evaluateCalendarDays()`. It does not run automatically as the current date changes.

### Component Calendar Life / Hard Life

`ComponentLimitMonitoringService` supports:

- `CALENDAR_LIFE`;
- `HARD_LIFE`;
- component life limits with `limit_months`;
- `SerializedComponentLifeState.calendar_reference_date`;
- `SerializedComponentLifeState.overhaul_reference_date`;
- `DueStatusService.evaluateCalendarDays()`.

It calculates component calendar remaining days at service call time.

### Legacy Serialized Component Life-Limit Calendar Logic

`LibraryService.evaluateSerializedComponentLifeLimits()` still evaluates:

- `limit_months`;
- reference date from `calendar_reference_date` or `overhaul_reference_date`;
- `remaining_calendar_days`;
- `due_date`;
- aggregate status.

This legacy logic uses `DueStatusService` helper status functions in places, but it remains compatibility logic until fully replaced by the newer component monitoring authority.

### Dashboard / Workpack Visibility

Current workpack planning views show task/template interval data and can create workpack candidates. Workpacks do not currently receive automatic calendar due refreshes. Due calculation must remain upstream of workpack planning until a later phase explicitly approves workpack consumption and refresh behavior.

## Calendar Due Authority

Define a future backend-only service:

`CalendarDueMonitorService`

Responsibilities:

- recalculate date/calendar due status across approved domains;
- use existing domain calculation services where possible;
- pass current date into date calculations where services support it;
- return explainable calendar due results;
- expose a manual recalculation entry point;
- optionally support a future scheduler entry point without changing result semantics.

Non-responsibilities:

- notification engine;
- automatic emails;
- automatic workpack creation;
- automatic workpack refresh;
- automatic grounding;
- frontend date calculations.

Frontend rule:

- frontend may request and display monitor results;
- frontend must not calculate remaining days, due states, or governing date limits.

## Current-Date Based Due Checks

Calendar due status must change as the current date changes.

Rules:

- due date in the future beyond threshold -> `NOT_DUE`;
- due date within warning threshold -> `DUE_SOON`;
- due date equal to current date -> `DUE`;
- due date before current date -> `OVERDUE`;
- missing due date or missing reference date -> `UNKNOWN`;
- not applicable item -> `NOT_APPLICABLE`.

All status decisions must go through `DueStatusService.evaluateCalendarDays()` or a domain service that delegates to it.

The monitor must use date-only semantics:

- compare calendar dates, not local clock time;
- normalize current date to an explicit date value;
- avoid timezone drift changing results around midnight.

## Manual Recalculation Baseline

Until a scheduling engine/background due job is approved, manual recalculation is the safe baseline.

Define a future Admin/QA action:

`Recalculate Due Status`

Minimum behavior:

- requires Admin or QA-level permission;
- accepts optional scope:
  - all aircraft;
  - one aircraft;
  - one domain;
  - one item reference where supported;
- runs backend calendar due recalculation;
- returns a read-only report;
- does not create workpacks;
- does not ground aircraft;
- does not send notifications;
- records audit evidence that recalculation was requested and completed when persistence is later introduced.

If no due-status snapshot persistence exists, manual recalculation returns calculated results only. It must not pretend to have updated a stored system-of-record status.

## No-Automation Baseline

Phase 10 must assume no scheduler exists yet for due status.

Safe baseline:

- Admin/QA manually runs recalculation.
- Domain services calculate current results from today's date.
- Results are displayed or exported as a read-only report.
- No downstream actions are automatic.

Future scheduler:

- may call the same `CalendarDueMonitorService`;
- must produce the same result contract as manual recalculation;
- must be separately approved and verified;
- must be idempotent;
- must not create workpacks, notifications, or grounding actions unless later phases explicitly add those integrations.

## Recalculation Triggers

Calendar due monitor recalculation may be requested by domain events, but Phase 10 does not require a scheduler or automatic background job.

### Compliance Updates

Calendar due monitor may be triggered after:

- AD compliance entry;
- SB compliance entry;
- SID compliance entry;
- compliance correction;
- terminating action entry.

Rules:

- use the compliance due recalculation authority for AD/SB/SID due results;
- include calendar/date limits where `next_due_at`, `next_due_date`, or interval-month recurrence data exists;
- terminating actions may stop recurring calendar due calculation for that item according to compliance rules;
- missing date basis returns `UNKNOWN`, not guessed due dates.

### Utilisation Updates Where Relevant

Calendar due monitor may be triggered after a confirmed utilisation update only where the affected due result is mixed and includes a calendar limit.

Rules:

- mixed hour/date/cycle results may need recalculation after utilisation because the governing limit can change;
- purely date-based due does not require an aircraft utilisation change to become `DUE` or `OVERDUE`;
- utilisation-triggered calendar monitor execution must not imply aircraft hours/cycles are the authority for calendar-only due;
- the current date remains the authority for date-only remaining-day calculations.

### Applicability Changes

Calendar due monitor may be triggered after:

- aircraft model/type change;
- SB applicability change;
- AD applicability change;
- SID applicability change;
- component install/removal affecting applicability;
- maintenance program/template applicability change.

Rules:

- not-applicable items return `NOT_APPLICABLE`;
- newly applicable items must be recalculated using current date and available due basis;
- if applicability cannot be determined, return `UNKNOWN`;
- component install/removal triggers remain read-only for calendar due monitoring and must not create workpacks or grounding actions.

## Affected Domains

The calendar monitor should later cover these domains.

### Component Calendar Life

Source data:

- installed serialized components;
- `ComponentLifeLimit.limit_months`;
- `SerializedComponentLifeState.calendar_reference_date`;
- `SerializedComponentLifeState.overhaul_reference_date`;
- `ComponentLimitMonitoringService`.

Expected result:

- component calendar life due status;
- due date;
- remaining days;
- UNKNOWN when reference dates or limit months are missing.

### Hard-Life Dates

Source data:

- `ComponentLifeLimit` classified as `HARD_LIFE`;
- `limit_months`;
- serialized component life reference dates;
- `ComponentLimitMonitoringService` severity rules.

Expected result:

- due status from `DueStatusService`;
- separate severity from component monitoring;
- severe handling remains report-only until grounding is explicitly approved.

### AD Date Due

Source data:

- `aircraft_compliance.next_due_at`;
- `aircraft_compliance.last_complied_at`;
- AD `interval_months`;
- applicability from `ApplicabilityEngineService`;
- `ComplianceDueRecalculationService`.

Expected result:

- AD date due status;
- mixed hour/date due status where both exist;
- UNKNOWN when applicable item has no due basis.

### SB Date Due

Source data:

- `ComplianceItem.issued_on`;
- `ServiceBulletin.issued_on` / `issue_date`;
- `aircraft_compliance.next_due_at`;
- applicability from the existing compliance/applicability flow.

Expected result:

- SB date due where due date data exists;
- NOT_APPLICABLE where applicability excludes the item;
- UNKNOWN where no due date/basis exists.

### SID Date Due

Source data:

- `aircraft_sid_status.last_done_date`;
- `aircraft_sid_status.next_due_date`;
- `SupplementalInspectionDocument.initial_interval_months`;
- `SupplementalInspectionDocument.repeat_interval_months`;
- SID model applicability.

Expected result:

- SID date due status;
- mixed hour/date due status where both exist;
- UNKNOWN when SID interval or status basis is missing.

### Scheduled Task Calendar Intervals

Source data:

- `TaskTemplate.interval_months`;
- `MaintenanceTemplate.interval_months`;
- `MaintenanceRequirement.interval_months`;
- task completion/certification dates from `TaskCard`;
- completion/certification dates from `WorkpackExecution`;
- imported baseline dates where available;
- `ScheduledTaskDueRecalculationService`.

Expected result:

- scheduled task date due status;
- mixed hour/date due status where both exist;
- UNKNOWN when last-compliance or baseline date is missing.

## Proposed Monitor Result Contract

Each calendar recalculation result must include:

```ts
type CalendarDueMonitorResult = {
  item_type:
    | 'COMPONENT_CALENDAR_LIFE'
    | 'COMPONENT_HARD_LIFE'
    | 'AD'
    | 'SB'
    | 'SID'
    | 'SCHEDULED_TASK';
  item_id: string | null;
  reference: string;
  aircraft_id: string | null;
  component_id: string | null;
  current_date: string;
  due_date: string | null;
  remaining_days: number | null;
  status: 'NOT_DUE' | 'DUE_SOON' | 'DUE' | 'OVERDUE' | 'UNKNOWN' | 'NOT_APPLICABLE';
  governing_limit: unknown;
  unknown_reason: string | null;
  source_service:
    | 'ComponentLimitMonitoringService'
    | 'ComplianceDueRecalculationService'
    | 'ScheduledTaskDueRecalculationService'
    | 'LibraryServiceCompatibility';
  explanation: string;
  calculated_at: string;
};
```

Required explanation fields:

- item type;
- reference;
- current date;
- due date;
- remaining days;
- status;
- governing limit;
- UNKNOWN reason where applicable.

## Proposed Service Shape

Future service:

```ts
class CalendarDueMonitorService {
  static async recalculateManually(params: CalendarDueMonitorParams): Promise<CalendarDueMonitorReport>;
  static async recalculateForAircraft(aircraftId: string, params?: CalendarDueMonitorParams): Promise<CalendarDueMonitorReport>;
  static async recalculateAll(params?: CalendarDueMonitorParams): Promise<CalendarDueMonitorReport>;
}
```

Report shape:

```ts
type CalendarDueMonitorReport = {
  scope: string;
  current_date: string;
  results: CalendarDueMonitorResult[];
  summary: {
    not_due: number;
    due_soon: number;
    due: number;
    overdue: number;
    unknown: number;
    not_applicable: number;
  };
  warnings: string[];
  calculated_at: string;
};
```

## Implementation Scope For Future Phase 10

Future Phase 10 IMPLEMENT should be limited to:

- add backend-only `CalendarDueMonitorService`;
- aggregate date-based due results from completed domain services;
- support manual recalculation as the first safe entry point;
- evaluate current-date status using `DueStatusService`;
- return explainable read-only results;
- add focused tests for:
  - AD date due becoming overdue without utilisation change;
  - SID date due becoming due soon;
  - scheduled task calendar interval due;
  - component calendar life due;
  - hard-life date result with severe component-monitoring detail;
  - UNKNOWN when date basis is missing;
  - no workpack creation or grounding side effects.

## Out Of Scope

Do not implement in Phase 10 DEFINE:

- notification engine;
- automatic emails;
- automatic workpack creation;
- automatic workpack refresh;
- automatic grounding;
- frontend date calculations;
- persisted due snapshots;
- scheduler/background job unless separately approved during implementation;
- migrations.

## Risks

- Date-only calculations can drift if some services use local time and others use UTC.
- Several services currently calculate "today" internally, which makes deterministic monitor testing harder unless current date can be injected later.
- Existing component life-limit calendar logic exists in both `ComponentLimitMonitoringService` and legacy `LibraryService`; implementation must avoid presenting conflicting authorities.
- SB date due status depends on available due basis, not merely issue date.
- Scheduled tasks often lack imported baseline dates, so calendar due status may correctly return UNKNOWN.
- Manual recalculation without stored snapshots may confuse users if the report is not clearly labeled read-only.
- Adding a scheduler later will require operational controls, idempotency, observability, and audit design.
