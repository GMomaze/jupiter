# Phase 5 - Utilisation Propagation Preview

## Mode

DEFINE only.

No implementation, migrations, refactors, or production behavior changes are part of this phase definition.

## Goal

Define the pre-save utilisation preview that shows what will be affected before an aircraft utilisation update is confirmed.

The preview is an explainability and confirmation layer. It must not create utilisation events, mutate aircraft totals, update component life records, recalculate due status, alter compliance, or refresh workpacks before confirmation.

## Current Implementation Status

Status: NOT STARTED for a dedicated propagation preview.

Existing backend authority:

- `src/modules/utilisation/utilisation.service.ts`
  - `UtilisationService.recordUtilisation()` is the current backend authority for changing `aircraft.total_time_hours` and `aircraft.total_time_cycles`.
  - It locks the aircraft row, reads previous hours/cycles, calculates deltas, creates a `utilisation_events` row, updates the aircraft snapshot, writes audit logs, and runs the temporary legacy TBO grounding compatibility check.
- `src/modules/aircraft/aircraft.routes.ts`
  - `POST /aircraft/:id/utilisation` is mounted with `requireAuth`, `requireRole('ADMIN')`, and CSRF protection.
- `src/modules/aircraft/aircraft.controller.ts`
  - `AircraftController.updateUtilisation()` calls `UtilisationService.recordUtilisation()` directly.
- `src/views/aircraft/view.ejs`
  - The aircraft view contains the utilisation update form.
  - It shows current aircraft hours/cycles and accepts new hours, new cycles, effective date, source type, source reference, and reason.
  - It has a client-side correction warning when proposed hours or cycles decrease.

Missing today:

- no preview route;
- no preview controller action;
- no `UtilisationPropagationPreviewService`;
- no pre-save affected component list;
- no projected component life output;
- no read-only confirmation step;
- no preview-specific due/compliance/workpack impact contract.

## Files Inspected

- `src/modules/utilisation/utilisation.service.ts`
- `src/modules/aircraft/aircraft.routes.ts`
- `src/modules/aircraft/aircraft.controller.ts`
- `src/views/aircraft/view.ejs`
- `src/modules/aircraft/aircraft-component.service.ts`
- `src/modules/aircraft/component-life-calculation.service.ts`
- `src/models/AircraftComponentInstallation.ts`
- `src/models/SerializedComponentLifeState.ts`
- `src/models/SerializedComponentMaintenanceEvent.ts`
- `src/models/ComponentLifeLimit.ts`
- `src/modules/compliance/compliance.service.ts`
- `src/modules/compliance/applicability-engine.service.ts`
- `src/modules/workpacks/services/workpack-component-integration.service.ts`
- `src/modules/workpacks/services/workpack-operational-maturity.service.ts`
- `src/models/AirworthinessDirective.ts`
- `src/models/ServiceBulletin.ts`
- `src/models/SupplementalInspectionDocument.ts`
- `src/models/core/TaskTemplate.ts`
- `src/models/MaintenanceTemplate.ts`
- `src/models/MaintenanceTemplateItem.ts`

## Existing Utilisation Update Flow

Current confirmed update path:

1. User submits the aircraft utilisation form on `src/views/aircraft/view.ejs`.
2. `POST /aircraft/:id/utilisation` routes to `AircraftController.updateUtilisation()`.
3. The controller passes form values to `UtilisationService.recordUtilisation()`.
4. `UtilisationService`:
   - loads and locks the aircraft;
   - reads previous `total_time_hours` and `total_time_cycles`;
   - validates new totals;
   - calculates `delta_hours` and `delta_cycles`;
   - treats decreases as corrections requiring source reference and reason;
   - creates an immutable utilisation event;
   - updates aircraft snapshot fields;
   - writes audit entries;
   - runs temporary legacy TBO grounding compatibility logic.
5. The user is redirected back to the aircraft view.

There is currently no intermediate preview state. The form submission is the save action.

## Existing Affected Item Sources

### Installed Serialized Components

Primary source:

- `AircraftComponentService.getActiveSerializedInstallationsForAircraft(aircraftId)`

Backed by:

- `aircraft_component_installations`
- `serialized_components`
- `component_models`
- `component_life_limits`
- `serialized_component_life_states`

Relevant fields:

- `aircraft_component_installations.id`
- `aircraft_component_installations.aircraft_id`
- `aircraft_component_installations.serialized_component_id`
- `aircraft_component_installations.installed_at`
- `aircraft_component_installations.removed_at`
- `aircraft_component_installations.position`
- `aircraft_component_installations.tracking_basis`
- `aircraft_component_installations.install_aircraft_hours`
- `aircraft_component_installations.install_aircraft_cycles`
- `aircraft_component_installations.install_tsn`
- `aircraft_component_installations.install_tso`
- `aircraft_component_installations.install_csn`
- `aircraft_component_installations.install_cso`
- removal baseline fields for history and explanation, not active preview mutation.

### Component Life Calculation

Current source:

- `ComponentLifeCalculationService.calculateForInstallation(installationId)`

Current limitation:

- The service calculates against the persisted aircraft snapshot.
- Phase 5 needs preview support for a proposed aircraft snapshot without saving it.
- The future preview service must either:
  - call a new read-only calculation entry point that accepts proposed aircraft hours/cycles, or
  - build a calculation context equivalent to the persisted calculation without mutating the database.

Frontend must not calculate TSN, TSO, CSN, or CSO.

### AD, SB, SID, and Compliance Sources

Existing sources:

- `ApplicabilityEngineService` provides applicability-style visibility for AD/SB/SID-like items.
- `ComplianceService` reads compliance assignments and due fields.
- `AircraftService.getServiceBulletinsForAircraft()` reads SB applicability and `AircraftSbCompliance`.
- Models include:
  - `AirworthinessDirective`
  - `ServiceBulletin`
  - `AircraftSbCompliance`
  - `ComplianceItem`
  - `ComplianceAssignment`
  - `SupplementalInspectionDocument`
  - `CessnaSid`

Current limitation:

- There is no Phase 5-authorized due recalculation engine for proposed utilisation.
- Preview may show existing known compliance/due visibility where already available, but projected due impact must use placeholder output until the later due phases define authoritative recalculation.

### Scheduled Task Sources

Existing sources:

- `TaskTemplate`
- `MaintenanceTemplate`
- `MaintenanceTemplateItem`
- `MaintenanceRequirement`

Relevant interval fields exist across task/template models:

- `interval_hours`
- `interval_months`

Current limitation:

- There is no Phase 5-authorized scheduled task due recalculation engine for proposed aircraft hours/cycles.

### Workpack Visibility Sources

Existing sources:

- `WorkpackComponentIntegrationService`
- `WorkpackOperationalMaturityService`
- workpack planning, preview, generation, and lifecycle services.

Current limitation:

- Workpack services provide downstream execution/planning visibility.
- Phase 5 must not automatically refresh workpacks, mutate workpack lifecycle, generate workpack tasks, or change workpack visibility state.

## Preview Purpose

Before saving a utilisation update, the user must see:

- current aircraft hours;
- current aircraft cycles;
- proposed new aircraft hours;
- proposed new aircraft cycles;
- proposed `delta_hours`;
- proposed `delta_cycles`;
- whether the entry is normal utilisation or correction;
- source type;
- source reference;
- effective date;
- reason;
- affected installed serialized components;
- projected component life effects where calculable;
- missing baseline warnings;
- UNKNOWN calculation warnings;
- placeholder impact summaries for AD, SB, SID, scheduled tasks, component TBO/retirement, and workpack visibility.

The preview must answer: "If I confirm this utilisation update, what records and calculations will become relevant?"

It must not answer with false precision where due engines are not implemented.

## Proposed Backend Service Boundary

Introduce a future backend-only service:

`UtilisationPropagationPreviewService`

Responsibilities:

- validate the proposed aircraft utilisation payload using the same validation semantics as `UtilisationService` where practical;
- load current aircraft snapshot;
- calculate proposed deltas;
- classify normal vs correction;
- load active serialized installations;
- calculate current component life using backend life authority;
- calculate projected component life using proposed aircraft hours/cycles without saving;
- collect UNKNOWN and missing-baseline warnings;
- provide placeholder contracts for future due/compliance/workpack impact;
- return a read-only preview data structure.

Non-responsibilities:

- creating `utilisation_events`;
- updating `aircraft.total_time_hours`;
- updating `aircraft.total_time_cycles`;
- creating audit logs;
- running legacy TBO grounding logic;
- recalculating AD, SB, SID, scheduled tasks, or workpack state;
- mutating component life-state records.

Confirmed submission remains the responsibility of `UtilisationService.recordUtilisation()`.

## Preview Data Contract

Recommended top-level contract:

```ts
type UtilisationPropagationPreview = {
  aircraft: {
    id: string;
    registration: string;
    current_total_time_hours: number;
    current_total_time_cycles: number;
    proposed_total_time_hours: number;
    proposed_total_time_cycles: number;
    delta_hours: number;
    delta_cycles: number;
  };
  entry: {
    source_type: string;
    source_reference: string | null;
    effective_date: string;
    reason: string;
    classification: 'NORMAL' | 'CORRECTION';
    correction_warning: CorrectionWarning | null;
  };
  affected_components: AffectedComponentPreview[];
  affected_due_items: AffectedDueItemPreview[];
  summary: {
    active_serialized_component_count: number;
    calculated_component_count: number;
    unknown_component_count: number;
    missing_baseline_warning_count: number;
    correction: boolean;
    warnings: string[];
  };
  boundary_notice: string;
};
```

Validation expectations:

- proposed hours cannot be negative;
- proposed cycles cannot be negative;
- proposed cycles must be integer;
- zero-change preview may be shown as invalid, but confirmation must remain blocked;
- source type must use the approved utilisation source types;
- effective date must be valid;
- reason is required;
- source reference is required for corrections.

## Affected Component Preview Contract

Each active serialized component should return:

```ts
type AffectedComponentPreview = {
  installation_id: string;
  serialized_component_id: string;
  component_identity: {
    serial_number: string | null;
    part_number: string | null;
    model_code: string | null;
    model_name: string | null;
    manufacturer_name: string | null;
    asset_type_code: string | null;
  };
  position: string | null;
  installed_at: string;
  tracking_basis: string | null;
  baselines: {
    install_aircraft_hours: number | null;
    install_aircraft_cycles: number | null;
    install_tsn: number | null;
    install_tso: number | null;
    install_csn: number | null;
    install_cso: number | null;
  };
  current_life: ComponentLifeCalculationResult;
  projected_life: ComponentLifeCalculationResult;
  impact: {
    delta_tsn_hours: number | null;
    delta_tso_hours: number | null;
    delta_csn_cycles: number | null;
    delta_cso_cycles: number | null;
    impacted_dimensions: Array<'tsn_hours' | 'tso_hours' | 'csn_cycles' | 'cso_cycles'>;
    impact_summary: string;
  };
  warnings: PreviewWarning[];
};
```

Required behavior:

- `AIRCRAFT_HOURS` components must show projected TSN/TSO movement from the proposed aircraft hour delta where baselines are present.
- `AIRCRAFT_CYCLES` components must show projected CSN/CSO movement from the proposed aircraft cycle delta where baselines are present.
- `CALENDAR` components must show UNKNOWN for hour/cycle projection.
- `ENGINE_METER` and `PROPELLER_METER` must show UNKNOWN until those meter authorities exist.
- `MANUAL_AUTHORISED` must show stored/manual life-state values and explain that aircraft utilisation does not automatically derive the manual authorised life.
- missing `tracking_basis` or baselines must be visible as warnings, not hidden.
- decreasing aircraft hours/cycles may reduce projected component life or cause UNKNOWN if the proposed aircraft meter falls below install baseline.

The preview must use backend calculation output. It must not duplicate component life formulas in the browser.

## Affected Due Item Placeholder Contract

Phase 5 defines only a placeholder display contract. It does not define authoritative recalculation.

```ts
type AffectedDueItemPreview = {
  source_type: 'AD' | 'SB' | 'SID' | 'SCHEDULED_TASK' | 'COMPONENT_TBO' | 'COMPONENT_RETIREMENT';
  source_id: string | null;
  source_reference: string | null;
  title: string | null;
  current_visibility_state: string;
  projected_visibility_state: 'NOT_CALCULATED_IN_PHASE_5';
  current_due_status: string | null;
  projected_due_status: 'NOT_CALCULATED_IN_PHASE_5';
  reason: string;
  related_component_installation_id: string | null;
  warnings: PreviewWarning[];
};
```

Allowed in Phase 5 implementation:

- include currently visible due/compliance/workpack context if it already exists;
- mark projection as `NOT_CALCULATED_IN_PHASE_5`;
- identify that later phases will replace placeholders with authoritative due engines.

Not allowed in Phase 5:

- calculating new AD due status;
- calculating new SB due status;
- calculating new SID due status;
- calculating scheduled task due status;
- calculating component TBO/retirement due status;
- updating compliance rows;
- generating or refreshing workpacks.

## Correction Warning Behavior

If proposed hours or cycles decrease:

- preview classification must be `CORRECTION`;
- correction warning must be returned and shown;
- reason is required;
- source reference is required;
- where practical, the UI should allow linking to the prior utilisation event in a later implementation;
- preview must warn that downstream values may reduce or become UNKNOWN;
- component projections must show UNKNOWN if proposed aircraft hours/cycles fall below install baselines;
- confirmation still routes to `UtilisationService.recordUtilisation()`, which enforces correction rules.

Suggested correction warning contract:

```ts
type CorrectionWarning = {
  decreases_hours: boolean;
  decreases_cycles: boolean;
  message: string;
  required_fields: Array<'reason' | 'source_reference'>;
  downstream_warning: string;
};
```

## Confirmation Behavior

Preview flow:

1. User enters proposed utilisation values.
2. UI requests preview from backend.
3. Backend returns read-only preview.
4. User reviews affected components and warnings.
5. User confirms.
6. Confirmed submission calls `UtilisationService.recordUtilisation()`.

Rules:

- no utilisation event is created during preview;
- no aircraft snapshot is updated during preview;
- no audit log is written during preview;
- no component records are updated during preview;
- no due/compliance/workpack rows are updated during preview;
- confirmation must re-submit the same core values and the backend must revalidate them;
- preview output must not be treated as a lock or guarantee, because aircraft or component state may change before confirmation.

## UI Requirements

The aircraft utilisation screen should eventually support:

- preview action separate from confirm/save;
- current/proposed/delta summary;
- clear correction banner for decreases;
- affected components table;
- warnings panel for UNKNOWN/missing baseline results;
- due/compliance placeholder panel;
- final confirmation button disabled until required fields are valid;
- no browser-side lifecycle truth calculations.

The existing aircraft edit behavior remains unchanged. Generic aircraft edit must not regain authority over utilisation fields.

## Implementation Scope For Phase 5

Future IMPLEMENT scope should be limited to:

- add `UtilisationPropagationPreviewService`;
- add backend-only projected component life calculation support without persistence;
- add a preview route/controller action protected consistently with the utilisation update route;
- add UI preview/confirmation behavior to the existing aircraft utilisation screen;
- add focused tests for:
  - normal hour increase preview;
  - normal cycle increase preview;
  - combined hour/cycle preview;
  - correction preview;
  - missing baseline warnings;
  - UNKNOWN tracking basis behavior;
  - no event/audit/snapshot mutation during preview;
  - confirmation still routes through `UtilisationService.recordUtilisation()`.

Implementation must not add any new database tables or migrations unless a later DEFINE explicitly requires persisted preview records.

## Risks

- Race condition between preview and confirmation: preview is advisory only and confirmation must revalidate.
- Existing component due visibility uses stored life-state in some places; Phase 5 must avoid presenting it as projected due truth.
- Legacy TBO grounding logic still runs only after confirmed utilisation through `UtilisationService`; preview may mention possible legacy TBO compatibility impact only as a warning, not an authoritative due calculation.
- Missing baselines are common during onboarding/baseline capture and must be made visible without blocking normal preview generation.
- If frontend calculates deltas independently, it may diverge from backend authority. Backend preview output must be the display source.
- Corrections can reduce projected life and may confuse users; correction copy must state that reductions require source-backed correction evidence.

## Boundary

Phase 5 does not implement:

- due-status engine;
- TBO monitoring;
- AD recalculation;
- SB recalculation;
- SID recalculation;
- scheduled task recalculation;
- automatic workpack refresh;
- workpack lifecycle authority changes;
- component life-state persistence;
- utilisation event creation during preview.

The only confirmed save path remains `UtilisationService.recordUtilisation()`.
