# Phase 3 - Installed Component Tracking Basis

## Mode

DEFINE

## Goal

Define how installed components derive life tracking from aircraft utilisation and other approved meter bases.

This phase does not implement propagation, due-status engines, workpack refresh, calculation formulas, migrations, or refactors.

## Current Implementation Status

Status: PARTIAL

The system already has two component tracking families:

- Legacy installed components in `aircraft_components`.
- Serialized components in `serialized_components`, `aircraft_component_installations`, `serialized_component_life_states`, and `serialized_component_maintenance_events`.

The current implementation stores some installation, removal, life-state, and overhaul values. It does not yet define an authoritative tracking basis per installed component, does not capture aircraft cycles at component install or removal, and does not derive serialized component current life from aircraft utilisation events.

Current serialized component life visibility is read-only and state-based. `LibraryService.evaluateSerializedComponentLifeLimits()` evaluates stored `SerializedComponentLifeState` values against `ComponentLifeLimit` rows. It does not calculate current TSN, TSO, CSN, or CSO from installation baselines plus later aircraft utilisation.

## Files Inspected

- `migrations/080_expand_aircraft_and_components.ts`
- `migrations/552_create_serialized_component_foundation.ts`
- `src/models/core/AircraftComponent.ts`
- `src/models/SerializedComponent.ts`
- `src/models/AircraftComponentInstallation.ts`
- `src/models/SerializedComponentLifeState.ts`
- `src/models/SerializedComponentMaintenanceEvent.ts`
- `src/models/ComponentModel.ts`
- `src/models/ComponentLifeLimit.ts`
- `src/models/associations.ts`
- `src/modules/aircraft/aircraft-component.service.ts`
- `src/modules/library/library.routes.ts`
- `src/modules/library/library.service.ts`
- `src/modules/migration/migration-dry-run.service.ts`
- `src/modules/workpacks/services/workpack-component-integration.service.ts`
- `src/views/aircraft/partials/installed-components-operational-ux.ejs`
- `src/views/aircraft/partials/view-overview-panel.ejs`
- `src/views/library/serialized-component-edit.ejs`
- `src/views/library/serialized-component-life.ejs`

## Existing Structures

### `serialized_components`

Purpose: serialized inventory identity.

Existing fields:

- `id`
- `component_model_id`
- `serial_number`
- `part_number`
- `status`
- `condition`
- `notes`
- timestamps

Current status values are workflow strings such as `AVAILABLE` and `INSTALLED`.

Missing for Phase 3 tracking basis:

- no component-level tracking basis
- no current aircraft association on the component row itself
- no independent engine meter or propeller meter association
- no direct current life derivation fields

### `aircraft_component_installations`

Purpose: serialized component fitment history.

Existing fields:

- `id`
- `aircraft_id`
- `serialized_component_id`
- `installation_context`
- `installed_at`
- `removed_at`
- `position`
- `install_tsn`
- `install_tso`
- `removal_tsn`
- `removal_tso`
- `installed_by`
- `removed_by`
- `notes`
- timestamps

Current install workflows:

- `AircraftComponentService.installSerializedComponent()`
- `AircraftComponentService.baselineCaptureSerializedComponent()`

Current removal workflow:

- `AircraftComponentService.removeSerializedComponent()`

Missing for Phase 3 tracking basis:

- install aircraft hours
- install aircraft cycles
- install CSN
- install CSO
- removal aircraft hours
- removal aircraft cycles
- removal CSN
- removal CSO
- tracking basis
- install utilisation event reference
- removal utilisation event reference
- engine/propeller meter association

### `serialized_component_life_states`

Purpose: current stored life snapshot for a serialized component.

Existing fields:

- `id`
- `serialized_component_id`
- `tsn_hours`
- `tso_hours`
- `csn_cycles`
- `cso_cycles`
- `overhaul_reference_date`
- `calendar_reference_date`
- `notes`
- timestamps

Current workflows:

- `LibraryService.adjustSerializedComponentLifeState()`
- `LibraryService.recordSerializedComponentOverhaul()`
- `LibraryService.evaluateSerializedComponentLifeLimits()`

Current limitation:

These values are stored and adjusted directly. They are not derived from aircraft utilisation events and installation baselines.

Missing for Phase 3 tracking basis:

- derivation source
- tracking basis
- source event reference
- lifecycle calculation provenance
- explicit "manual authorised" state marker

### `serialized_component_maintenance_events`

Purpose: serialized component maintenance event history.

Existing fields:

- `id`
- `serialized_component_id`
- `event_type`
- `occurred_at`
- `recorded_by`
- `notes`
- timestamps

Current event types include at least:

- `LIFE_ADJUSTMENT`
- `OVERHAUL`

Current overhaul behavior:

- `LibraryService.recordSerializedComponentOverhaul()` creates an `OVERHAUL` maintenance event.
- It stores provider, reference, notes, before snapshot, and after snapshot inside the event notes text.
- It updates or creates `SerializedComponentLifeState`.

Missing for Phase 3 tracking basis:

- structured overhaul provider field
- structured overhaul reference field
- structured before/after values
- structured reset flags for TSO and CSO
- explicit overhaul baseline type

### `aircraft_components`

Purpose: legacy installed component records.

Existing fields:

- `id`
- `aircraft_id`
- `model_id`
- `serial_number`
- `position_code`
- `installation_date`
- `install_af_hours`
- `tso_at_install`
- `tsn_at_install`
- `current_status`
- `is_quarantined`
- `removed_at`
- `version`
- `created_at`

Current legacy install behavior:

- `AircraftComponentService.installComponent()` captures:
  - `installation_date`
  - `position_code`
  - submitted `tsn_at_install`
  - submitted `tso_at_install`
  - current aircraft `total_time_hours` as `install_af_hours`

Current legacy removal behavior:

- `AircraftComponentService.removeComponent()` sets:
  - `current_status = REMOVED`
  - `removed_at = new Date()`

Current legacy compatibility behavior:

- `UtilisationService.runLegacyTboGroundingCheck()` still evaluates installed legacy components using aircraft hours, `install_af_hours`, `tsn_at_install`, and `ComponentModel.default_tbo_hours`.

Missing for Phase 3 tracking basis:

- install aircraft cycles
- removal aircraft hours
- removal aircraft cycles
- removal TSN
- removal TSO
- removal CSN
- removal CSO
- CSN and CSO at install
- tracking basis
- installation/removal utilisation event references
- structured overhaul event support

### `component_models`

Purpose: component model master data.

Existing life-related fields:

- `default_tbo_hours`
- `default_tbo_months`
- `service_interval_hours`
- `service_interval_months`
- `overhaul_interval_hours`
- `overhaul_interval_months`
- `maintenance_notes`
- `is_life_limited`
- `warning_threshold_percent`

Current limitation:

These fields are model defaults. They do not define per-installation tracking basis or authoritative meter source.

### `component_life_limits`

Purpose: structured life limits for serialized component models.

Existing fields:

- `id`
- `component_model_id`
- `limit_type`
- `basis`
- `limit_hours`
- `limit_cycles`
- `limit_months`
- `description`
- `is_active`
- timestamps

Current evaluation:

`LibraryService.evaluateSerializedComponentLifeLimits()` normalizes textual limit basis into internal visibility categories:

- `ON_CONDITION`
- `CALENDAR`
- `SINCE_OVERHAUL`
- `SINCE_NEW`
- `UNKNOWN`

Current limitation:

This is due visibility from stored life-state values. It is not yet an installed-component tracking basis authority.

## Current Install Baseline Fields

### Serialized Components

Stored:

- Install date: `aircraft_component_installations.installed_at`
- Install TSN: `aircraft_component_installations.install_tsn`
- Install TSO: `aircraft_component_installations.install_tso`
- Installed position: `aircraft_component_installations.position`
- Installed user: `aircraft_component_installations.installed_by`
- Installation context: `aircraft_component_installations.installation_context`
- Notes: `aircraft_component_installations.notes`

Not stored:

- Install aircraft hours
- Install aircraft cycles
- Install CSN
- Install CSO
- Installed engine association
- Installed propeller association
- Tracking basis
- Install utilisation event reference

### Legacy Components

Stored:

- Install date: `aircraft_components.installation_date`
- Install aircraft hours: `aircraft_components.install_af_hours`
- Install TSN: `aircraft_components.tsn_at_install`
- Install TSO: `aircraft_components.tso_at_install`
- Installed position: `aircraft_components.position_code`

Not stored:

- Install aircraft cycles
- Install CSN
- Install CSO
- Installed engine association
- Installed propeller association
- Tracking basis
- Install utilisation event reference

## Current Removal Baseline Fields

### Serialized Components

Stored:

- Removal date: `aircraft_component_installations.removed_at`
- Removal TSN: `aircraft_component_installations.removal_tsn`
- Removal TSO: `aircraft_component_installations.removal_tso`
- Removed user: `aircraft_component_installations.removed_by`
- Removal notes are appended to `aircraft_component_installations.notes`

Not stored:

- Removal aircraft hours
- Removal aircraft cycles
- Removal CSN
- Removal CSO
- Removal utilisation event reference

### Legacy Components

Stored:

- Removal date: `aircraft_components.removed_at`
- Removed status: `aircraft_components.current_status`

Not stored:

- Removal aircraft hours
- Removal aircraft cycles
- Removal TSN
- Removal TSO
- Removal CSN
- Removal CSO
- Removed user
- Removal reason
- Removal utilisation event reference

## Current Overhaul Baseline Fields

Stored:

- `SerializedComponentLifeState.overhaul_reference_date`
- `SerializedComponentLifeState.tso_hours`
- `SerializedComponentLifeState.cso_cycles`
- `SerializedComponentMaintenanceEvent.event_type = OVERHAUL`
- `SerializedComponentMaintenanceEvent.occurred_at`
- `SerializedComponentMaintenanceEvent.recorded_by`
- overhaul provider, overhaul reference, notes, before snapshot, and after snapshot inside `SerializedComponentMaintenanceEvent.notes`

Current behavior:

- `LibraryService.recordSerializedComponentOverhaul()` requires overhaul date, provider, reference, and notes.
- It accepts TSN, TSO, CSN, CSO, overhaul reference date, and calendar reference date.
- It updates or creates the serialized component life state.
- It creates a serialized component maintenance event of type `OVERHAUL`.

Missing:

- structured overhaul provider column
- structured overhaul reference column
- structured overhaul date column separate from generic `occurred_at`
- explicit TSO reset indicator
- explicit CSO reset indicator
- structured pre-overhaul and post-overhaul life values
- relation to an installation record
- relation to an approved workpack, release, or document record

## Tracking Basis Values

Phase 3 defines the approved tracking basis vocabulary:

### `AIRCRAFT_HOURS`

The installed component life advances with the host aircraft's authoritative hours.

Authority source:

- `aircraft.total_time_hours`
- `utilisation_events.delta_hours`

Use cases:

- airframe-mounted components whose operating time follows aircraft time
- legacy TBO compatibility
- serialized components whose hours since install should advance with aircraft hours

### `AIRCRAFT_CYCLES`

The installed component cycle life advances with the host aircraft's authoritative cycles.

Authority source:

- `aircraft.total_time_cycles`
- `utilisation_events.delta_cycles`

Use cases:

- components limited by aircraft cycles
- cycle-controlled installed parts without independent meter source

### `CALENDAR`

The installed component life is date-driven.

Authority source:

- installation date
- overhaul reference date
- calendar reference date
- current date

Use cases:

- shelf/calendar limits
- overhaul calendar intervals
- expiry-style component controls

### `ENGINE_METER`

The installed component life advances with an engine-specific meter instead of aircraft total time.

Authority source:

- future engine meter authority

Current status:

- Not implemented.
- No engine meter table or engine association was found.

Use cases:

- engine-mounted accessories where life follows engine operation rather than aircraft operation

### `PROPELLER_METER`

The installed component life advances with a propeller-specific meter instead of aircraft total time.

Authority source:

- future propeller meter authority

Current status:

- Not implemented.
- No propeller meter table or propeller association was found.

Use cases:

- propeller assembly or propeller-mounted components where life follows propeller operation

### `MANUAL_AUTHORISED`

The installed component life is maintained by explicit authorised life adjustments rather than automatic meter propagation.

Authority source:

- approved manual adjustment workflow
- source reference
- reason
- audit/maintenance event evidence

Use cases:

- migration baseline
- ambiguous inherited records
- components with external life evidence not derivable from aircraft utilisation
- temporary fallback while meter authority is unavailable

## Install Baseline Rules

Install baseline capture must record enough information to later explain current life. The exact formula is deferred, but the source values are defined here.

### AIRCRAFT_HOURS

Required at install:

- aircraft id
- serialized component id or legacy component id
- installed date
- installed position where applicable
- install aircraft hours from the aircraft utilisation authority
- install TSN where known
- install TSO where known
- tracking basis `AIRCRAFT_HOURS`
- source reference or install authority reference
- installed by

Recommended future fields:

- `install_aircraft_hours`
- `install_utilisation_event_id`

### AIRCRAFT_CYCLES

Required at install:

- aircraft id
- serialized component id or legacy component id
- installed date
- installed position where applicable
- install aircraft cycles from the aircraft utilisation authority
- install CSN where known
- install CSO where known
- tracking basis `AIRCRAFT_CYCLES`
- source reference or install authority reference
- installed by

Recommended future fields:

- `install_aircraft_cycles`
- `install_csn`
- `install_cso`
- `install_utilisation_event_id`

### CALENDAR

Required at install:

- installed date
- calendar reference date
- tracking basis `CALENDAR`
- source reference or install authority reference

Calendar reference date may be:

- installation date
- manufacture date
- release date
- overhaul date
- expiry control date

The selected meaning must be explicit.

### ENGINE_METER

Required at install:

- installed aircraft
- installed engine association
- engine meter identity
- engine meter value at install
- install TSN/TSO or CSN/CSO values where applicable
- tracking basis `ENGINE_METER`
- source reference or install authority reference

Current status:

- Block implementation until engine meter authority exists.

### PROPELLER_METER

Required at install:

- installed aircraft
- installed propeller association
- propeller meter identity
- propeller meter value at install
- install TSN/TSO or CSN/CSO values where applicable
- tracking basis `PROPELLER_METER`
- source reference or install authority reference

Current status:

- Block implementation until propeller meter authority exists.

### MANUAL_AUTHORISED

Required at install:

- installed date
- installed position where applicable
- manually authorised baseline values provided
- reason
- source reference
- recorded by
- tracking basis `MANUAL_AUTHORISED`

Manual baseline values may include:

- TSN
- TSO
- CSN
- CSO
- calendar reference date
- overhaul reference date

## Removal Baseline Rules

Removal baseline capture must close the installed life interval. The exact calculation is deferred, but the closing source values are defined here.

### AIRCRAFT_HOURS

Required at removal:

- removal date
- removal aircraft hours from the aircraft utilisation authority
- removal TSN where known or derived
- removal TSO where known or derived
- removed by
- removal reason/source reference

Recommended future fields:

- `removal_aircraft_hours`
- `removal_utilisation_event_id`

### AIRCRAFT_CYCLES

Required at removal:

- removal date
- removal aircraft cycles from the aircraft utilisation authority
- removal CSN where known or derived
- removal CSO where known or derived
- removed by
- removal reason/source reference

Recommended future fields:

- `removal_aircraft_cycles`
- `removal_csn`
- `removal_cso`
- `removal_utilisation_event_id`

### CALENDAR

Required at removal:

- removal date
- close-out reason
- source reference where applicable

No meter value is required unless the component also has an hour/cycle basis.

### ENGINE_METER

Required at removal:

- removal date
- engine meter identity
- engine meter value at removal
- removal TSN/TSO or CSN/CSO where applicable
- removed by
- source reference

Current status:

- Block implementation until engine meter authority exists.

### PROPELLER_METER

Required at removal:

- removal date
- propeller meter identity
- propeller meter value at removal
- removal TSN/TSO or CSN/CSO where applicable
- removed by
- source reference

Current status:

- Block implementation until propeller meter authority exists.

### MANUAL_AUTHORISED

Required at removal:

- removal date
- manually authorised close-out values where applicable
- reason
- source reference
- recorded by

Manual removal values may include:

- TSN
- TSO
- CSN
- CSO

## Overhaul Baseline Rules

Overhaul must be represented as a component maintenance event and a life-state baseline update.

Required:

- serialized component id
- overhaul date
- overhaul provider
- overhaul reference
- notes/reason
- recorded by
- pre-overhaul life snapshot
- post-overhaul life snapshot

TSO/CSO rules:

- A true overhaul reset must explicitly set the post-overhaul TSO and/or CSO values.
- Resetting TSO to `0` must be explicit, not inferred from the presence of an overhaul event.
- Resetting CSO to `0` must be explicit, not inferred from the presence of an overhaul event.
- If TSO or CSO are not reset, the event must preserve the existing values or record the authorised post-overhaul values.

Reference date rules:

- `overhaul_reference_date` should normally be the overhaul date unless the source document supplies a different controlling date.
- Calendar limits that are based on overhaul should reference `overhaul_reference_date`.
- Calendar limits that are not based on overhaul should use `calendar_reference_date`.

Future structured fields should not rely only on free-text event notes for:

- overhaul provider
- overhaul reference
- reset flags
- before values
- after values

## Legacy Handling Rules

`aircraft_components` remains operationally readable and must not be broken by Phase 3.

Rules:

- Do not remove or retire `aircraft_components`.
- Do not blindly migrate legacy rows into serialized rows.
- Keep legacy installation visibility in aircraft and workpack views.
- Keep legacy TBO grounding compatibility until a later phase replaces it with a unified due engine.
- Treat legacy `install_af_hours` as an aircraft-hours install baseline.
- Treat legacy `tsn_at_install` and `tso_at_install` as existing hour-life baseline values.
- Mark missing cycle baselines as unknown, not zero, during future migration/design work.
- If legacy records are mapped into serialized structures later, migrated records must retain source row id, source table, confidence status, and any missing-field warnings.

Legacy tracking basis default:

- Active legacy rows with `install_af_hours` should be interpreted as `AIRCRAFT_HOURS` for compatibility only.
- This default must be documented as inferred, not authoritative, unless a migration or operator confirms it.

## Serialized Component Handling Rules

Serialized components should eventually derive current life from:

- active installation baseline
- tracking basis
- aircraft utilisation authority
- overhaul baseline
- authorised manual adjustments

Derivation model:

- `aircraft_component_installations` records the fitment interval.
- `serialized_component_life_states` records current authoritative or manually authorised life state until automated derivation replaces or supplements it.
- `serialized_component_maintenance_events` records life adjustments and overhaul evidence.
- `utilisation_events` supplies aircraft hours/cycles movement for aircraft-based tracking.
- Component current life must be explainable from its baseline and source events.

Required future distinction:

- Stored snapshot: the value currently stored for visibility.
- Derived value: the value calculated from baseline plus source movement.
- Manual authorised value: the value approved by a source document or user workflow when derivation is not possible.

## Missing Fields Summary

### Installation Missing Fields

- `tracking_basis`
- `install_aircraft_hours`
- `install_aircraft_cycles`
- `install_csn`
- `install_cso`
- `install_meter_source_id`
- `install_meter_value`
- `install_utilisation_event_id`
- `install_source_reference`

### Removal Missing Fields

- `removal_aircraft_hours`
- `removal_aircraft_cycles`
- `removal_csn`
- `removal_cso`
- `removal_meter_source_id`
- `removal_meter_value`
- `removal_utilisation_event_id`
- `removal_reason`
- `removal_source_reference`

### Overhaul Missing Fields

- structured overhaul provider
- structured overhaul reference
- structured overhaul date if separate from `occurred_at`
- pre-overhaul TSN
- pre-overhaul TSO
- pre-overhaul CSN
- pre-overhaul CSO
- post-overhaul TSN
- post-overhaul TSO
- post-overhaul CSN
- post-overhaul CSO
- TSO reset flag
- CSO reset flag
- source document/work order/release reference relation

### Meter Authority Missing Fields

- engine meter table/authority
- propeller meter table/authority
- installed engine association
- installed propeller association
- meter event history
- meter source reference

## Required Phase 3 Implementation Scope

Phase 3 implementation should be limited to establishing the tracking-basis data contract and baseline capture foundation.

Recommended implementation scope:

1. Add explicit tracking basis vocabulary for installed components.
2. Add structured baseline fields for serialized installations.
3. Capture install aircraft hours and install aircraft cycles from the aircraft utilisation authority.
4. Capture removal aircraft hours and removal aircraft cycles from the aircraft utilisation authority.
5. Add CSN/CSO install and removal baseline support.
6. Preserve current install/removal TSN/TSO behavior.
7. Preserve current legacy `aircraft_components` behavior.
8. Define manual authorised state clearly for incomplete or inherited records.
9. Add tests that prove install/removal baseline capture does not mutate aircraft utilisation.
10. Add tests that prove missing basis values remain unknown, not silently zero.

Out of scope for Phase 3 implementation:

- full current-life calculation formulas
- aircraft utilisation propagation into component life
- due-status engine
- AD/SB/SID recalculation
- scheduled task recalculation
- workpack refresh
- engine meter implementation
- propeller meter implementation
- legacy table retirement

## Risks and Migration Concerns

### Missing Cycle History

Existing legacy and serialized installation rows generally do not contain install aircraft cycles, removal aircraft cycles, install CSN, install CSO, removal CSN, or removal CSO. These must be treated as unknown unless there is an approved source document.

### Zero Versus Unknown

Several existing fields default to zero in legacy records. Future migration work must not treat zero as proof of actual zero life unless the source record establishes that meaning.

### Current Life State Ambiguity

`serialized_component_life_states` stores current values but does not currently state whether values are derived, manually adjusted, imported, or overhaul-reset. Phase 3 should add provenance rather than replacing values blindly.

### Overhaul Evidence Is Partly Textual

Overhaul provider and reference currently live in maintenance event notes. This is readable but weak for later calculation and audit. Structured overhaul evidence will be needed before automated TSO/CSO reset logic can be relied on.

### Legacy Compatibility

Legacy TBO grounding still depends on `aircraft_components`. Phase 3 must not break that path before the later due/TBO phases replace it.

### Engine And Propeller Meters

`ENGINE_METER` and `PROPELLER_METER` are approved future basis values, but no authority exists yet. Phase 3 must define placeholders and validation boundaries without pretending those meters are operational.

### Mixed Life Bases

A single component may have multiple limits: hours, cycles, calendar, since-new, and since-overhaul. Phase 3 should allow multiple life-limit bases to reference a consistent installed-component baseline, but should defer full formula design.

### Workpack Visibility

Workpack operational visibility currently reads serialized installation data and stored life-state due visibility. Phase 3 must not change workpack behavior until propagation and due-status phases explicitly define it.

## Phase 3 Boundary Statement

Phase 3 defines the installed component tracking basis and baseline capture requirements.

It must not:

- implement component life propagation
- implement due-status calculation
- implement AD/SB/SID recalculation
- implement scheduled task recalculation
- change workpack behavior
- remove legacy `aircraft_components`
- infer unknown cycle values as zero
- implement engine or propeller meter authorities

## Recommended Next Phase

Proceed to Phase 3 IMPLEMENT only after this definition is accepted.

The implementation should start with explicit tracking-basis and baseline capture fields for serialized installations, while preserving legacy component behavior and keeping all calculation/propagation work deferred.
