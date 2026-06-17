# Phase: Utilisation Event Architecture

## Mode

DEFINE REPAIR.

No implementation. No migrations. No code changes. No schema changes yet.

## Goal

Define the backend event architecture for aircraft utilisation so aircraft hours, cycles, and effective dates become an auditable source of truth for later component life propagation and due-status recalculation.

This phase defines the event architecture only. It does not implement component propagation, AD/SB/SID due tracking, scheduled task recalculation, or component TBO/retirement monitoring.

This repaired definition also resolves the verified legacy ambiguity around `AircraftService.updateHours()` and generic aircraft detail edits. The future utilisation engine must become the single backend authority for changing aircraft hours and aircraft cycles.

## Critical Authority Rules

- Backend owns utilisation truth.
- Frontend only submits input and displays backend results.
- `UtilisationService` is the only approved backend authority for changing `aircraft.total_time_hours`.
- `UtilisationService` is the only approved backend authority for changing `aircraft.total_time_cycles`.
- Utilisation changes must be represented as immutable backend events.
- `AircraftService.updateHours()` must not remain an independent utilisation authority.
- Generic aircraft detail edits must not silently change utilisation values once Phase 1 is implemented.
- Existing non-utilisation aircraft edit behavior must be preserved.
- Component propagation must not be implemented in this phase.
- AD/SB/SID recalculation must not be implemented in this phase.
- Scheduled task recalculation must not be implemented in this phase.
- No hidden frontend or SQL-view lifecycle recalculation may become authoritative.

## 0. Existing Service Boundary Repair

Verification found:

- `AircraftService.updateHours()` exists.
- No application route currently calls `AircraftService.updateHours()`.
- `AircraftService.updateHours()` directly updates `aircraft.total_time_hours`.
- `AircraftService.updateHours()` contains legacy TBO grounding logic for installed `aircraft_components`.
- Normal aircraft edits bypass `AircraftService.updateHours()` through `AircraftService.updateDetails()`, which directly assigns `total_time_hours`.

Phase 1 authority decision:

- `AircraftService.updateHours()` is not the future utilisation authority.
- `AircraftService.updateHours()` must not remain a parallel or independent path for changing aircraft utilisation.
- During implementation, it must either be deprecated and blocked from direct use, or converted into a thin compatibility wrapper around `UtilisationService`.
- If retained as a wrapper, it may only delegate to `UtilisationService`; it must not perform its own independent snapshot update.
- Final removal may occur in a later approved cleanup or retirement phase after all callers, tests, and compatibility needs have been resolved.

`AircraftService.updateDetails()` authority decision:

- Aircraft detail editing must preserve unrelated aircraft edit behavior.
- Editing registration, serial number, model, category, status-adjacent metadata, loaded/system dates, TCDS fields, photo, notes, customer links, and other non-utilisation details must continue through existing aircraft workflows unless separately changed by an approved phase.
- `AircraftService.updateDetails()` must not silently change `aircraft.total_time_hours` or `aircraft.total_time_cycles` once Phase 1 is implemented.
- If submitted aircraft detail data includes changed utilisation fields, implementation must either route the change through `UtilisationService` with all event requirements satisfied, or reject/block the utilisation field change and require the dedicated utilisation workflow.
- Preferred operational design is to move utilisation changes out of the generic aircraft detail form and into a controlled utilisation screen.

`UtilisationService` authority decision:

- `UtilisationService` is the only approved backend path for accepted changes to `aircraft.total_time_hours`.
- `UtilisationService` is the only approved backend path for accepted changes to `aircraft.total_time_cycles`.
- `UtilisationService` owns validation, event creation, aircraft snapshot update, correction handling, audit integration, and post-utilisation compatibility hooks.
- No controller, aircraft service, inventory service, workpack service, compliance service, frontend form, SQL view, script, or import workflow may update aircraft utilisation snapshots directly once this authority is implemented.

Legacy TBO compatibility decision:

- The existing TBO grounding behavior inside `AircraftService.updateHours()` must not be lost during Phase 1 implementation.
- During implementation, that behavior should be moved behind `UtilisationService` as a post-utilisation legacy compatibility check.
- The compatibility check may continue to evaluate installed legacy `aircraft_components` using aircraft total hours, `install_af_hours`, `tsn_at_install`, and `ComponentModel.default_tbo_hours`.
- The compatibility check must remain traceable to the accepted utilisation event.
- The compatibility check is temporary coexistence behavior until later due/TBO phases replace it with the approved backend due/TBO authority.
- Phase 1 must not expand this check into full component propagation, serialized life mutation, due recalculation, or workpack mutation.

## 1. `utilisation_events` Table Concept

`utilisation_events` is the authoritative event stream for aircraft utilisation changes.

Each row represents a discrete utilisation state transition for one aircraft:

- initial baseline
- normal hours/cycles increase
- calendar-effective utilisation update
- correction
- imported utilisation entry
- journey/tech/flight log entry

The table is append-only. It records both previous and new aircraft utilisation values so downstream services can calculate deltas, trace corrections, and explain propagated effects.

The event stream is the audit-grade source for why `aircraft.total_time_hours` and aircraft cycles changed.

## 2. Required Fields

The conceptual `utilisation_events` record must include:

- `id`
- `aircraft_id`
- `source_type`
- `source_reference`
- `effective_date`
- `previous_total_time_hours`
- `new_total_time_hours`
- `delta_hours`
- `previous_total_time_cycles`
- `new_total_time_cycles`
- `delta_cycles`
- `reason`
- `created_by`
- `created_at`
- `correction_of_event_id`
- `metadata`

Field definitions:

- `aircraft_id`: Aircraft affected by the utilisation update.
- `source_type`: Controlled source classification.
- `source_reference`: External or internal reference, such as log page, tech log number, import batch, or correction reference.
- `effective_date`: Operational date the utilisation change applies to.
- `previous_total_time_hours`: Authoritative aircraft total hours before the event.
- `new_total_time_hours`: Authoritative aircraft total hours after the event.
- `delta_hours`: `new_total_time_hours - previous_total_time_hours`.
- `previous_total_time_cycles`: Authoritative aircraft total cycles before the event.
- `new_total_time_cycles`: Authoritative aircraft total cycles after the event.
- `delta_cycles`: `new_total_time_cycles - previous_total_time_cycles`.
- `reason`: Human-readable reason. Mandatory for manual entries and corrections.
- `created_by`: User who created the event, or system actor for import/baseline.
- `created_at`: Timestamp when the event was created in Jupiter.
- `correction_of_event_id`: Optional link to the prior utilisation event being corrected.
- `metadata`: Structured JSON for source-specific details, preview details, import identifiers, comments, and validation context.

## 3. Utilisation Source Types

Allowed source types:

- `MANUAL_ENTRY`
- `JOURNEY_LOG`
- `TECH_LOG`
- `FLIGHT_FOLIO`
- `INITIAL_BASELINE`
- `CORRECTION`
- `IMPORT`

Source type rules:

- `INITIAL_BASELINE` establishes the first authoritative known utilisation state for an aircraft.
- `MANUAL_ENTRY` is a controlled user-entered update.
- `JOURNEY_LOG`, `TECH_LOG`, and `FLIGHT_FOLIO` represent operational records.
- `IMPORT` represents imported utilisation data.
- `CORRECTION` represents an explicit correction to prior utilisation state and must use correction rules.

## 4. Validation Rules

General validation:

- Aircraft must exist.
- New total hours must be numeric.
- New total cycles must be numeric when cycles are supplied.
- Aircraft total hours cannot become negative.
- Aircraft total cycles cannot become negative.
- `effective_date` is required.
- `source_type` is required.
- `recorded_by` is required unless the event is created by a defined system actor.

Increase rules:

- Hour increases are allowed when source and reason/reference requirements are satisfied.
- Cycle increases are allowed when source and reason/reference requirements are satisfied.
- The backend calculates deltas.
- Frontend-submitted deltas are not authoritative.

Decrease/correction rules:

- A decrease in total hours is a correction.
- A decrease in total cycles is a correction.
- Corrections require a correction reason.
- Corrections require a source reference.
- Corrections should use `source_type = CORRECTION` unless created by a controlled import correction workflow.
- Corrections should link to `correction_of_event_id` when correcting a known event.
- Corrections must create audit evidence.
- Corrections must not silently overwrite prior events.

No silent overwrite:

- Existing utilisation events are not edited to change historical values.
- Aircraft current utilisation may move forward or backward only through a new event.
- Downstream recalculation must be traceable to the new event.

## 5. Event Immutability

Utilisation events are immutable after creation.

Allowed post-creation actions:

- read
- reference
- supersede by correction event
- annotate through a separate audit/comment mechanism if required later

Disallowed post-creation actions:

- changing previous values
- changing new values
- changing deltas
- changing source type
- changing effective date
- changing correction linkage
- deleting events to alter lifecycle history

Corrections create new linked events. A correction changes current authoritative aircraft utilisation by appending a new event, not by editing the original event.

## 6. Relationship To `aircraft.total_time_hours`

`aircraft.total_time_hours` remains the current operational snapshot.

The utilisation event stream is the authoritative history.

`UtilisationService` is the only approved backend service allowed to change this snapshot after Phase 1 implementation.

When a utilisation event is accepted:

1. Backend locks the aircraft record.
2. Backend reads current `aircraft.total_time_hours`.
3. Backend validates the submitted new total hours.
4. Backend creates a utilisation event with previous/new/delta values.
5. Backend updates `aircraft.total_time_hours` to `new_total_time_hours`.
6. Backend records audit evidence.

`aircraft.total_time_hours` must not be edited directly by ordinary aircraft detail update flows once utilisation events are introduced. Any aircraft-hours change must go through the utilisation event workflow.

## 7. Relationship To Aircraft Cycles

If aircraft cycles already exist, the utilisation event workflow must treat them as first-class authoritative utilisation values.

If aircraft cycles are not yet operationally wired, this architecture reserves cycle fields in the event model so cycle tracking can be added without redesigning the event stream.

Required behavior when cycles are available:

- `previous_total_time_cycles` comes from the current aircraft cycle snapshot.
- `new_total_time_cycles` is submitted or derived from an approved source.
- `delta_cycles` is backend-calculated.
- cycle decreases follow correction rules.

`aircraft.total_time_cycles` remains the current operational cycle snapshot. After Phase 1 implementation, it may be changed only by `UtilisationService`.

Required behavior before cycles are fully available:

- cycle fields may be null only if the aircraft cycle source is explicitly not configured.
- null cycle handling must be explicit and explainable.
- future migration to cycle tracking must not require rewriting hour events.

## 8. Relationship To Installed Components

This phase does not implement component propagation.

Architectural relationship:

- Utilisation events become the trigger input for future component life propagation.
- Installed component propagation must reference a specific `utilisation_event_id`.
- Component life changes must be traceable back to the utilisation event that caused them.

Future propagation targets:

- serialized installed components
- legacy `aircraft_components`
- engines
- propellers
- airframe-tracked components
- cycle-tracked components
- calendar-tracked components
- independently metered components

Expected future propagation contract:

- read accepted utilisation event
- identify active installations at event effective date
- determine each component tracking basis
- calculate current life or delta life
- create traceable propagation records
- recalculate due status

No component TSN/TSO/CSN/CSO update is part of this phase.

## 9. Relationship To Due-Status Recalculation

This phase does not implement due-status recalculation.

Architectural relationship:

- Accepted utilisation events become trigger candidates for due-status recalculation.
- Due recalculation must reference the utilisation event that caused it.
- Recalculation must be backend-owned and explainable.

Future due-status targets:

- AD due by hours/date/cycles
- SB due by hours/date/cycles
- SID due by hours/date/cycles
- scheduled task due by hours/date/cycles
- component TBO due
- component retirement due
- warning threshold changes

Expected future recalculation contract:

- read accepted utilisation event
- read current aircraft/component state
- evaluate applicable due rules
- produce due status and explanation
- store or expose recalculation result through backend truth

No AD/SB/SID/task due recalculation is part of this phase.

## 10. Audit-Log Integration

Every accepted utilisation event must create audit evidence.

Minimum audit requirements:

- table/entity: `utilisation_events`
- action: `UTILISATION_EVENT_CREATED`
- actor: `recorded_by`
- aircraft id
- utilisation event id
- previous hours/cycles
- new hours/cycles
- deltas
- effective date
- source type
- source reference
- reason
- correction flag
- correction event link when present

If the event updates `aircraft.total_time_hours` or aircraft cycle snapshot fields, the audit trail must also make the aircraft snapshot update traceable to the utilisation event.

Audit logs supplement the event stream. They do not replace the event stream.

## 11. Rollback And Correction Strategy

Utilisation events are not rolled back by deleting or editing history after acceptance.

Operational correction strategy:

1. User starts correction workflow.
2. Backend loads current aircraft utilisation and relevant prior events.
3. User submits corrected hours/cycles/effective date with reason.
4. User supplies source reference and prior event link where practical.
5. Backend validates that the correction will not create negative aircraft time/cycles.
6. Backend creates a new correction utilisation event.
7. Backend updates aircraft snapshot fields to the corrected current values.
8. Backend records audit evidence.
9. Future propagation and due recalculation phases use the correction event as their trigger.

If a transaction fails before event acceptance, no event or aircraft snapshot update should persist.

If downstream propagation fails in a future phase, the architecture must define whether:

- the utilisation event is rejected atomically, or
- the utilisation event is accepted and downstream recalculation is marked failed/pending.

That decision is out of scope for this definition and must be finalized before propagation implementation.

## 12. UI Expectations

The UI must submit utilisation intent only. It must not calculate authoritative lifecycle results.

Required UI behaviors:

- aircraft utilisation update screen
- current aircraft hours display
- current aircraft cycles display when available
- new hours input
- new cycles input when available
- effective date input
- source type selector
- source reference input
- reason input
- correction warning when values decrease
- correction reason required when reducing hours or cycles

Pre-confirmation summary:

- previous hours/cycles
- new hours/cycles
- calculated deltas from backend preview
- source type
- effective date
- correction flag
- warning if reducing hours/cycles

Affected item preview:

- The UI should show a backend-generated preview when available.
- In this phase, preview may be limited to event-level validation.
- Future phases should include affected component and due item previews.

The UI must not silently update aircraft hours through the generic aircraft details form once utilisation events are active.

The generic aircraft detail form may continue to edit non-utilisation aircraft details. Utilisation fields must either be absent/read-only in that form or submitted to a backend path that delegates to `UtilisationService` and satisfies all event requirements.

## 13. Implementation Readiness Checklist

Before implementation begins, confirm:

- event fields are finalized
- source types are finalized
- correction rules are accepted
- event immutability rule is accepted
- relationship to `aircraft.total_time_hours` is accepted
- aircraft cycle handling is accepted
- direct aircraft-hours edits will be routed through utilisation workflow
- direct aircraft-cycle edits will be routed through utilisation workflow
- `UtilisationService` is accepted as the only aircraft utilisation snapshot mutation authority
- `AircraftService.updateHours()` is accepted as deprecated or wrapper-only, not independent authority
- `AircraftService.updateDetails()` is accepted as non-authoritative for utilisation fields
- legacy TBO grounding behavior is preserved behind `UtilisationService` as temporary compatibility behavior
- audit-log integration pattern is accepted
- frontend preview is backend-generated
- no component propagation is included in this phase
- no AD/SB/SID recalculation is included in this phase
- no scheduled task recalculation is included in this phase
- no schema migration is included until the implementation phase

## 14. Future VERIFY Criteria

Future verification should confirm:

- utilisation event is created for aircraft hours update
- utilisation event stores previous/new/delta hours
- utilisation event stores previous/new/delta cycles when cycles are available
- aircraft hours are changed only through `UtilisationService`
- aircraft cycles are changed only through `UtilisationService`
- `AircraftService.updateHours()` has no independent mutation authority
- generic aircraft detail edits cannot silently change utilisation fields
- aircraft snapshot updates only after valid event creation
- aircraft hours cannot become negative
- aircraft cycles cannot become negative
- hour decrease requires correction workflow
- cycle decrease requires correction workflow
- correction creates a new linked event
- original event remains unchanged
- audit log references utilisation event id
- correction events require reason and source reference
- correction events link to a prior event where practical
- legacy TBO grounding compatibility remains available behind the utilisation workflow
- frontend does not directly edit aircraft utilisation outside backend workflow
- no component propagation occurs in the event-architecture-only phase
- no AD/SB/SID recalculation occurs in the event-architecture-only phase
- no scheduled task recalculation occurs in the event-architecture-only phase
- event stream can be used as trigger input by future propagation services

## Final Definition

Aircraft utilisation changes must be captured as immutable backend events.

The event stream records previous values, new values, deltas, source, reason, effective date, actor, and correction linkage. `aircraft.total_time_hours` remains a current snapshot, but the utilisation event stream becomes the authoritative history and future trigger for component life propagation and due-status recalculation.

This phase defines the event architecture only. Downstream propagation and recalculation are explicitly deferred.
