# Phase 4 - Backend Component Life Calculation

## Mode

DEFINE

## Goal

Define how Jupiter will calculate current component life from install/removal baselines, overhaul baselines, tracking basis, and aircraft utilisation authority.

This phase does not implement formulas, propagation, due-status engines, AD/SB/SID recalculation, scheduled task recalculation, migrations, or workpack lifecycle changes.

## Current Implementation Status

Status: PARTIAL

Jupiter currently stores the foundations needed for later backend component life calculation:

- serialized component identity
- serialized installation/removal history
- tracking basis and install/removal baseline fields
- serialized component life-state snapshots
- serialized component maintenance events
- aircraft utilisation event authority for aircraft hours and cycles
- legacy `aircraft_components` baselines for older installed components

Jupiter does not yet have a backend component life calculation service. Current serialized component life visibility is still based on stored `SerializedComponentLifeState` values evaluated by `LibraryService.evaluateSerializedComponentLifeLimits()`.

## Files Inspected

- `src/models/SerializedComponentLifeState.ts`
- `src/models/AircraftComponentInstallation.ts`
- `src/models/SerializedComponentMaintenanceEvent.ts`
- `src/models/core/AircraftComponent.ts`
- `src/models/ComponentLifeLimit.ts`
- `src/modules/library/library.service.ts`
- `src/modules/aircraft/aircraft-component.service.ts`
- `src/modules/utilisation/utilisation.service.ts`
- `src/modules/maintenance/maintenance-trigger.service.ts`
- `src/modules/workpacks/services/workpack-component-integration.service.ts`
- `migrations/080_expand_aircraft_and_components.ts`
- `migrations/120_component_models_asset_type_refactor.ts`
- `migrations/552_create_serialized_component_foundation.ts`
- `migrations/565_add_component_tracking_basis_baselines.ts`
- `docs/phase-installed-component-tracking-basis.md`

## Existing Life State

### `serialized_component_life_states`

Stored fields:

- `serialized_component_id`
- `tsn_hours`
- `tso_hours`
- `csn_cycles`
- `cso_cycles`
- `overhaul_reference_date`
- `calendar_reference_date`
- `notes`

Current role:

- stores current or manually adjusted life values
- supports life-limit visibility through `LibraryService.evaluateSerializedComponentLifeLimits()`
- stores overhaul/calendar reference dates for existing visibility

Current limitation:

- does not indicate whether values are calculated, manually authorised, imported, or overhaul-reset
- does not currently derive values from aircraft utilisation events

### `aircraft_component_installations`

Stored install/removal baseline fields:

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

- records serialized component fitment intervals
- stores install/removal baselines
- captures aircraft snapshot hours/cycles during serialized install/removal

Current limitation:

- does not calculate current life from those baselines
- does not currently reference the exact utilisation event at install/removal
- does not have engine/propeller meter authority

### `serialized_component_maintenance_events`

Stored fields:

- `serialized_component_id`
- `event_type`
- `occurred_at`
- `recorded_by`
- `notes`

Current role:

- records `LIFE_ADJUSTMENT`, `OVERHAUL`, and generic maintenance events
- `OVERHAUL` events are created by `LibraryService.recordSerializedComponentOverhaul()`
- overhaul provider/reference/before/after values are stored in event notes text

Current limitation:

- overhaul reset information is not structurally represented
- no structured pre/post overhaul columns exist

### Legacy `aircraft_components`

Stored baseline fields:

- `installation_date`
- `install_af_hours`
- `tsn_at_install`
- `tso_at_install`
- `removed_at`
- `current_status`

Current role:

- remains operationally readable
- supports legacy TBO compatibility checks
- existing TBO logic uses aircraft hours, `install_af_hours`, and `tsn_at_install`

Current limitation:

- no aircraft cycle baseline
- no CSN/CSO
- no tracking basis field
- no structured overhaul baseline

### Component Life Limit Logic

Current logic:

- `LibraryService.evaluateSerializedComponentLifeLimits()` evaluates stored life-state values against `ComponentLifeLimit`.
- It normalizes life limit basis text into internal visibility categories:
  - `ON_CONDITION`
  - `CALENDAR`
  - `SINCE_OVERHAUL`
  - `SINCE_NEW`
  - `UNKNOWN`

Current limitation:

- life limit evaluation is not the same as component life derivation
- it does not compute current TSN/TSO/CSN/CSO from installation and utilisation baselines

## Stored Values Versus Derived Values

### Stored Baselines

Stored baselines are facts captured at workflow boundaries.

Installation baselines:

- install date
- tracking basis
- install aircraft hours
- install aircraft cycles
- install TSN
- install TSO
- install CSN
- install CSO
- position

Removal baselines:

- removal date
- removal aircraft hours
- removal aircraft cycles
- removal TSN
- removal TSO
- removal CSN
- removal CSO

Overhaul baselines:

- overhaul date
- overhaul reference date
- post-overhaul TSN if recorded
- post-overhaul TSO if recorded
- post-overhaul CSN if recorded
- post-overhaul CSO if recorded
- source reference and notes

Manual life-state baselines:

- stored `SerializedComponentLifeState` TSN/TSO/CSN/CSO
- stored overhaul/calendar reference dates
- life adjustment event reason/source reference

### Backend-Derived Current Values

The following values must become backend-derived outputs:

- current TSN hours
- current TSO hours
- current CSN cycles
- current CSO cycles
- current calendar age/reference status where relevant
- calculation status
- explainability
- missing data reasons

Frontend must not calculate these values. It may display backend-calculated values only.

### Stored Snapshot Compatibility

`SerializedComponentLifeState` remains readable during Phase 4. It may continue to represent manually authorised or imported life-state values where derivation is not possible.

Phase 4 must distinguish:

- baseline stored value
- derived current value
- manual authorised current value
- unknown value

## Formula Definitions

These formulas define the target calculation model. They are not implemented in this DEFINE phase.

### Common Terms

`install_aircraft_hours`: aircraft total hours captured at component install.

`current_aircraft_hours`: current aircraft total hours from the aircraft utilisation authority.

`install_aircraft_cycles`: aircraft total cycles captured at component install.

`current_aircraft_cycles`: current aircraft total cycles from the aircraft utilisation authority.

`delta_hours_since_install`:

```text
current_aircraft_hours - install_aircraft_hours
```

`delta_cycles_since_install`:

```text
current_aircraft_cycles - install_aircraft_cycles
```

Negative deltas must produce `UNKNOWN` unless the event is explicitly explained by a correction workflow and the component baseline can still be proven valid.

### Current TSN Hours

For aircraft-hours tracked components:

```text
current_tsn_hours = install_tsn + (current_aircraft_hours - install_aircraft_hours)
```

Required data:

- `tracking_basis = AIRCRAFT_HOURS`
- `install_tsn`
- `install_aircraft_hours`
- current aircraft hours

For manual authorised components:

```text
current_tsn_hours = stored_or_authorised_tsn_hours
```

Required data:

- manual authorised value
- source reference/reason

For other bases:

- `AIRCRAFT_CYCLES`: TSN is not derived unless an hour baseline/source also exists.
- `CALENDAR`: TSN is not derived from calendar.
- `ENGINE_METER`: derive from engine meter once engine meter authority exists.
- `PROPELLER_METER`: derive from propeller meter once propeller meter authority exists.

### Current TSO Hours

For aircraft-hours tracked components without post-install overhaul:

```text
current_tso_hours = install_tso + (current_aircraft_hours - install_aircraft_hours)
```

For aircraft-hours tracked components with a post-install overhaul reset:

```text
current_tso_hours = post_overhaul_tso + (current_aircraft_hours - aircraft_hours_at_overhaul)
```

If `post_overhaul_tso` is explicitly reset to zero:

```text
current_tso_hours = current_aircraft_hours - aircraft_hours_at_overhaul
```

Required data:

- `tracking_basis = AIRCRAFT_HOURS`
- either install TSO and install aircraft hours, or structured post-overhaul TSO and aircraft hours at overhaul
- current aircraft hours

If aircraft hours at overhaul are not structurally available, TSO must be `UNKNOWN` unless a manual authorised TSO is provided.

### Current CSN Cycles

For aircraft-cycles tracked components:

```text
current_csn_cycles = install_csn + (current_aircraft_cycles - install_aircraft_cycles)
```

Required data:

- `tracking_basis = AIRCRAFT_CYCLES`
- `install_csn`
- `install_aircraft_cycles`
- current aircraft cycles

For manual authorised components:

```text
current_csn_cycles = stored_or_authorised_csn_cycles
```

For other bases:

- `AIRCRAFT_HOURS`: CSN is not derived unless a cycle baseline/source also exists.
- `CALENDAR`: CSN is not derived from calendar.
- `ENGINE_METER`: derive from engine meter cycles once engine meter authority exists.
- `PROPELLER_METER`: derive from propeller meter cycles once propeller meter authority exists.

### Current CSO Cycles

For aircraft-cycles tracked components without post-install overhaul:

```text
current_cso_cycles = install_cso + (current_aircraft_cycles - install_aircraft_cycles)
```

For aircraft-cycles tracked components with a post-install overhaul reset:

```text
current_cso_cycles = post_overhaul_cso + (current_aircraft_cycles - aircraft_cycles_at_overhaul)
```

If `post_overhaul_cso` is explicitly reset to zero:

```text
current_cso_cycles = current_aircraft_cycles - aircraft_cycles_at_overhaul
```

Required data:

- `tracking_basis = AIRCRAFT_CYCLES`
- either install CSO and install aircraft cycles, or structured post-overhaul CSO and aircraft cycles at overhaul
- current aircraft cycles

If aircraft cycles at overhaul are not structurally available, CSO must be `UNKNOWN` unless a manual authorised CSO is provided.

## Basis-Specific Calculation Rules

### AIRCRAFT_HOURS

Current hours source:

- current aircraft `total_time_hours` governed by `UtilisationService`

Derived dimensions:

- TSN hours
- TSO hours

Not derived by this basis alone:

- CSN cycles
- CSO cycles

Required install baseline:

- `install_aircraft_hours`
- `install_tsn` for TSN
- `install_tso` for TSO

Unknown conditions:

- missing install aircraft hours
- missing install TSN for TSN calculation
- missing install TSO for TSO calculation
- missing current aircraft hours
- negative aircraft-hour delta without valid correction explanation

### AIRCRAFT_CYCLES

Current cycles source:

- current aircraft `total_time_cycles` governed by `UtilisationService`

Derived dimensions:

- CSN cycles
- CSO cycles

Not derived by this basis alone:

- TSN hours
- TSO hours

Required install baseline:

- `install_aircraft_cycles`
- `install_csn` for CSN
- `install_cso` for CSO

Unknown conditions:

- missing install aircraft cycles
- missing install CSN for CSN calculation
- missing install CSO for CSO calculation
- missing current aircraft cycles
- negative aircraft-cycle delta without valid correction explanation

### CALENDAR

Current source:

- system date or calculation date supplied by backend

Derived dimensions:

- calendar elapsed age
- calendar due reference only

Not derived:

- TSN
- TSO
- CSN
- CSO

Required baseline:

- installation date, calendar reference date, or overhaul reference date depending on the limit type

Unknown conditions:

- missing reference date
- invalid reference date
- ambiguous calendar basis

### ENGINE_METER

Current source:

- future engine meter authority

Derived dimensions:

- engine-meter TSN/TSO or CSN/CSO depending on the meter dimension

Current status:

- not implemented
- must return `UNKNOWN` until engine meter authority exists

Required future baseline:

- engine association
- engine meter id
- install engine meter value
- current engine meter value
- relevant TSN/TSO/CSN/CSO baseline

### PROPELLER_METER

Current source:

- future propeller meter authority

Derived dimensions:

- propeller-meter TSN/TSO or CSN/CSO depending on the meter dimension

Current status:

- not implemented
- must return `UNKNOWN` until propeller meter authority exists

Required future baseline:

- propeller association
- propeller meter id
- install propeller meter value
- current propeller meter value
- relevant TSN/TSO/CSN/CSO baseline

### MANUAL_AUTHORISED

Current source:

- authorised stored life-state value or life adjustment event

Derived dimensions:

- none by automatic meter movement

Displayed current values:

- TSN/TSO/CSN/CSO values may be displayed if supported by `SerializedComponentLifeState` and source evidence

Required baseline:

- stored authorised value
- source reference or reason
- recorded by
- occurred at

Unknown conditions:

- missing authorised value
- missing source evidence
- missing reason

## Overhaul Behavior

Overhaul affects since-overhaul values and calendar reference behavior. It does not automatically change since-new values unless the source document explicitly provides corrected since-new values.

### Overhaul Date

`overhaul_reference_date` is the controlling date for calendar limits that are based on overhaul.

If an overhaul event exists but no reference date exists:

- calendar since-overhaul output must be `UNKNOWN`

### TSO

TSO after overhaul must be based on a structured post-overhaul TSO baseline.

Rules:

- If post-overhaul TSO is zero and source evidence supports a reset, TSO starts at zero from the overhaul meter baseline.
- If post-overhaul TSO is nonzero, that value becomes the TSO baseline from the overhaul meter baseline.
- If no post-overhaul TSO is captured, TSO cannot be inferred from the presence of an overhaul event alone.

### CSO

CSO after overhaul must be based on a structured post-overhaul CSO baseline.

Rules:

- If post-overhaul CSO is zero and source evidence supports a reset, CSO starts at zero from the overhaul meter baseline.
- If post-overhaul CSO is nonzero, that value becomes the CSO baseline from the overhaul meter baseline.
- If no post-overhaul CSO is captured, CSO cannot be inferred from the presence of an overhaul event alone.

### Current Gap

Current `SerializedComponentMaintenanceEvent` stores overhaul details in `notes`. Phase 4 implementation should not depend on free-text parsing for calculations.

If structured overhaul meter baselines are missing:

- TSO/CSO since overhaul must be `UNKNOWN`, or
- use `MANUAL_AUTHORISED` values with explicit explanation

## Unknown Baseline Behavior

Jupiter must not guess component life values.

If any required source value is missing:

- return state `UNKNOWN`
- return the affected dimension as `null`
- include a missing-data reason
- preserve any stored baseline values in explainability
- do not substitute zero unless the source field is explicitly known to be zero

Examples:

- missing `install_aircraft_hours`: TSN/TSO aircraft-hours calculation is `UNKNOWN`
- missing `install_aircraft_cycles`: CSN/CSO aircraft-cycles calculation is `UNKNOWN`
- missing `install_tsn`: TSN is `UNKNOWN`
- missing `install_tso`: TSO is `UNKNOWN`
- missing `install_csn`: CSN is `UNKNOWN`
- missing `install_cso`: CSO is `UNKNOWN`
- missing current aircraft cycles: cycle calculations are `UNKNOWN`
- engine meter basis before engine meter authority exists: `UNKNOWN`
- propeller meter basis before propeller meter authority exists: `UNKNOWN`

## Backend Calculation Service

Phase 4 implementation should introduce a backend service responsible for component life calculation.

Recommended service name:

- `ComponentLifeCalculationService`

Responsibilities:

- load active serialized installation
- load serialized component life state
- load relevant maintenance/overhaul events
- load current aircraft utilisation snapshot
- choose calculation path from `tracking_basis`
- calculate current TSN/TSO/CSN/CSO where possible
- return `UNKNOWN` where required data is missing
- provide explainability for every calculated or unknown value

Non-responsibilities:

- updating aircraft utilisation
- mutating component life state
- recalculating AD/SB/SID compliance
- recalculating scheduled tasks
- creating workpack tasks
- refreshing workpack lifecycle state
- previewing propagation

Frontend rule:

- frontend must display service outputs only
- frontend must not calculate deltas, TSN, TSO, CSN, or CSO

## Explainability Output

Every calculation result must include:

- `serialized_component_id`
- `installation_id`
- `tracking_basis`
- `calculation_status`
- `as_of_date`
- `current_tsn_hours`
- `current_tso_hours`
- `current_csn_cycles`
- `current_cso_cycles`
- per-dimension status
- per-dimension missing reasons
- baseline values used
- current aircraft/meter values used
- delta applied
- resulting value
- source event/reference ids where available

Suggested shape:

```text
{
  status,
  tracking_basis,
  values: {
    tsn_hours,
    tso_hours,
    csn_cycles,
    cso_cycles
  },
  dimensions: {
    tsn_hours: {
      status,
      baseline_value,
      baseline_aircraft_hours,
      current_aircraft_hours,
      delta,
      result,
      missing_reasons
    }
  },
  explanation
}
```

Explainability examples:

- `AIRCRAFT_HOURS: TSN = install TSN 100.25 + aircraft hours delta 12.50 = 112.75.`
- `AIRCRAFT_CYCLES: CSO unknown because install CSO is not captured.`
- `ENGINE_METER: unknown because engine meter authority is not implemented.`
- `MANUAL_AUTHORISED: TSO from stored life-state value 5.50, source LIFE_ADJUSTMENT event.`

## Assumptions

- Aircraft hours and cycles are authoritative only through `UtilisationService` and `utilisation_events`.
- Active serialized installations are the first target for Phase 4.
- Legacy `aircraft_components` remains readable and is not retired in Phase 4.
- Engine and propeller meters are approved future bases but not operational yet.
- `SerializedComponentLifeState` can continue to support manual authorised values while derived values are introduced.
- Existing stored zero values may mean unknown, defaulted, or true zero depending on source provenance; Phase 4 must not assume zero is true zero without evidence.

## Risks

### Ambiguous Existing Life State

Existing `SerializedComponentLifeState` values do not record whether they are calculated, manual, imported, or overhaul-reset.

### Missing Overhaul Meter Baselines

Current overhaul events do not structurally capture aircraft hours/cycles or meter values at overhaul. Since-overhaul derivation may be `UNKNOWN` for many records.

### Zero Versus Unknown

Legacy defaults and historical data may contain zero values that are not confirmed actual zero-life values.

### Multiple Bases On One Component

A component may need aircraft-hours TSN/TSO and aircraft-cycles CSN/CSO simultaneously. Current `tracking_basis` is one value on the installation, so Phase 4 may need per-dimension basis handling or a controlled rule for mixed bases.

### Aircraft Corrections

Aircraft utilisation corrections can decrease current hours/cycles. Component calculation must detect negative deltas and explain the result rather than silently producing invalid life.

### Closed Installations

Removal baselines exist for closed installation intervals. Phase 4 must distinguish active current life from historical interval close-out values.

## Required Phase 4 Implementation Scope

Recommended implementation scope:

1. Add `ComponentLifeCalculationService`.
2. Implement read-only calculation for active serialized installations.
3. Support `AIRCRAFT_HOURS` TSN/TSO derivation from install baseline and current aircraft hours.
4. Support `AIRCRAFT_CYCLES` CSN/CSO derivation from install baseline and current aircraft cycles.
5. Return `UNKNOWN` with reasons for missing baselines.
6. Return `UNKNOWN` for `ENGINE_METER` and `PROPELLER_METER` until meter authority exists.
7. Support `MANUAL_AUTHORISED` from stored life-state values with explainability.
8. Preserve existing `LibraryService.evaluateSerializedComponentLifeLimits()` behavior unless a later phase explicitly replaces it.
9. Add focused service tests for each basis and unknown condition.
10. Add UI/read path only after backend service output exists.

Out of scope:

- TBO due monitoring
- AD/SB/SID due recalculation
- scheduled task due recalculation
- workpack refresh
- utilisation propagation preview
- mutation of aircraft utilisation
- migration of legacy component data

## Boundary Statement

Phase 4 defines backend component life calculation.

It must not implement:

- TBO due monitoring
- AD due status
- SB due status
- SID due status
- scheduled task due status
- propagation preview
- workpack lifecycle authority changes
- aircraft utilisation authority changes

## Recommended Next Phase

Proceed to Phase 4 IMPLEMENT only after this definition is accepted.

Implementation should start with a read-only calculation service and tests. It should not replace stored life-state due visibility until the later due-status phases define that transition.
