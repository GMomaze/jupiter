# Phase: Aircraft Cycles Authority

## Mode

DEFINE ONLY.

No implementation. No migrations. No code changes. No refactoring.

## Goal

Define aircraft cycle authority now that Phase 1 utilisation event authority exists.

Aircraft cycles must become a first-class aircraft utilisation value governed by the same backend event authority as aircraft hours.

This phase defines aircraft cycle authority only. It does not implement component propagation, AD/SB/SID due recalculation, scheduled task due recalculation, preview UI, or due-status engines.

## Current Implementation Status

Status: PARTIAL.

Existing storage:

- `aircraft.total_time_cycles` exists.
- `Aircraft.total_time_cycles` exists in the Sequelize model.
- The original aircraft table migration defines `total_time_cycles` as an integer with default `0`.
- Phase 1 `utilisation_events` includes previous/new/delta cycle fields.
- `UtilisationService` currently reads, validates, records, and updates aircraft cycle snapshots.
- Focused Phase 1 tests cover cycle increase, negative cycle rejection, and correction events involving cycles.

Existing backend behavior after Phase 1:

- `AircraftService.create()` initializes `total_time_cycles` to `0`.
- If a create flow supplies initial cycles, `AircraftService.create()` routes them through `UtilisationService` as an `INITIAL_BASELINE` utilisation event.
- `AircraftService.updateDetails()` includes cycle fields in its loaded/editable attributes only to detect bypass attempts.
- If generic aircraft detail editing submits changed cycle values, `AircraftService.updateDetails()` blocks the change with `UTILISATION_CHANGE_REQUIRES_UTILISATION_SERVICE`.
- `UtilisationService.recordUtilisation()` is the current backend mutation path for `aircraft.total_time_cycles`.

Existing UI behavior:

- Aircraft create form displays and submits `total_time_hours`.
- Aircraft create form does not currently show a cycle input.
- Aircraft detail view displays current hours but does not display current cycles in the primary aircraft summary.
- Aircraft edit form displays and submits `total_time_hours`.
- Aircraft edit form does not currently show a cycle input.
- Workpack printable/reporting code reads `aircraft.total_time_cycles` for document output.

Current conclusion:

Aircraft cycles are structurally present and backend-governed by Phase 1 service authority, but cycle UX and operational entry workflows are not complete.

## Files Inspected

- `migrations/050_create_aircraft_table.ts`
- `migrations/564_create_utilisation_events.ts`
- `src/models/core/Aircraft.ts`
- `src/models/UtilisationEvent.ts`
- `src/modules/aircraft/aircraft.service.ts`
- `src/modules/aircraft/aircraft.controller.ts`
- `src/modules/utilisation/utilisation.service.ts`
- `src/modules/utilisation/utilisation.service.test.ts`
- `src/views/aircraft/create.ejs`
- `src/views/aircraft/view.ejs`
- `src/views/aircraft/partials/view-overview-panel.ejs`
- `src/views/partials/install_modal.ejs`
- `src/modules/workpacks/workpack.controller.ts`
- `src/modules/workpacks/services/printable-workpack.service.ts`
- `src/modules/workpacks/services/printable-workpack-pdf.service.ts`
- `docs/phase-utilisation-event-architecture.md`
- `docs/phase-aircraft-utilisation-and-due-tracking-master-plan.md`

## Authority Decision

`aircraft.total_time_cycles` is the current aircraft cycle snapshot.

`utilisation_events` is the authoritative history explaining why the cycle snapshot changed.

`UtilisationService` is the only approved backend path for accepted changes to:

- `aircraft.total_time_hours`
- `aircraft.total_time_cycles`

No controller, generic aircraft edit workflow, frontend form, SQL view, script, inventory workflow, workpack workflow, compliance workflow, or direct service helper may update `aircraft.total_time_cycles` independently.

Generic aircraft edit must not silently mutate cycles. If a generic aircraft detail form submits changed cycle values, the backend must reject the change or route it through `UtilisationService` only if all utilisation event requirements are satisfied.

Preferred design:

- Aircraft cycle changes belong on a dedicated utilisation update workflow.
- Generic aircraft edit should display cycles as read-only or omit cycle editing entirely.
- Generic aircraft edit should preserve all unrelated aircraft metadata behavior.

## Source Rules

Aircraft cycles use the same utilisation source types as aircraft hours:

- `MANUAL_ENTRY`
- `JOURNEY_LOG`
- `TECH_LOG`
- `FLIGHT_FOLIO`
- `INITIAL_BASELINE`
- `CORRECTION`
- `IMPORT`

Source rules:

- `INITIAL_BASELINE` establishes known aircraft cycle state at onboarding or aircraft creation.
- `MANUAL_ENTRY` is a controlled user-entered update.
- `JOURNEY_LOG`, `TECH_LOG`, and `FLIGHT_FOLIO` represent operational flight or maintenance records.
- `IMPORT` represents imported cycle data.
- `CORRECTION` represents an explicit correction to prior cycle state.

Every accepted cycle change must create a utilisation event containing:

- previous cycle snapshot
- new cycle snapshot
- backend-calculated cycle delta
- source type
- source reference where required
- effective date
- reason
- actor where user context exists
- correction linkage where practical
- metadata where useful

## Correction Rules

Increasing cycles is normal utilisation when source, reason, and effective date requirements are satisfied.

Decreasing cycles is a correction and requires:

- reason
- source reference
- effective date
- prior event link where practical
- audit evidence

Correction behavior:

- A cycle decrease must create a new utilisation event.
- Historical utilisation events must not be edited to change prior values.
- The correction event must preserve previous/new/delta cycle values.
- The correction event should use source type `CORRECTION`, unless a later approved import correction workflow defines a stricter controlled mapping.
- The aircraft cycle snapshot may move down only through the accepted correction event.

## Validation Rules

Cycle validation:

- Total cycles cannot be negative.
- Cycle values must be integers.
- Cycle deltas must be integers.
- Decimal cycles are not allowed unless a later approved business rule explicitly introduces fractional cycle handling.
- Frontend-submitted deltas are not authoritative.
- Backend calculates `delta_cycles` as `new_total_time_cycles - previous_total_time_cycles`.

Combined utilisation events:

- Hours and cycles can be updated together in one utilisation event.
- A single event must preserve both hour and cycle previous/new/delta values.
- If either hours or cycles decrease, the event is correction-classified.

Zero-change events:

- Zero-change utilisation events should be blocked by default.
- A zero-change event may be allowed only if a later approved requirement defines a specific evidence-only or metadata-only utilisation event type.
- If allowed later, zero-change events must still require source, reason, effective date, actor where available, and audit evidence.

## UI Requirements

This phase defines UI behavior only. It does not implement UI.

Required future UI behavior:

- A dedicated aircraft utilisation update screen should allow hours and/or cycles.
- The screen should display current aircraft hours and current aircraft cycles.
- Users should be able to submit new hours, new cycles, or both.
- The backend must calculate deltas.
- The UI must show correction warnings when submitted hours or cycles decrease.
- Reason, source type, source reference where required, and effective date are required for accepted utilisation changes.
- The UI must not calculate authoritative lifecycle or due results.
- The generic aircraft edit screen must not silently change cycles.
- Generic aircraft edit should either omit cycle input, render it read-only, or route to the dedicated utilisation workflow.

## Audit And Explainability

Every accepted aircraft cycle change must be explainable from `utilisation_events`.

Cycle event history must show:

- aircraft id
- previous total cycles
- new total cycles
- delta cycles
- source type
- source reference
- effective date
- reason
- created by
- created at
- correction link where applicable
- metadata where applicable

Audit requirements:

- Utilisation event creation must be audited through existing audit conventions.
- Aircraft snapshot updates must be traceable back to the utilisation event.
- Correction events must produce audit evidence and preserve correction linkage where practical.

Future cycle-based logic:

- Later component-cycle propagation must reference a specific utilisation event.
- Later cycle-based AD/SB/SID due recalculation must reference a specific utilisation event.
- Later scheduled task cycle due recalculation must reference a specific utilisation event.
- Later reports must explain cycle due status from backend records, not frontend calculations.

## Boundary

This phase does not define or implement component propagation.

This phase does not define or implement AD due recalculation.

This phase does not define or implement SB due recalculation.

This phase does not define or implement SID due recalculation.

This phase does not define or implement scheduled task due recalculation.

This phase does not define or implement a due-status engine.

This phase does not define or implement component TBO/retirement cycle monitoring.

Those capabilities remain later phases in the Aircraft Utilisation and Due Tracking Master Plan.

## Gaps

Confirmed gaps:

- Aircraft create UI does not expose cycle entry.
- Aircraft detail summary does not prominently display current cycles.
- Aircraft edit UI does not expose or protect cycles at the UI level.
- There is no dedicated aircraft utilisation update screen.
- There is no utilisation history UI.
- Zero-change event blocking must be confirmed or added during Phase 2 implementation.
- User-facing cycle correction warnings do not exist yet.
- No component cycle propagation exists.
- No cycle-based due recalculation exists.

## Required Phase 2 Implementation Scope

Phase 2 implementation should be limited to aircraft cycle authority maturity.

Allowed implementation scope:

- Confirm and harden `UtilisationService` cycle validation.
- Ensure zero-change utilisation events are blocked unless explicitly justified.
- Add or refine backend tests for cycle-only, hour-only, combined, correction, and invalid cycle cases.
- Add dedicated utilisation update route or backend endpoint only if approved by the Phase 2 implementation plan.
- Make generic aircraft edit UI unable to submit silent cycle changes.
- Add current cycle display where operationally appropriate.
- Preserve all unrelated aircraft edit behavior.

Explicitly out of scope:

- Component propagation.
- Serialized component life mutation from aircraft cycles.
- AD/SB/SID due recalculation.
- Scheduled task due recalculation.
- Workpack attachment changes.
- Due-status engine creation.
- Preview engine creation unless separately approved.

## Risks

- Existing aircraft views still emphasize hours, so operators may not see cycle state without a UI maturity step.
- `total_time_cycles` is integer-only; any future fractional-cycle requirement would require explicit business approval and schema/service review.
- Generic aircraft edit currently passes cycle fields only if present in the submitted body; UI cleanup should ensure users cannot attempt silent utilisation edits there.
- Later due and propagation phases must not infer cycle authority from frontend display values; they must reference utilisation events.
- Existing printable/workpack document output already reads `total_time_cycles`; until operational cycle capture UI exists, those outputs may show default or incomplete cycle values.

## Phase 2 Definition Summary

Aircraft cycles are a first-class utilisation value.

`aircraft.total_time_cycles` is the current snapshot.

`utilisation_events` is the authoritative cycle history.

`UtilisationService` is the only approved backend mutation authority for aircraft cycles.

Cycle increases are normal utilisation.

Cycle decreases are corrections requiring reason, source reference, effective date, prior event linkage where practical, and audit evidence.

Cycle values and deltas are integer-only under current rules.

Component propagation and due recalculation remain deferred to later phases.
