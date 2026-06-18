# Phase 7 - Component TBO / Retirement Monitoring

## Mode

DEFINE only.

No implementation, migrations, refactors, due engines beyond the existing Phase 6 foundation, workpack refreshes, notifications, or automatic grounding changes are part of this phase definition.

## Goal

Define how Jupiter will monitor serialized component TBO, retirement, hard-life, calendar-life, hour-limit, cycle-limit, and manual authorised limits using the completed foundations:

- aircraft utilisation event authority;
- installed component tracking basis and baselines;
- backend component life calculation;
- unified due status model.

Phase 7 is a monitoring design. It defines the future authority and output contract for component limit status. It does not enforce grounding, create maintenance requirements, recalculate AD/SB/SID/task due status, or refresh workpacks.

## Current Implementation Status

Status: PARTIAL.

Jupiter has the storage and calculation foundations, but does not yet have a dedicated component TBO/retirement monitoring authority.

Existing foundations:

- `src/models/ComponentLifeLimit.ts`
  - stores component-model life limits with `limit_type`, `basis`, `limit_hours`, `limit_cycles`, `limit_months`, `description`, and `is_active`.
- `src/models/SerializedComponentLifeState.ts`
  - stores manual/current life-state values: `tsn_hours`, `tso_hours`, `csn_cycles`, `cso_cycles`, `overhaul_reference_date`, and `calendar_reference_date`.
- `src/models/AircraftComponentInstallation.ts`
  - stores serialized install/removal baselines including `tracking_basis`, install/removal aircraft hours/cycles, TSN/TSO, and CSN/CSO.
- `src/modules/aircraft/component-life-calculation.service.ts`
  - calculates current TSN/TSO/CSN/CSO for serialized installations from tracking basis and baselines where possible.
  - returns `UNKNOWN` rather than guessing when baselines or meter authority are missing.
- `src/modules/due-status/due-status.service.ts`
  - provides unified due states, threshold helpers, mixed-limit selection, and explanation shape.
- `src/modules/library/library.service.ts`
  - currently evaluates serialized component life limits against stored `SerializedComponentLifeState` values.
  - normalizes older `COMPLIANT` language to the Phase 6 `NOT_DUE` state through `DueStatusService`.
- `src/modules/utilisation/utilisation.service.ts`
  - keeps temporary legacy TBO grounding compatibility behind utilisation updates.

Existing legacy TBO paths:

- `src/models/core/AircraftComponent.ts`
  - legacy installed components use `install_af_hours`, `tsn_at_install`, `tso_at_install`, `current_status`, and `removed_at`.
- `src/models/ComponentModel.ts`
  - legacy/default limits include `default_tbo_hours`, `default_tbo_months`, `warning_threshold_percent`, `overhaul_interval_hours`, and `overhaul_interval_months`.
- `src/modules/utilisation/utilisation.service.ts`
  - legacy compatibility check grounds an active aircraft when legacy component total time reaches `default_tbo_hours`.
- `src/modules/maintenance/maintenance-trigger.service.ts`
  - older warning behavior creates a `MaintenanceRequirement` and attaches it to workpack automation at `warning_threshold_percent`, defaulting to `90`.
- `src/modules/aircraft/component-lifecycle.validator.ts`
  - prevents some legacy TBO-exceeded operations.
- `src/modules/aircraft/aircraft-component.service.ts`
  - preserves legacy install/restore TBO checks.

Missing today:

- no dedicated `ComponentLimitMonitoringService`;
- no monitor that evaluates `ComponentLifeLimit` from `ComponentLifeCalculationService` output;
- no explicit distinction between TBO, retirement, hard-life, calendar-life, and manual authorised monitored limit classes;
- no severity contract for hard-life/retirement expiry;
- no single explanation shape for component limit monitoring;
- no replacement for legacy automatic grounding behavior;
- no due snapshot persistence.

## Files Inspected

- `src/models/ComponentLifeLimit.ts`
- `src/models/SerializedComponentLifeState.ts`
- `src/models/AircraftComponentInstallation.ts`
- `src/models/ComponentModel.ts`
- `src/models/core/AircraftComponent.ts`
- `src/modules/library/library.service.ts`
- `src/modules/aircraft/component-life-calculation.service.ts`
- `src/modules/due-status/due-status.service.ts`
- `src/modules/utilisation/utilisation.service.ts`
- `src/modules/maintenance/maintenance-trigger.service.ts`
- `src/modules/aircraft/component-lifecycle.validator.ts`
- `src/modules/aircraft/aircraft-component.service.ts`
- `src/modules/workpacks/services/workpack-component-integration.service.ts`
- `migrations/080_expand_aircraft_and_components.ts`
- `migrations/120_component_models_asset_type_refactor.ts`
- `migrations/552_create_serialized_component_foundation.ts`
- `migrations/565_add_component_tracking_basis_baselines.ts`
- `docs/phase-backend-component-life-calculation.md`
- `docs/phase-due-status-model.md`

## Existing Limit Structures

### `component_life_limits`

Current model fields:

- `component_model_id`
- `limit_type`
- `basis`
- `limit_hours`
- `limit_cycles`
- `limit_months`
- `description`
- `is_active`

Current role:

- defines active model-level serialized component limits;
- can represent hour, cycle, calendar, or mixed limits;
- relies on free-text `limit_type` and `basis` normalization today.

Current limitation:

- `limit_type` and `basis` are not yet controlled enums;
- no explicit severity field;
- no explicit hard-life flag;
- no explicit manual-authorised limit source or approval metadata;
- calendar months exist, but no full calendar monitor exists outside current library evaluation.

### `serialized_component_life_states`

Current model fields:

- `tsn_hours`
- `tso_hours`
- `csn_cycles`
- `cso_cycles`
- `overhaul_reference_date`
- `calendar_reference_date`
- `notes`

Current role:

- stores manual/current values and reference dates used by current `LibraryService.evaluateSerializedComponentLifeLimits()`.

Current limitation:

- does not itself prove authority for derived current life;
- manual values must only be used when tracking basis is `MANUAL_AUTHORISED` or where a defined legacy bridge requires it.

### `aircraft_component_installations`

Current model fields relevant to Phase 7:

- `tracking_basis`
- `installed_at`
- `removed_at`
- `position`
- `install_aircraft_hours`
- `install_aircraft_cycles`
- `install_tsn`
- `install_tso`
- `install_csn`
- `install_cso`
- `removal_aircraft_hours`
- `removal_aircraft_cycles`
- `removal_tsn`
- `removal_tso`
- `removal_csn`
- `removal_cso`

Current role:

- identifies active serialized installations where `removed_at` is null;
- supplies install baselines for derived life calculation;
- preserves removal baselines for history/explanation.

### Legacy `aircraft_components`

Current model fields relevant to legacy TBO:

- `installation_date`
- `install_af_hours`
- `tsn_at_install`
- `tso_at_install`
- `current_status`
- `removed_at`
- `position_code`

Current role:

- remains readable and operational;
- supports old TBO checks and compatibility behavior.

Current limitation:

- no tracking basis;
- no aircraft cycles baseline;
- no CSN/CSO;
- no structured retirement or hard-life model.

## Proposed Monitoring Model

Define a future backend-only service:

`ComponentLimitMonitoringService`

Responsibilities:

- find active serialized installations for an aircraft or component;
- load active `ComponentLifeLimit` definitions from the installed component model;
- obtain current component life from `ComponentLifeCalculationService`;
- evaluate each limit with `DueStatusService`;
- classify limit type and severity;
- return explainable monitoring results;
- preserve `UNKNOWN` where data is missing or unsupported.

Non-responsibilities:

- changing aircraft status;
- creating maintenance requirements;
- attaching workpacks;
- marking compliance complete;
- recalculating AD/SB/SID/scheduled tasks;
- sending notifications;
- persisting due snapshots unless a later phase authorizes it.

Frontend rule:

- frontend may display Phase 7 monitoring results;
- frontend must not calculate TBO, retirement, hard-life, remaining life, governing limits, or severity.

## Monitored Limit Types

Phase 7 must support these monitored limit classes.

### TBO Hours

Purpose:

- monitor time before overhaul in hours.

Preferred source:

- `ComponentLifeLimit.limit_hours` with `limit_type`/`basis` classified as TBO or since-overhaul.

Current life source:

- `ComponentLifeCalculationService` `tso_hours` where calculable.
- `SerializedComponentLifeState.tso_hours` only through `MANUAL_AUTHORISED` or defined legacy bridge.

Due basis:

- `COMPONENT_TSO` / hours.

### TBO Cycles

Purpose:

- monitor cycles before overhaul.

Preferred source:

- `ComponentLifeLimit.limit_cycles` with `limit_type`/`basis` classified as TBO or since-overhaul.

Current life source:

- `ComponentLifeCalculationService` `cso_cycles` where calculable.

Due basis:

- `COMPONENT_CSO` / cycles.

### Retirement Hours

Purpose:

- monitor hard removal/retirement at total hours since new.

Preferred source:

- `ComponentLifeLimit.limit_hours` with `limit_type`/`basis` classified as retirement, hard-life, life-limit, or since-new.

Current life source:

- `ComponentLifeCalculationService` `tsn_hours` where calculable.

Due basis:

- `COMPONENT_TSN` / hours.

### Retirement Cycles

Purpose:

- monitor hard removal/retirement at total cycles since new.

Preferred source:

- `ComponentLifeLimit.limit_cycles` with `limit_type`/`basis` classified as retirement, hard-life, life-limit, or since-new.

Current life source:

- `ComponentLifeCalculationService` `csn_cycles` where calculable.

Due basis:

- `COMPONENT_CSN` / cycles.

### Calendar Life

Purpose:

- monitor elapsed calendar life or expiry by date.

Preferred source:

- `ComponentLifeLimit.limit_months`.

Reference date source:

- for since-overhaul calendar limits: `SerializedComponentLifeState.overhaul_reference_date`;
- for since-install or general calendar limits: `AircraftComponentInstallation.installed_at` or `SerializedComponentLifeState.calendar_reference_date`, according to explicit limit classification;
- if the correct reference date cannot be identified, return `UNKNOWN`.

Due basis:

- `CALENDAR` / days or months.

### Hard-Life Expiry

Purpose:

- identify limits where exceedance means the component must not continue in service without explicit approved action.

Classification sources:

- controlled future field where available;
- interim classifier from `limit_type`, `basis`, and `description` containing terms such as `HARD_LIFE`, `RETIREMENT`, `LIFE_LIMIT`, `SCRAP`, `EXPIRY`, or equivalent.

Due basis:

- the dimension of the underlying limit: TSN, CSN, calendar, or mixed.

### Manual Authorised Limits

Purpose:

- monitor limits whose current life values are intentionally entered or approved manually.

Current life source:

- `ComponentLifeCalculationService` `MANUAL_AUTHORISED` output.

Required behavior:

- result must state that the current value came from stored/manual life-state authority;
- missing manual values return `UNKNOWN`.

## Tracking Basis Interaction

### `AIRCRAFT_HOURS`

Use when the installed component life accrues with aircraft hours.

- Hour-based limits may be evaluated from calculated `tsn_hours` or `tso_hours`.
- Cycle-based limits are `UNKNOWN` unless another approved source supplies CSN/CSO.
- Calendar limits may still be evaluated from date references if the limit has a calendar dimension.

### `AIRCRAFT_CYCLES`

Use when the installed component life accrues with aircraft cycles.

- Cycle-based limits may be evaluated from calculated `csn_cycles` or `cso_cycles`.
- Hour-based limits are `UNKNOWN` unless another approved source supplies TSN/TSO.
- Calendar limits may still be evaluated from date references if the limit has a calendar dimension.

### `CALENDAR`

Use when the component is monitored by elapsed date rather than aircraft meters.

- Hour and cycle current life values are not derived from calendar basis.
- Calendar limits require a known reference date and limit months/days.
- Missing reference dates return `UNKNOWN`.

### `ENGINE_METER`

Reserved for future engine meter authority.

- Until an engine meter authority exists, hour/cycle life and due monitoring for this basis must return `UNKNOWN`.
- The explanation must state `ENGINE_METER authority is not implemented.`

### `PROPELLER_METER`

Reserved for future propeller meter authority.

- Until a propeller meter authority exists, hour/cycle life and due monitoring for this basis must return `UNKNOWN`.
- The explanation must state `PROPELLER_METER authority is not implemented.`

### `MANUAL_AUTHORISED`

Use only where the stored life-state values are explicitly accepted as current life authority.

- Monitoring may evaluate limits from the manual TSN/TSO/CSN/CSO values returned by `ComponentLifeCalculationService`.
- Each result must identify the manual source and remain auditable.
- Missing manual values return `UNKNOWN`.

## Source Of Current Life

Primary authority:

- `ComponentLifeCalculationService`

Rules:

- TBO hours use calculated `tso_hours`.
- TBO cycles use calculated `cso_cycles`.
- retirement/hard-life hours use calculated `tsn_hours`.
- retirement/hard-life cycles use calculated `csn_cycles`.
- calendar life uses explicit reference dates and calendar limits.
- manual values are used only through `MANUAL_AUTHORISED` service output or explicitly defined legacy compatibility.

Stored `SerializedComponentLifeState` values must not be read directly by the future monitor as lifecycle truth except through `ComponentLifeCalculationService`.

If `ComponentLifeCalculationService` returns `UNKNOWN` for the required dimension, Phase 7 monitoring must return `UNKNOWN` for that limit.

## Due Status Use

Phase 7 must use `DueStatusService` states:

- `NOT_DUE`
- `DUE_SOON`
- `DUE`
- `OVERDUE`
- `UNKNOWN`
- `NOT_APPLICABLE`

Mapping:

- remaining < 0 -> `OVERDUE`
- remaining = 0 -> `DUE`
- remaining > 0 and within threshold -> `DUE_SOON`
- remaining beyond threshold -> `NOT_DUE`
- missing current value, limit value, reference date, tracking basis, or meter authority -> `UNKNOWN`
- on-condition or explicitly non-applicable limit -> `NOT_APPLICABLE`

Mixed limits:

- evaluate each dimension independently;
- aggregate with `DueStatusService` most restrictive selection;
- preserve partial `UNKNOWN` warnings where some dimensions are calculable and others are not.

## Severity Rules

Phase 7 needs severity in addition to due status.

Recommended severity values:

- `INFO`
- `WARNING`
- `ACTION_REQUIRED`
- `SEVERE`
- `UNKNOWN`

Default mapping:

- `NOT_APPLICABLE` -> `INFO`
- `NOT_DUE` -> `INFO`
- `DUE_SOON` -> `WARNING`
- `DUE` -> `ACTION_REQUIRED`
- `OVERDUE` -> `ACTION_REQUIRED`
- `UNKNOWN` -> `UNKNOWN`

Hard-life and retirement override:

- hard-life or retirement `DUE` -> `SEVERE`
- hard-life or retirement `OVERDUE` -> `SEVERE`
- hard-life or retirement `DUE_SOON` -> `WARNING`
- hard-life or retirement `UNKNOWN` -> `UNKNOWN` with review required

Rationale:

- `DueStatusService` should keep status semantics stable.
- Hard-life severity is domain-specific and should be represented as an additional severity flag rather than inventing a new due state.
- Exceeding a retirement/hard-life limit still maps to `OVERDUE`; the severity flag communicates that the consequence is more serious than an ordinary soft limit.

Automatic grounding:

- Phase 7 must not automatically ground aircraft.
- A later approved enforcement phase may decide whether a severe hard-life result should trigger grounding, quarantine, workpack creation, or notification.

## UNKNOWN Behavior

The monitor must return `UNKNOWN`, not guessed values, when any required input is missing or unsupported.

UNKNOWN reasons include:

- missing active installation;
- missing component model;
- no active limit definition;
- unclassified limit type or basis;
- missing `tracking_basis`;
- missing install aircraft hours/cycles baseline;
- missing install TSN/TSO/CSN/CSO baseline for the required dimension;
- missing current aircraft hours/cycles;
- missing calendar reference date;
- missing `limit_hours`, `limit_cycles`, or `limit_months`;
- unsupported `ENGINE_METER` or `PROPELLER_METER` authority;
- required manual life-state value is not recorded.

UNKNOWN must be visible in UI and downstream consumers. It must not be converted to `NOT_DUE`.

## Explanation Output Contract

Each Phase 7 result must explain both the limit status and the source of truth.

Recommended result shape:

```ts
type ComponentLimitSeverity =
  | 'INFO'
  | 'WARNING'
  | 'ACTION_REQUIRED'
  | 'SEVERE'
  | 'UNKNOWN';

type ComponentLimitMonitorResult = {
  component: {
    serialized_component_id: string;
    component_model_id: string | null;
    serial_number: string | null;
    model_name: string | null;
    position: string | null;
    aircraft_id: string | null;
    installation_id: string | null;
  };
  limit: {
    component_life_limit_id: string | null;
    limit_type: string;
    normalized_limit_type:
      | 'TBO_HOURS'
      | 'TBO_CYCLES'
      | 'RETIREMENT_HOURS'
      | 'RETIREMENT_CYCLES'
      | 'CALENDAR_LIFE'
      | 'HARD_LIFE'
      | 'MANUAL_AUTHORISED'
      | 'ON_CONDITION'
      | 'UNKNOWN';
    tracking_basis: string | null;
    source_basis: string | null;
    limit_value: number | string | null;
    limit_unit: 'HOURS' | 'CYCLES' | 'DAYS' | 'MONTHS' | 'NONE';
  };
  current_value: number | string | null;
  remaining_value: number | string | null;
  remaining_unit: 'HOURS' | 'CYCLES' | 'DAYS' | 'MONTHS' | 'NONE';
  status: 'NOT_DUE' | 'DUE_SOON' | 'DUE' | 'OVERDUE' | 'UNKNOWN' | 'NOT_APPLICABLE';
  severity: ComponentLimitSeverity;
  source_baseline: Record<string, number | string | null>;
  due_status: DueStatusResult;
  unknown_reason: string | null;
  unknown_reasons: string[];
  explanation: string;
  calculated_at: string;
};
```

Required explanation fields:

- component identity;
- limit type;
- tracking basis;
- current value;
- limit value;
- remaining value;
- status;
- severity;
- source baseline;
- unknown reason where applicable;
- due status result used to produce the status.

## Legacy Handling

Legacy `aircraft_components` behavior must remain readable and operational until an explicit replacement phase is approved.

Rules:

- Do not remove legacy `install_af_hours`, `tsn_at_install`, or `default_tbo_hours` behavior.
- Do not disable current install/restore guards that prevent TBO-exceeded legacy components from entering service.
- Do not remove the temporary utilisation compatibility check that grounds active aircraft when legacy TBO is exceeded.
- Do not let the new monitor create duplicate maintenance requirements or duplicate workpack automation.

Recommended transition:

1. Phase 7 monitor supports serialized components first.
2. Legacy `aircraft_components` can be exposed as compatibility results marked `source = LEGACY_AIRCRAFT_COMPONENTS`.
3. Existing automatic grounding remains compatibility-only and is not expanded.
4. A later enforcement/replacement phase decides whether severe monitor results supersede legacy grounding.

## Phase 7 Implementation Scope

Future Phase 7 IMPLEMENT should be limited to:

- add backend-only `ComponentLimitMonitoringService`;
- add limit classification helpers for TBO, retirement, hard-life, calendar, manual, on-condition, and unknown;
- evaluate active serialized component limits using `ComponentLifeCalculationService`;
- evaluate hour, cycle, calendar, and mixed limits through `DueStatusService`;
- add severity output;
- add explainability output;
- surface `UNKNOWN` and partial calculations clearly;
- preserve existing `LibraryService.evaluateSerializedComponentLifeLimits()` behavior until safely replaced or bridged;
- add focused tests for:
  - TBO hours;
  - TBO cycles;
  - retirement hours;
  - retirement cycles;
  - calendar life;
  - hard-life severity;
  - missing baselines returning `UNKNOWN`;
  - unsupported engine/propeller meter authority returning `UNKNOWN`;
  - manual authorised limits;
  - mixed-limit most restrictive selection;
  - legacy behavior remaining readable.

## Out Of Scope

Do not implement in Phase 7 DEFINE:

- AD recalculation;
- SB recalculation;
- SID recalculation;
- scheduled task recalculation;
- calendar monitor outside component limit evaluation;
- notifications;
- maintenance requirement creation;
- automatic workpack refresh;
- automatic aircraft grounding changes;
- component quarantine automation;
- due snapshot persistence;
- migrations;
- UI redesign.

## Risks

- Existing `ComponentLifeLimit.limit_type` and `basis` are free text, so classification can be ambiguous until controlled values are introduced.
- Legacy TBO grounding can conflict with future monitoring if both try to enforce status changes; Phase 7 must remain monitoring-only.
- Hard-life and retirement limits are safety-critical; they need severity and clear UNKNOWN behavior, not silent `NOT_DUE`.
- Calendar life requires explicit reference date selection; choosing the wrong reference date can produce misleading due status.
- `ENGINE_METER` and `PROPELLER_METER` are not implemented authorities yet, so related limits must remain `UNKNOWN`.
- Stored manual life-state values may be stale unless clearly tied to `MANUAL_AUTHORISED` authority and audit evidence.
- Mixed hour/cycle/calendar limits can produce partial results; downstream screens must show partial UNKNOWN warnings.
