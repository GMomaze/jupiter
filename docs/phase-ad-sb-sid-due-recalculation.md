# Phase 8 - AD / SB / SID Due Recalculation

## Mode

DEFINE only.

No implementation, migrations, refactors, workpack refreshes, notifications, grounding actions, scheduled-task recalculation, calendar monitor, or frontend due calculations are part of this phase definition.

## Goal

Define how Jupiter will recalculate AD, SB, and SID due status from:

- aircraft utilisation authority;
- aircraft calendar/date context;
- applicability;
- stored compliance history;
- recurring compliance intervals;
- the unified `DueStatusService`.

Phase 8 defines the future backend due-recalculation authority for compliance-type items. It does not implement the service.

## Current Implementation Status

Status: PARTIAL and fragmented.

Jupiter already has several compliance structures:

- source tables for ADs, SBs, and SIDs;
- projected `compliance_items` for AD/SB;
- `compliance_assignments` for model/aircraft applicability;
- raw SQL use of `aircraft_compliance`;
- workpack compliance attachments;
- service-bulletin workpack attachment logic;
- an applicability engine that can return AD, SB, and SID candidates;
- `DueStatusService` from Phase 6.

Missing today:

- no single AD/SB/SID due recalculation authority;
- no backend service that recalculates due status from utilisation events;
- no cycle due fields for AD/SB/SID compliance;
- no unified recurring-compliance calculation;
- no unified SID compliance path across old and new SID tables;
- no use of `DueStatusService` in AD/SB/SID due calculations;
- no due recalculation trigger behind `UtilisationService.recordUtilisation()`;
- no due snapshot/audit model for recalculated AD/SB/SID status.

Current display status is limited:

- `ComplianceService.calculateAircraftStatus()` compares stored `aircraft_compliance.next_due_hours` and `next_due_at` against current aircraft hours/date.
- It returns `NOT_APPLICABLE`, `OVERDUE`, `COMPLIANT`, or `DUE`.
- It does not support `DUE_SOON`, `UNKNOWN`, cycle due values, mixed-limit governing explanations, or Phase 6 `NOT_DUE`.

## Files Inspected

- `src/models/AirworthinessDirective.ts`
- `src/models/ServiceBulletin.ts`
- `src/models/AircraftSbCompliance.ts`
- `src/models/ComplianceItem.ts`
- `src/models/ComplianceAssignment.ts`
- `src/models/SupplementalInspectionDocument.ts`
- `src/models/SidModelApplicability.ts`
- `src/models/cessnaSid.model.ts`
- `src/models/ModelSid.ts`
- `src/models/core/TaskTemplate.ts`
- `src/models/core/TaskCard.ts`
- `src/modules/compliance/compliance.service.ts`
- `src/modules/compliance/applicability-engine.service.ts`
- `src/modules/compliance/compliance-projection.service.ts`
- `src/modules/workpacks/services/workpack-service-bulletin.service.ts`
- `src/modules/workpacks/services/workpack-component-integration.service.ts`
- `src/modules/due-status/due-status.service.ts`
- `migrations/270_create_aircraft_sb_compliance.ts`
- `migrations/390_create_cessna_sids.ts`
- `migrations/410_create_aircraft_sid_status.ts`
- `migrations/430_create_compliance_items.ts`
- `migrations/440_create_aircraft_compliance.ts`
- `migrations/450_create_workpack_compliance.ts`
- `migrations/480_create_airworthiness_directive_schema.ts`
- `migrations/490_align_service_bulletins_with_phase5_schema.ts`
- `migrations/500_add_source_type_to_compliance_items_and_enforce_source_linkage.ts`
- `migrations/510_correct_sid_schema_to_phase6_definition.ts`
- `migrations/559_create_compliance_assignments.ts`

## Existing Compliance Structures

### Airworthiness Directives

Primary source model:

- `AirworthinessDirective`

Stored fields relevant to due calculation:

- `ad_number`
- `revision`
- `subject`
- `summary`
- `status`
- `effective_date`
- `authority`
- `make`
- `model`
- `product_type`
- `product_subtype`
- `is_recurring`
- `interval_hours`
- `interval_months`
- `is_active`

Current role:

- stores AD source records.
- `ComplianceProjectionService.projectAdSources()` projects ADs into `compliance_items`.

Current limitations:

- no cycle interval field;
- no explicit initial due hours/date separate from repeat interval;
- no structured applicability table for ADs beyond source text and projected assignments;
- no AD-specific recurring compliance service.

### Service Bulletins

Primary source model:

- `ServiceBulletin`

Stored fields relevant to due calculation:

- `sb_number`
- `title`
- `category`
- `applicability_make`
- `applicability_model`
- `applicability_product_type`
- `applicability_notes`
- `issued_on`
- `compliance_type`
- `status`
- `revision`
- `is_active`

Related applicability:

- `service_bulletin_models`
- `ApplicabilityEngineService.getServiceBulletinItemsForModel()`
- `WorkpackServiceBulletinService.getOpenRelevantServiceBulletinsForAircraft()`

Current SB compliance table:

- `aircraft_sb_compliance`
  - `aircraft_id`
  - `service_bulletin_id`
  - `status`
  - `complied_at`
  - `notes`

Current limitations:

- no SB hour/cycle/calendar due fields in `AircraftSbCompliance`;
- no repeat interval fields on `ServiceBulletin`;
- no unified SB recurring due calculation;
- older workpack SB attachment uses OPEN/PENDING-style status, not Phase 6 due status.

### Compliance Items

Primary model:

- `ComplianceItem`

Stored fields:

- `item_type`
- `code`
- `title`
- `description`
- `authority`
- `revision`
- `issued_on`
- `effective_on`
- `source_table`
- `source_type`
- `source_id`
- `compliance_basis`
- `status`
- `notes`

Current role:

- normalized AD/SB compliance item projection.
- source linkage is enforced by later migrations through `source_type` and `source_id`.

Current limitations:

- model type currently declares `item_type: 'AD' | 'SB'`; SID is not yet represented here.
- due intervals are not stored directly on `ComplianceItem`.
- compliance basis is mandatory/recommended/manual, not due basis.

### Compliance Assignments

Primary model:

- `ComplianceAssignment`

Stored fields:

- `compliance_item_id`
- `assignment_type`
- `model_id`
- `aircraft_id`
- `assignment_source`
- `is_active`

Current role:

- maps projected compliance items to aircraft or model applicability.
- used by `ApplicabilityEngineService` for projected AD/SB items.

Current limitation:

- does not store due rules.
- does not itself decide compliance status.

### Aircraft Compliance

Current table:

- `aircraft_compliance`

There is no Sequelize model file for this table today; `ComplianceService` reads it using SQL.

Stored fields:

- `aircraft_id`
- `compliance_item_id`
- `status`
- `last_complied_at`
- `next_due_at`
- `last_complied_hours`
- `next_due_hours`
- `compliance_method`
- `complied_workpack_id`
- `notes`

Current status values:

- `DUE`
- `IN_PROGRESS`
- `COMPLIANT`
- `NOT_APPLICABLE`

Current limitations:

- no `last_complied_cycles`;
- no `next_due_cycles`;
- no explicit recurring interval snapshot;
- no due-state explanation fields;
- no `UNKNOWN`;
- status mixes compliance completion state and due status.

### SIDs

Newer SID source model:

- `SupplementalInspectionDocument`

Stored fields:

- `reference`
- `title`
- `description`
- `category`
- `section_reference`
- `ata_chapter`
- `initial_interval_hours`
- `initial_interval_months`
- `repeat_interval_hours`
- `repeat_interval_months`
- `inspection_operation`
- `source_document`
- `is_active`

Applicability model:

- `SidModelApplicability`
  - `sid_id`
  - `model_id`
  - `is_active`

Older SID source/status structures:

- `CessnaSid`
- `ModelSid`
- `aircraft_sid_status`

Legacy `aircraft_sid_status` stores:

- `aircraft_id`
- `sid_id`
- `status`
- `last_done_hours`
- `last_done_date`
- `next_due_hours`
- `next_due_date`

Current limitations:

- SIDs are not projected into `ComplianceItem` today.
- Newer SID applicability appears in `ApplicabilityEngineService`, but not in `ComplianceService.getApplicableComplianceForAircraft()`.
- No cycle SID support exists.
- SID due status is not unified with `DueStatusService`.

### Workpack Compliance Attachment

Current workpack structures:

- `workpack_compliance`
- `TaskCard.compliance_item_id`
- `WorkpackServiceBulletinService`

Current behavior:

- workpacks can attach service bulletin tasks.
- workpack compliance summary reads completed `workpack_compliance` rows.
- workpack component integration displays component due visibility, but not AD/SB/SID recalculation.

Phase 8 boundary:

- recalculation may produce due results for consumers.
- it must not automatically attach items to workpacks or refresh workpack contents.

## Proposed Backend Authority

Define a future backend-only service:

`ComplianceDueRecalculationService`

Responsibilities:

- calculate AD due status;
- calculate SB due status;
- calculate SID due status;
- use `ApplicabilityEngineService` or equivalent source-specific applicability;
- use aircraft utilisation snapshot values from the aircraft record;
- evaluate hour/cycle/calendar/mixed limits through `DueStatusService`;
- calculate recurrence from last compliance and intervals;
- return explainable due results;
- optionally persist results only when a later implementation explicitly defines storage/audit behavior.

Non-responsibilities:

- scheduled task recalculation;
- workpack refresh;
- notification generation;
- automatic grounding;
- frontend calculations;
- marking compliance complete.

Frontend rule:

- frontend must display backend due results only.
- frontend must not calculate AD/SB/SID due status, remaining hours, remaining cycles, dates, or governing limits.

## AD Due Rule Model

AD due status must be calculated only for ADs applicable to the aircraft.

Possible sources:

- `ComplianceItem` where `item_type = 'AD'` or `source_type = 'AD'`;
- `AirworthinessDirective` source record linked by `source_id`;
- `ComplianceAssignment` model/aircraft assignments;
- source-text applicability only where a controlled parser or manual assignment has marked the AD applicable.

Supported due dimensions:

- aircraft hours;
- aircraft cycles;
- calendar/date;
- mixed hour/cycle/date.

Current available fields:

- `AirworthinessDirective.interval_hours`;
- `AirworthinessDirective.interval_months`;
- `aircraft_compliance.last_complied_hours`;
- `aircraft_compliance.next_due_hours`;
- `aircraft_compliance.last_complied_at`;
- `aircraft_compliance.next_due_at`.

Missing fields:

- AD cycle intervals;
- `last_complied_cycles`;
- `next_due_cycles`;
- structured initial due basis;
- terminating action metadata.

Rules:

- If `next_due_hours` exists, evaluate current aircraft hours against it.
- If `next_due_at` exists, evaluate current date against it.
- If cycle due fields are later added, evaluate current aircraft cycles against `next_due_cycles`.
- If the AD is recurring and last compliance plus interval is available, recalculate next due from last compliance.
- If no due basis is available for an applicable active AD, return `UNKNOWN`.
- If the AD is not applicable, return `NOT_APPLICABLE`.
- If a terminating action is recorded, recurring recalculation stops and status becomes `NOT_DUE` or `NOT_APPLICABLE` according to the compliance record semantics defined in implementation.

## SB Due Rule Model

SB due status must be calculated only for SBs applicable to the aircraft, installed component model, or aircraft model.

Possible sources:

- `ComplianceItem` where `item_type = 'SB'` or `source_type = 'SB'`;
- `ServiceBulletin`;
- `service_bulletin_models`;
- `ComplianceAssignment`;
- `AircraftSbCompliance`.

Supported due dimensions:

- aircraft hours;
- aircraft cycles;
- calendar/date;
- mixed hour/cycle/date.

Current available fields:

- `ServiceBulletin.issued_on`;
- `ServiceBulletin.compliance_type`;
- `AircraftSbCompliance.status`;
- `AircraftSbCompliance.complied_at`;
- generic `aircraft_compliance` due fields when an SB is projected into `ComplianceItem`.

Missing fields:

- SB interval hours;
- SB interval cycles;
- SB interval months;
- SB next due hours/cycles/date in `AircraftSbCompliance`;
- recurring SB metadata.

Rules:

- Mandatory/recommended/manual SB compliance basis is not itself a due interval.
- If SB is represented in `aircraft_compliance`, use those stored due fields until SB-specific due fields exist.
- If only `AircraftSbCompliance` exists with no due basis, statuses such as OPEN/PENDING should not be converted into a calculated due value; return `DUE` only as an open requirement if business rules define that SB as required, otherwise `UNKNOWN` or `NOT_APPLICABLE`.
- If an applicable SB lacks due basis and is mandatory, return `UNKNOWN` unless implementation defines "open mandatory SB = DUE".
- If a future SB repeat interval exists, calculate recurrence from last compliance.

## SID Due Rule Model

SID due status must be calculated only for SIDs applicable to the aircraft model.

Possible sources:

- `SupplementalInspectionDocument`;
- `SidModelApplicability`;
- legacy `CessnaSid`;
- legacy `ModelSid`;
- legacy `aircraft_sid_status`.

Supported due dimensions:

- aircraft hours;
- calendar/date;
- mixed hour/date.

Future supported dimension:

- aircraft cycles, if SID cycle fields are added.

Current available fields:

- `SupplementalInspectionDocument.initial_interval_hours`;
- `SupplementalInspectionDocument.initial_interval_months`;
- `SupplementalInspectionDocument.repeat_interval_hours`;
- `SupplementalInspectionDocument.repeat_interval_months`;
- `aircraft_sid_status.last_done_hours`;
- `aircraft_sid_status.last_done_date`;
- `aircraft_sid_status.next_due_hours`;
- `aircraft_sid_status.next_due_date`.

Rules:

- If no prior SID compliance exists, use initial interval.
- If prior SID compliance exists, use repeat interval.
- If `aircraft_sid_status.next_due_hours` or `next_due_date` exists, evaluate against those stored values.
- If next due must be recalculated, use:
  - last done hours + repeat interval hours;
  - last done date + repeat interval months;
  - aircraft baseline/new aircraft reference only if an implementation defines the initial reference value.
- Missing last compliance for recurring SID with no initial reference returns `UNKNOWN`.
- Mixed hour/date limits use most restrictive status through `DueStatusService`.

## Applicability Relationship

Due status must only be calculated for applicable items.

Applicability sources:

- AD:
  - `ComplianceAssignment`;
  - projected `ComplianceItem`;
  - source applicability text only after manual or parser confirmation.
- SB:
  - `service_bulletin_models`;
  - `ComplianceAssignment`;
  - aircraft or installed component model scope.
- SID:
  - `SidModelApplicability`;
  - legacy `ModelSid`.

Applicability result states:

- applicable -> calculate due status.
- not applicable -> return `NOT_APPLICABLE`.
- cannot determine applicability -> return `UNKNOWN`.

The due service must include applicability source in the explanation.

## Recurring Compliance Behavior

Each recurring result needs:

- last complied value/date;
- next due value/date;
- repeat interval;
- whether recurrence continues;
- whether a terminating action has ended recurrence.

### Last Compliance

Current sources:

- `aircraft_compliance.last_complied_hours`;
- `aircraft_compliance.last_complied_at`;
- `aircraft_sid_status.last_done_hours`;
- `aircraft_sid_status.last_done_date`;
- `AircraftSbCompliance.complied_at` for SB date-only history.

Future required sources:

- last complied cycles;
- compliance event/audit table or structured compliance action history;
- terminating action flag/reference.

### Next Due

Current sources:

- `aircraft_compliance.next_due_hours`;
- `aircraft_compliance.next_due_at`;
- `aircraft_sid_status.next_due_hours`;
- `aircraft_sid_status.next_due_date`.

Future required sources:

- next due cycles;
- next due reason/generation source;
- due calculation snapshot or recalculation event reference.

### Recalculation Rules

If stored next due is available:

- evaluate it directly and include it in explanation.

If stored next due is missing but recurrence can be derived:

- next due hours = last complied hours + repeat interval hours;
- next due cycles = last complied cycles + repeat interval cycles;
- next due date = last complied date + repeat interval months/days.

If first compliance is due:

- use initial due interval or fixed due date.
- if no initial reference exists, return `UNKNOWN`.

If terminating action is recorded:

- no further recurrence is generated.
- result should explain the terminating action source and status.

## Mixed Due Limits

Hour, cycle, and calendar/date dimensions must be evaluated independently.

Use `DueStatusService` for:

- hour remaining;
- cycle remaining;
- calendar days remaining;
- mixed-limit most restrictive selection;
- `UNKNOWN`;
- `NOT_APPLICABLE`;
- explanation contract.

Most restrictive rule:

- `OVERDUE` beats `DUE`;
- `DUE` beats `DUE_SOON`;
- `DUE_SOON` beats `NOT_DUE`;
- partial `UNKNOWN` warnings must remain visible;
- if all dimensions are unknown, aggregate status is `UNKNOWN`.

## Recalculation Triggers

Future recalculation should occur after:

- confirmed utilisation event;
- compliance entry/compliance completion;
- compliance record correction;
- applicability change;
- AD/SB/SID source import or projection;
- manual recalculation request;
- aircraft/component model change affecting applicability;
- later calendar/date monitor tick.

Phase 8 DEFINE does not implement triggers.

Phase 8 implementation should not attach this to automatic calendar monitoring unless a later phase approves the calendar monitor.

## Explanation Output Contract

Each AD/SB/SID due result must explain the calculation.

Recommended result shape:

```ts
type ComplianceDueResult = {
  item_type: 'AD' | 'SB' | 'SID';
  item_id: string | null;
  reference: string;
  title: string | null;
  applicability: {
    status: 'APPLICABLE' | 'NOT_APPLICABLE' | 'UNKNOWN';
    source: string | null;
    reason: string | null;
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
  recurrence: {
    is_recurring: boolean | null;
    interval_hours: number | null;
    interval_cycles: number | null;
    interval_months: number | null;
    terminating_action_recorded: boolean;
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

- item type;
- reference;
- applicability source;
- current aircraft hours/cycles/date;
- last compliance basis;
- next due basis;
- remaining value;
- status;
- governing limit;
- unknown reason where applicable.

## Implementation Scope For Future Phase 8

Future Phase 8 IMPLEMENT should be limited to:

- add backend-only `ComplianceDueRecalculationService`;
- calculate due status for applicable ADs;
- calculate due status for applicable SBs where due basis exists;
- calculate due status for applicable SIDs using available initial/repeat intervals and legacy status where safe;
- call `DueStatusService` for all due-state decisions;
- return explanation output;
- preserve existing `ComplianceService` display behavior until safely bridged;
- add focused tests for:
  - AD hour due;
  - AD calendar due;
  - AD mixed due;
  - SB projected compliance due where due basis exists;
  - SID initial interval due;
  - SID repeat interval due;
  - recurring recalculation;
  - terminating action behavior where data exists;
  - UNKNOWN missing basis;
  - NOT_APPLICABLE applicability result;
  - no workpack refresh/no notification/no grounding boundary.

## Out Of Scope

Do not implement in Phase 8 DEFINE:

- scheduled task recalculation;
- generic maintenance template recalculation;
- calendar monitor;
- notification engine;
- automatic workpack refresh;
- automatic workpack attachment;
- automatic grounding;
- frontend due calculations;
- due snapshot persistence;
- migrations.

## Risks

- `aircraft_compliance` has no Sequelize model and is currently SQL-driven, so implementation must either stay SQL-safe or introduce a later approved model/migration phase.
- Current AD/SB data lacks cycle due fields.
- Current SB data lacks structured recurring intervals.
- `AircraftSbCompliance` status does not contain enough due basis to calculate future due status by itself.
- SIDs are split between newer and legacy structures.
- Existing `COMPLIANT` status is a compliance completion state, not the same as Phase 6 `NOT_DUE`.
- Applicability source quality varies by AD/SB/SID source and may require manual assignment before due status is safe.
- Calendar/date calculations need date-only semantics to avoid timezone drift.
- Automatic workpack refresh would change operational behavior and must remain out of scope.
