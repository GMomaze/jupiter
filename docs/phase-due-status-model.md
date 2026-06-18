# Phase 6 - Due Status Model

## Mode

DEFINE only.

No implementation, migrations, refactors, due engines, workpack refreshes, or production behavior changes are part of this phase.

## Goal

Define the unified due status model that future Jupiter services will use for:

- serialized components;
- component TBO and retirement limits;
- ADs;
- SBs;
- SIDs;
- scheduled tasks;
- calendar/date-based items;
- mixed hour/cycle/calendar limits.

The model must create one vocabulary and one explanation shape before any later due recalculation services are implemented.

## Current Implementation Status

Status: PARTIAL and fragmented.

Jupiter currently has several due/status concepts, but no unified `DueStatusService` and no single shared due-state contract.

Existing logic found:

- `src/modules/library/library.service.ts`
  - `evaluateSerializedComponentLifeLimits()` calculates serialized component life-limit visibility from stored life-state values.
  - It uses `UNKNOWN`, `DUE_SOON`, `DUE`, `OVERDUE`, and `COMPLIANT`.
  - It ranks statuses with `UNKNOWN: 0`, `COMPLIANT: 1`, `DUE_SOON: 2`, `DUE: 3`, `OVERDUE: 4`.
  - It uses fixed due-soon thresholds of `10` hours, `10` cycles, and `30` calendar days.
  - It evaluates hours, cycles, and calendar months and chooses the worst computable limit.
- `src/modules/compliance/compliance.service.ts`
  - `calculateAircraftStatus()` calculates AD/SB-like aircraft compliance display state from stored aircraft compliance status, `next_due_hours`, `next_due_at`, and current aircraft hours.
  - It returns `NOT_APPLICABLE`, `OVERDUE`, `COMPLIANT`, or `DUE`.
  - It does not currently emit `DUE_SOON` or `UNKNOWN` in this display-status method.
- `src/modules/workpacks/services/workpack-component-integration.service.ts`
  - Reads serialized component due visibility from `LibraryService.evaluateSerializedComponentLifeLimits()`.
  - Exposes `due_state`, `due_explanation`, `due_worst_limit`, `due_evaluated_limits`, `due_has_unknown_limits`, `due_is_partial`, and `due_missing_reasons`.
- `src/modules/workpacks/services/workpack-operational-maturity.service.ts`
  - Consumes workpack component due visibility for execution cards.
  - Treats `OVERDUE` as rose tone and `DUE`/`DUE_SOON` as amber.
  - This is downstream visibility only, not due authority.
- `src/modules/maintenance/maintenance-trigger.service.ts`
  - Contains older TBO warning behavior at a percent threshold, defaulting to `warning_threshold_percent` or `90`.
  - It creates `MaintenanceRequirement` and attaches it to workpack automation.
  - This must not become the Phase 6 due authority.
- `src/modules/utilisation/utilisation-propagation-preview.service.ts`
  - Phase 5 returns due/compliance placeholders marked `NOT_CALCULATED_IN_PHASE_5`.

Missing today:

- no unified due-state enum;
- no unified explanation contract;
- no single backend due authority;
- no due service that consumes Phase 4 calculated component life;
- no standard `NOT_DUE` mapping; existing component logic uses `COMPLIANT`;
- no common `NOT_APPLICABLE` behavior across all due domains;
- no unified due snapshot model;
- no authoritative AD/SB/SID/scheduled task recalculation on utilisation change.

## Files Inspected

- `src/modules/library/library.service.ts`
- `src/modules/compliance/compliance.service.ts`
- `src/modules/workpacks/services/workpack-component-integration.service.ts`
- `src/modules/workpacks/services/workpack-operational-maturity.service.ts`
- `src/modules/maintenance/maintenance-trigger.service.ts`
- `src/modules/utilisation/utilisation-propagation-preview.service.ts`
- `src/models/ComponentLifeLimit.ts`
- `src/models/SerializedComponentLifeState.ts`
- `src/models/AirworthinessDirective.ts`
- `src/models/ServiceBulletin.ts`
- `src/models/AircraftSbCompliance.ts`
- `src/models/ComplianceItem.ts`
- `src/models/ComplianceAssignment.ts`
- `src/models/SupplementalInspectionDocument.ts`
- `src/models/cessnaSid.model.ts`
- `src/models/core/TaskTemplate.ts`
- `src/models/MaintenanceTemplate.ts`
- `src/models/MaintenanceTemplateItem.ts`

## Unified Due States

Phase 6 defines these canonical states:

### `NOT_DUE`

The item is applicable and calculable, and the remaining margin is greater than the due-soon threshold.

Existing equivalent:

- component life-limit `COMPLIANT` should map to `NOT_DUE` in the unified model.
- compliance `COMPLIANT` may remain a compliance completion state, but due status should use `NOT_DUE` when the item is not currently due.

### `DUE_SOON`

The item is applicable and calculable, and the remaining margin is positive but within the configured warning threshold.

Examples:

- remaining hours > 0 and <= hour threshold;
- remaining cycles > 0 and <= cycle threshold;
- remaining calendar days > 0 and <= calendar threshold.

### `DUE`

The item is applicable and calculable, and the remaining value is exactly zero or the due date is today.

For compliance items that have no future due basis but are open/required, `DUE` may also mean "currently required and not yet complied with."

### `OVERDUE`

The item is applicable and calculable, and the remaining value is negative or the due date is before today.

For hour/cycle compliance, an item is `OVERDUE` when current aircraft/component value is greater than the due value.

### `UNKNOWN`

The item may be applicable, but due status cannot be calculated safely.

Reasons include:

- missing current value;
- missing due value;
- missing baseline;
- missing tracking basis;
- unsupported tracking basis;
- unsupported limit type;
- missing calendar reference date;
- missing applicable life state;
- due source not yet implemented for the item type.

UNKNOWN must not be silently treated as `NOT_DUE`.

### `NOT_APPLICABLE`

The item is known not to apply to the aircraft, component, model, or operational context.

Examples:

- aircraft compliance has stored `NOT_APPLICABLE`;
- applicability engine determines item is not applicable;
- component limit does not apply to that tracking basis or item type.

`NOT_APPLICABLE` is distinct from `UNKNOWN`. Unknown means Jupiter cannot decide; not applicable means Jupiter has decided the item does not apply.

## State Ranking

For urgency comparisons, use this order:

1. `OVERDUE`
2. `DUE`
3. `DUE_SOON`
4. `UNKNOWN`
5. `NOT_DUE`
6. `NOT_APPLICABLE`

Rationale:

- `OVERDUE`, `DUE`, and `DUE_SOON` are action states.
- `UNKNOWN` requires review and must be surfaced ahead of clean `NOT_DUE`.
- `NOT_APPLICABLE` should not drive work requirements.

For "most restrictive computable limit" within one item, ignore `NOT_APPLICABLE`, rank computable states by urgency, and preserve `UNKNOWN` as a separate warning if at least one other limit is computable.

## Threshold Rules

Phase 6 defines defaults. Later implementation may make these configurable.

### Hours

Default due-soon threshold: `10` hours.

Rules:

- remaining hours < 0 -> `OVERDUE`
- remaining hours = 0 -> `DUE`
- remaining hours > 0 and <= 10 -> `DUE_SOON`
- remaining hours > 10 -> `NOT_DUE`

Existing evidence:

- serialized component life-limit logic currently uses `hours: 10`.

### Cycles

Default due-soon threshold: `10` cycles.

Rules:

- remaining cycles < 0 -> `OVERDUE`
- remaining cycles = 0 -> `DUE`
- remaining cycles > 0 and <= 10 -> `DUE_SOON`
- remaining cycles > 10 -> `NOT_DUE`

Existing evidence:

- serialized component life-limit logic currently uses `cycles: 10`.

### Calendar Days

Default due-soon threshold: `30` calendar days.

Rules:

- remaining calendar days < 0 -> `OVERDUE`
- remaining calendar days = 0 -> `DUE`
- remaining calendar days > 0 and <= 30 -> `DUE_SOON`
- remaining calendar days > 30 -> `NOT_DUE`

Existing evidence:

- serialized component life-limit logic currently uses `calendarDays: 30`.

Calendar calculations must use date-only semantics where practical to avoid time-zone drift.

### Mixed Limits

An item may have hours, cycles, and calendar limits at the same time.

Each limit dimension must be evaluated independently, then combined using the most restrictive limit rule.

Example:

- hours remaining: 50 -> `NOT_DUE`
- cycles remaining: 5 -> `DUE_SOON`
- days remaining: -2 -> `OVERDUE`
- aggregate status: `OVERDUE`
- governing limit: calendar

If one dimension is UNKNOWN and another is computable:

- aggregate status should use the most restrictive computable status;
- `has_unknown_limits` should be true;
- explanation must state that calculation is partial.

If all dimensions are UNKNOWN:

- aggregate status is `UNKNOWN`;
- no governing computable limit exists.

## Most Restrictive Limit Rule

For a single item with multiple limits:

1. Normalize every limit to the Phase 6 due-state enum.
2. Discard `NOT_APPLICABLE` from urgency ranking but include it in evaluated details.
3. If any limit is `OVERDUE`, aggregate status is `OVERDUE`.
4. Else if any limit is `DUE`, aggregate status is `DUE`.
5. Else if any limit is `DUE_SOON`, aggregate status is `DUE_SOON`.
6. Else if all applicable limits are `UNKNOWN`, aggregate status is `UNKNOWN`.
7. Else if at least one limit is `NOT_DUE` and one or more limits are `UNKNOWN`, aggregate status is `NOT_DUE` with `is_partial = true` and UNKNOWN warnings.
8. Else aggregate status is `NOT_DUE`.
9. If every evaluated limit is `NOT_APPLICABLE`, aggregate status is `NOT_APPLICABLE`.

Tie-breakers when multiple limits have the same state:

- prefer the limit with the smallest absolute remaining value;
- for mixed units, preserve all tied governing limits in explanation instead of pretending one unit is objectively smaller;
- expose a `governing_limits` array, not only one `governing_limit`, where ties or mixed-unit ambiguity exist.

## Due Explanation Contract

Every due result must explain the calculation.

Recommended type:

```ts
type DueState =
  | 'NOT_DUE'
  | 'DUE_SOON'
  | 'DUE'
  | 'OVERDUE'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

type DueBasis =
  | 'AIRCRAFT_HOURS'
  | 'AIRCRAFT_CYCLES'
  | 'COMPONENT_TSN'
  | 'COMPONENT_TSO'
  | 'COMPONENT_CSN'
  | 'COMPONENT_CSO'
  | 'CALENDAR'
  | 'MANUAL'
  | 'APPLICABILITY'
  | 'UNSUPPORTED';

type DueStatusResult = {
  item_type:
    | 'COMPONENT_LIFE_LIMIT'
    | 'COMPONENT_TBO'
    | 'COMPONENT_RETIREMENT'
    | 'AD'
    | 'SB'
    | 'SID'
    | 'SCHEDULED_TASK'
    | 'CALENDAR_ITEM';
  item_id: string | null;
  item_reference: string | null;
  status: DueState;
  tracking_basis: DueBasis;
  current_value: number | string | null;
  due_value: number | string | null;
  remaining_value: number | string | null;
  remaining_unit: 'HOURS' | 'CYCLES' | 'DAYS' | 'MONTHS' | 'NONE';
  threshold_used: number | null;
  threshold_unit: 'HOURS' | 'CYCLES' | 'DAYS' | 'MONTHS' | 'NONE';
  governing_limit: DueLimitEvaluation | null;
  governing_limits: DueLimitEvaluation[];
  evaluated_limits: DueLimitEvaluation[];
  is_partial: boolean;
  unknown_reasons: string[];
  not_applicable_reason: string | null;
  explanation: string;
  calculated_at: string;
};

type DueLimitEvaluation = {
  limit_id: string | null;
  limit_type: string | null;
  tracking_basis: DueBasis;
  current_value: number | string | null;
  due_value: number | string | null;
  remaining_value: number | string | null;
  remaining_unit: 'HOURS' | 'CYCLES' | 'DAYS' | 'MONTHS' | 'NONE';
  threshold_used: number | null;
  status: DueState;
  unknown_reasons: string[];
  explanation: string;
};
```

Required explanation fields:

- item type;
- tracking basis;
- current value;
- due value;
- remaining value;
- threshold used;
- governing limit;
- status;
- UNKNOWN reason where applicable;
- NOT_APPLICABLE reason where applicable;
- whether calculation is partial.

## Snapshots vs Derived Status

### Calculated Live

The first implementation should calculate due status live from authoritative inputs:

- aircraft utilisation authority;
- component life calculation output;
- install/removal baselines;
- component life limits;
- compliance records;
- applicability records;
- scheduled task intervals;
- calendar references.

Live calculation is the source of truth until a later phase defines due snapshots.

### Stored Snapshot Later

A later phase may store due snapshots for performance, audit, or reporting.

If snapshots are introduced, they must store:

- source item identity;
- due status;
- calculated current value;
- due value;
- remaining value;
- governing limit;
- unknown reasons;
- calculation inputs hash or source references;
- calculated_at;
- triggering event reference, such as utilisation event ID, install/remove event, compliance update, or manual recalculation.

### Recalculation Triggers

Future recalculation should happen when authoritative inputs change:

- utilisation event confirmed;
- component install/removal baseline captured;
- component maintenance/life-state event recorded;
- overhaul event changes TSO/CSO basis;
- compliance item imported or updated;
- SB/AD/SID applicability updated;
- scheduled task interval changed;
- calendar reference changes;
- manual recalculation requested.

### Auditability

Even if due status is live-derived, the inputs must be auditable.

If snapshots are stored later, snapshot creation/update must be auditable and linked to the event that caused recalculation.

## Backend Service Boundary

Define a future backend-only authority:

`DueStatusService`

Responsibilities:

- normalize due states;
- evaluate hour/cycle/calendar/manual/applicability due limits;
- choose governing limit(s);
- return unified explanation contract;
- expose `UNKNOWN` and `NOT_APPLICABLE` distinctly;
- support item types incrementally without changing the public result shape.

Non-responsibilities in Phase 6 DEFINE:

- creating maintenance requirements;
- grounding aircraft;
- generating workpacks;
- marking compliance complete;
- sending notifications;
- mutating aircraft, component, compliance, or workpack records.

Frontend rule:

- frontend must display backend due status results only;
- frontend must not calculate lifecycle truth, due status, remaining values, or governing limits.

## Existing Logic Mapping

### Serialized Component Life Limits

Existing:

- `LibraryService.evaluateSerializedComponentLifeLimits()`
- statuses: `UNKNOWN`, `COMPLIANT`, `DUE_SOON`, `DUE`, `OVERDUE`
- thresholds: 10 hours, 10 cycles, 30 calendar days
- status ranking and worst-limit selection already exist.

Phase 6 mapping:

- `COMPLIANT` -> `NOT_DUE`
- retain `DUE_SOON`, `DUE`, `OVERDUE`, `UNKNOWN`
- add explicit `NOT_APPLICABLE`
- move future authority into `DueStatusService`

### AD/SB Compliance Due

Existing:

- `ComplianceService.calculateAircraftStatus()` returns `NOT_APPLICABLE`, `OVERDUE`, `COMPLIANT`, or `DUE`.
- Uses aircraft total hours, stored `next_due_hours`, stored `next_due_at`, and stored compliance status.

Phase 6 mapping:

- `COMPLIANT` with no due breach -> `NOT_DUE`
- `DUE` stays `DUE`
- `OVERDUE` stays `OVERDUE`
- `NOT_APPLICABLE` stays `NOT_APPLICABLE`
- missing due basis should become `UNKNOWN` when the item needs calculation but lacks data.

### Scheduled Tasks

Existing:

- `TaskTemplate`, `MaintenanceTemplate`, and `MaintenanceTemplateItem` store interval information.
- Workpack generation and preview use templates, but there is no unified scheduled-task due recalculation service.

Phase 6:

- scheduled task due status is defined by contract only.
- implementation remains later.

### Workpack Due Visibility

Existing:

- workpack component integration consumes serialized component due visibility.
- workpack operational maturity consumes `due_state` for display/tone.

Phase 6:

- workpack layers remain consumers only.
- they must not become due status authority.

### TBO and Retirement

Existing:

- legacy TBO checks exist in `MaintenanceTriggerService`, install/restore validators, and utilisation legacy compatibility logic.
- component life limits support `limit_type`, `basis`, `limit_hours`, `limit_cycles`, and `limit_months`.

Phase 6:

- TBO/retirement statuses are part of the unified due model contract.
- TBO monitoring and retirement enforcement are not implemented in this phase.

## Implementation Scope For Future Phase 6 IMPLEMENT

Future implementation should be limited to:

- add `DueStatusService`;
- define shared types/enums for due states and due result shape;
- adapt component life-limit evaluation behind the unified service;
- map existing `COMPLIANT` output to `NOT_DUE`;
- preserve current read-only views by displaying backend result shape;
- add focused tests for:
  - hour thresholds;
  - cycle thresholds;
  - calendar thresholds;
  - mixed-limit worst status;
  - partial UNKNOWN limits;
  - all UNKNOWN limits;
  - NOT_APPLICABLE handling;
  - explanation contract.

## Out Of Scope

Do not implement in Phase 6 DEFINE:

- component TBO monitoring;
- aircraft grounding;
- maintenance requirement creation;
- AD recalculation;
- SB recalculation;
- SID recalculation;
- scheduled task recalculation;
- calendar monitor;
- notification engine;
- automatic workpack refresh;
- workpack lifecycle changes;
- due snapshot persistence;
- migrations.

## Risks

- Existing `COMPLIANT` terminology conflicts with requested `NOT_DUE`; implementation must map carefully without breaking existing views.
- UNKNOWN must remain visible; hiding unknown data as not due would create unsafe maintenance assumptions.
- Mixed limits can produce ambiguous tie-breaks across units; explanation must show all governing limits when needed.
- Existing TBO warning automation creates maintenance requirements and workpack links; future due service must not accidentally trigger that behavior while calculating status.
- Compliance status and due status are related but not identical. A completed compliance item may still have a future recurring due basis.
- Calendar calculations must avoid timezone artifacts by using date-only semantics.
