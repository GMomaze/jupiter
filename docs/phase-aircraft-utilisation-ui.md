# Phase 11 - Aircraft Utilisation UI

## Mode

DEFINE only.

No implementation, code changes, migrations, refactors, automatic workpack creation, automatic grounding, notifications, frontend lifecycle calculations, or frontend due calculations are part of this phase definition.

## Goal

Define the final user-facing aircraft utilisation UI now that the backend foundations exist for:

- utilisation events and aircraft snapshot authority;
- cycle authority;
- installed component tracking baselines;
- backend component life calculation;
- utilisation propagation preview;
- unified due status;
- component limit monitoring;
- AD/SB/SID due recalculation;
- scheduled task due recalculation;
- calendar due monitoring.

The final UI must let an authorised user enter aircraft hours and cycles, preview the effect, confirm through the backend utilisation authority, and understand what changed afterwards.

## Current UI Status

Status: PARTIAL.

Existing implementation:

- `src/views/aircraft/view.ejs`
  - defines `canEditAircraft` from `user.roles` and shows the utilisation form only for `ADMIN`.
  - shows current aircraft hours and cycles.
  - accepts new total hours, new total cycles, effective date, source type, source reference, and reason.
  - provides a preview button, hidden preview panel, affected component table, due placeholder summary, correction warning, and disabled confirm button.
  - requires preview before client-side confirmation by disabling the confirm button until preview has no validation warnings.
- `src/modules/aircraft/aircraft.routes.ts`
  - mounts `POST /aircraft/:id/utilisation/preview` with `requireAuth`, `requireRole('ADMIN')`, and CSRF protection.
  - mounts `POST /aircraft/:id/utilisation` with `requireAuth`, `requireRole('ADMIN')`, and CSRF protection.
- `src/modules/aircraft/aircraft.controller.ts`
  - `previewUtilisation()` calls `UtilisationPropagationPreviewService.preview()`.
  - `updateUtilisation()` calls `UtilisationService.recordUtilisation()`.
- `src/modules/utilisation/utilisation-propagation-preview.service.ts`
  - returns current/proposed hours and cycles, deltas, normal/correction classification, validation warnings, affected component previews, and Phase 5 due placeholders.
- `src/modules/utilisation/utilisation.service.ts`
  - remains the confirmed backend authority for creating utilisation events, updating aircraft snapshot hours/cycles, writing audit records, enforcing correction rules, and running the temporary legacy TBO compatibility check.
- `src/modules/calendar-due/calendar-due-monitor.service.ts`
  - provides backend date/calendar due monitoring entry points, but it is not yet surfaced in the utilisation UI.

Current gaps:

- the due/compliance panel still reflects the Phase 5 placeholder model instead of the completed backend due foundations where safe;
- the form source-type list omits `INITIAL_BASELINE`, which is an approved backend utilisation source type;
- the preview gate is client-side only and does not provide a backend preview token or payload fingerprint;
- after save, the controller flashes a generic success message and does not display a utilisation event summary;
- correction linkage to a prior utilisation event is not exposed;
- final permission boundaries are still role-only and `ADMIN`-only;
- the UI does not yet show calendar due monitor output or mixed-limit due impact from completed backend services.

## Files Inspected

- `src/views/aircraft/view.ejs`
- `src/modules/aircraft/aircraft.routes.ts`
- `src/modules/aircraft/aircraft.controller.ts`
- `src/modules/utilisation/utilisation.service.ts`
- `src/modules/utilisation/utilisation-propagation-preview.service.ts`
- `src/modules/calendar-due/calendar-due-monitor.service.ts`
- `src/modules/aircraft/component-life-calculation.service.ts`
- `src/modules/aircraft/component-limit-monitoring.service.ts`
- `src/modules/compliance/compliance-due-recalculation.service.ts`
- `src/modules/tasks/scheduled-task-due-recalculation.service.ts`
- `src/modules/due-status/due-status.service.ts`
- `src/middleware/rbac.middleware.ts`
- `src/modules/auth/ability.ts`

## Existing Flow

### Preview Path

Current preview path:

1. User enters proposed utilisation on the aircraft view.
2. Browser posts to `POST /aircraft/:id/utilisation/preview`.
3. `AircraftController.previewUtilisation()` calls `UtilisationPropagationPreviewService.preview()`.
4. Preview service reads current aircraft totals, validates the proposal, calculates deltas, classifies normal vs correction, calculates affected component life through backend services, and returns placeholder due/compliance impact.
5. Browser renders the preview and enables confirmation only when validation warnings are absent.

Rules preserved:

- preview must be read-only;
- preview must not create utilisation events;
- preview must not update aircraft totals;
- preview must not write audit records;
- preview must not mutate workpacks or due/compliance rows.

### Confirmation Path

Current confirmation path:

1. User submits the same form to `POST /aircraft/:id/utilisation`.
2. `AircraftController.updateUtilisation()` calls `UtilisationService.recordUtilisation()`.
3. `UtilisationService` validates the payload, creates an immutable utilisation event, updates `aircraft.total_time_hours` and `aircraft.total_time_cycles`, writes audit evidence, and runs temporary legacy TBO compatibility logic.
4. User is redirected back to the aircraft view with a generic flash message.

Final UI rule:

- confirmed saves must continue to call `UtilisationService.recordUtilisation()` only.
- no UI, controller, or aircraft edit path may update aircraft utilisation snapshot fields directly.

## Final Utilisation Update Screen

The final screen may remain a panel on the aircraft view or become a dedicated utilisation screen. In either placement, it must show:

- current aircraft total hours, read-only;
- current aircraft total cycles, read-only;
- proposed new total hours;
- proposed new total cycles;
- calculated hour delta from backend preview;
- calculated cycle delta from backend preview;
- effective date;
- source type;
- source reference;
- reason;
- correction status;
- preview status;
- confirm status.

Source type options must include every approved backend value:

- `MANUAL_ENTRY`
- `JOURNEY_LOG`
- `TECH_LOG`
- `FLIGHT_FOLIO`
- `INITIAL_BASELINE`
- `CORRECTION`
- `IMPORT`

Input rules:

- hours are absolute aircraft total hours, not a browser-derived delta authority;
- cycles are absolute aircraft total cycles, not a browser-derived delta authority;
- hour-only, cycle-only, and combined updates are allowed;
- negative hours are blocked;
- negative cycles are blocked;
- fractional cycles are blocked;
- zero-change confirmation is blocked;
- effective date is required;
- source type is required;
- reason is required;
- source reference is required for corrections and should be encouraged for all non-manual source types.

The UI may display convenience delta values, but the frontend must not become the authority for totals, deltas, life calculations, or due status.

## Preview Behavior

Preview is mandatory before confirmation.

The user must see:

- current aircraft hours and cycles;
- proposed aircraft hours and cycles;
- hour and cycle deltas;
- whether the entry is `NORMAL` or `CORRECTION`;
- validation warnings;
- correction warning where applicable;
- affected installed serialized components;
- current calculated component life;
- projected component life using the proposed aircraft totals;
- delta impact on TSN, TSO, CSN, and CSO where calculable;
- UNKNOWN baseline warnings;
- due/compliance impact where backend services can safely provide it;
- explicit placeholders where a domain cannot yet project against proposed utilisation.

Affected component preview must show:

- component identity;
- installed position;
- tracking basis;
- current TSN/TSO/CSN/CSO calculation result;
- projected TSN/TSO/CSN/CSO calculation result;
- delta impact;
- source baseline;
- UNKNOWN reason where not calculable.

Due/compliance preview should use backend services only where safe:

- `ComponentLimitMonitoringService` for component limit visibility;
- `ComplianceDueRecalculationService` for AD/SB/SID due visibility;
- `ScheduledTaskDueRecalculationService` for scheduled task due visibility;
- `CalendarDueMonitorService` for current date/calendar due visibility;
- `DueStatusService` as the shared due-state authority.

Where a due domain cannot project against proposed aircraft totals yet, the UI must show a clear backend-provided placeholder such as `NOT_CALCULATED` rather than inventing a frontend result.

Preview freshness rule:

- confirmation should only be enabled for the latest preview of the unchanged form values.
- a future implementation should use a backend preview fingerprint or token to reduce stale-preview risk.
- confirmation must still revalidate through `UtilisationService` because preview is advisory, not a lock.

## Correction UX

If proposed hours or cycles decrease:

- show a prominent correction warning before preview and in preview output;
- require reason;
- require source reference;
- mark the entry as correction in preview;
- explain that downstream component life and due values may reduce or become UNKNOWN;
- allow the backend to record the event as `CORRECTION`;
- where practical, support selecting or linking a prior utilisation event as `correction_of_event_id`.

Correction confirmation must not rely only on the browser warning. The backend service must remain responsible for enforcing correction requirements.

## Confirmation Behavior

Confirm must:

- call `UtilisationService.recordUtilisation()` only;
- create a utilisation event;
- update aircraft snapshot hours and cycles;
- write audit evidence;
- preserve unrelated aircraft edit behavior;
- preserve the existing temporary legacy TBO compatibility behavior behind the utilisation authority;
- revalidate all submitted values;
- reject stale or invalid values;
- not bypass preview rules.

Confirm must not:

- update aircraft hours/cycles directly in the controller;
- create component propagation records;
- mutate component life states as a side effect of the UI;
- calculate lifecycle truth in the frontend;
- calculate due truth in the frontend;
- create or refresh workpacks;
- introduce new automatic grounding behavior.

Existing legacy TBO compatibility may still run inside the backend utilisation authority until a later approved phase replaces it. Phase 11 UI must not add a new grounding workflow.

## After-Update Summary

After a successful save, the user should see a backend-derived summary containing:

- utilisation event id/reference;
- aircraft registration;
- previous total hours;
- new total hours;
- delta hours;
- previous total cycles;
- new total cycles;
- delta cycles;
- effective date;
- source type;
- source reference;
- reason;
- created by;
- created at;
- correction flag;
- correction-of event reference where applicable;
- affected component preview summary from the confirmed preview where available;
- due/compliance summary where backend results were available;
- UNKNOWN warning count.

The summary must not imply that workpacks, notifications, or due-status snapshots were automatically updated unless a later phase explicitly implements those side effects.

## Permission Model

Current implementation:

- route protection is `requireAuth` + `requireRole('ADMIN')` for both preview and confirmation;
- aircraft view renders the utilisation form only when the user has an `ADMIN` role;
- `rbac.middleware.ts` supports role and permission-style middleware, but the current utilisation routes use role-only protection.

Recommended final boundary:

- keep `ADMIN`-only until explicit utilisation permissions are introduced;
- define a dedicated permission for normal utilisation recording, for example `AIRCRAFT_UTILISATION_RECORD`;
- define a stricter permission for decreases/corrections, for example `AIRCRAFT_UTILISATION_CORRECT`;
- allow preview only to users who can record or correct utilisation, unless a read-only preview permission is deliberately introduced;
- default normal recording to Admin/QA-level operational control;
- allow Planner/Engineer access only through explicit granted permission, not by broadening the route implicitly;
- correction decreases should default to Admin/QA approval because they rewrite the operational meter trail through an auditable correction event.

UI visibility must match backend route authority. The browser must not display an enabled utilisation form to a role that the backend route will reject.

## Required Final UI Behavior

Minimum final behavior:

- show current hours/cycles;
- accept proposed hours/cycles;
- accept effective date, source type, source reference, and reason;
- support all approved source types;
- request backend preview;
- display affected components and projected life;
- display UNKNOWN and missing-baseline warnings;
- display due/compliance results only from backend services;
- block confirmation until preview is complete and current;
- submit confirmation through the existing utilisation authority;
- show a useful after-update event summary.

Quality requirements:

- no silent utilisation changes through generic aircraft edit;
- no frontend life or due calculations;
- no hidden correction decreases;
- no false precision for unsupported projection domains;
- no automatic workpack, notification, or grounding side effects from the UI.

## Implementation Scope For Future Phase 11

Future IMPLEMENT should be limited to:

- refine the existing aircraft utilisation panel or move it to a dedicated screen;
- add `INITIAL_BASELINE` to the source-type UI;
- strengthen preview freshness handling;
- surface backend due/compliance/calendar results where safe;
- keep unsupported projected due domains clearly marked as not calculated;
- add after-update summary rendering;
- align UI visibility with final route permissions;
- add focused tests for preview-required confirmation, correction UX, source-type options, permission visibility, and after-save summary.

Future IMPLEMENT must not add:

- migrations;
- new utilisation authority;
- frontend lifecycle calculation;
- frontend due calculation;
- automatic workpack creation or refresh;
- notification engine;
- automatic grounding.

## Risks

- A client-only preview gate can be bypassed; confirmation must always revalidate server-side.
- Aircraft totals, component installations, or compliance state can change between preview and confirmation.
- The current form omits `INITIAL_BASELINE`, creating a mismatch with backend-approved source types.
- Expanding access from Admin-only to Planner/Engineer without explicit permissions would weaken utilisation authority.
- Due/compliance services may need proposed-snapshot support before their results can be shown as projected impact.
- Calendar due results depend on date-only semantics and should not be recomputed in browser time.
- Existing legacy TBO compatibility can surprise users if the UI does not distinguish compatibility behavior from new Phase 11 behavior.
- Showing too many due placeholders can look like calculation failure unless the UI labels phase boundaries clearly.

## Boundary

Phase 11 DEFINE does not implement:

- automatic workpack creation;
- automatic workpack refresh;
- automatic grounding;
- notifications;
- emails;
- frontend lifecycle calculations;
- frontend due calculations;
- scheduler jobs;
- migrations;
- new persistence.

The confirmed save path remains `UtilisationService.recordUtilisation()`.
