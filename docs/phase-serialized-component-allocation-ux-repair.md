# Phase - Serialized Component Allocation UX Repair

## Mode

DEFINE only.

No implementation, migrations, production code changes, refactors, lifecycle authority changes, utilisation changes, due-tracking changes, or workpack changes are part of this phase.

## Current Status

Status: DEFINED FOR FUTURE IMPLEMENT.

Current findings:

- The aircraft UI can show Baseline Capture and Install Serialized Component as parallel full forms.
- Both forms select a serialized component and create an active aircraft installation record, so users can reasonably confuse the two paths.
- Baseline Capture is intended only for inherited/onboarding state.
- Install Serialized Component is intended for a current authoritative maintenance installation.
- Installed Components visibility includes serialized installation data and may also show legacy `aircraft_components` records.
- Legacy `aircraft_components` must not be presented as the primary serialized installed-component status.
- A serialized component with an active `aircraft_component_installations` row where `removed_at IS NULL` must be unavailable for any new allocation workflow.
- Backend duplicate guards remain required even when dropdown filtering is correct.

## Goal

Define a clearer user workflow for serialized component allocation so users choose intent first, see only the relevant form, and understand whether they are capturing inherited installed state or recording a current maintenance installation.

The improved workflow must make active serialized installation visibility primary after either path and avoid conflicting legacy empty states.

## User Workflow

1. User opens the aircraft Installed Components area.
2. User sees one primary action:

   ```text
   Allocate Serialized Component to Aircraft
   ```

3. User chooses that action.
4. System asks:

   ```text
   Is this component already installed on the aircraft?
   ```

5. User selects one intent:

   ```text
   Yes - Capture Existing Installed Component
   No - Install / Allocate Component Now
   ```

6. System shows only the selected workflow form.
7. User completes the selected form and submits.
8. System validates availability and duplicate protection.
9. On success, system redirects back to Installed Components.
10. The active serialized installation appears immediately in the primary Installed Components summary.
11. The installation source is visible as either `BASELINE_CAPTURE` or `MAINTENANCE_INSTALL`.

## Single Entry Point

Use one primary user-facing action:

```text
Allocate Serialized Component to Aircraft
```

This action should be visually dominant in the Installed Components area. Baseline Capture and current install should not appear as two equal full forms by default.

## Intent Choice

Before showing detailed fields, show a short intent selector:

```text
Is this component already installed on the aircraft?
```

Options:

- `Yes - Capture Existing Installed Component`
- `No - Install / Allocate Component Now`

The choice determines which form is displayed. The unselected form should remain hidden.

## Baseline Capture Path

Purpose:

- inherited installed component state;
- onboarding an aircraft configuration already true in the real world;
- preserving provenance without fabricating a maintenance installation event.

Required label:

```text
Onboarding only - existing installed component
```

Plain-language action text:

```text
Already installed / onboarding capture
```

Behavior:

- writes an active serialized installation with source `BASELINE_CAPTURE`;
- records known inherited baselines and uncertainty/evidence notes;
- must not look like a normal maintenance installation;
- must remain visually secondary to the normal allocation action;
- should explain that future removal/unallocation uses the normal explicit workflow.

Recommended helper copy:

```text
Use this only when the component is already installed on the real aircraft and Jupiter is capturing inherited onboarding state.
```

## Install / Allocate Path

Purpose:

- current authoritative maintenance installation;
- normal allocation of an available serialized component to an aircraft.

Required label:

```text
Current maintenance installation
```

Plain-language action text:

```text
Install now
```

Primary submit label:

```text
Install / Allocate to Aircraft
```

Behavior:

- writes an active serialized installation with source `MAINTENANCE_INSTALL`;
- records install date, position, tracking basis, baselines, and notes;
- updates serialized component status according to existing lifecycle authority;
- must not change utilisation, due tracking, workpacks, compliance, or aircraft lifecycle state.

Recommended helper copy:

```text
Use this when the component is being installed or allocated to this aircraft through the current maintenance workflow.
```

## Active Installed Visibility

After either path succeeds:

- the component appears in the primary Installed Components summary;
- active serialized installation count reflects the new row;
- selected component details show serial number, model, position, installed date, baselines, and provenance;
- source/provenance is visible as `BASELINE_CAPTURE` or `MAINTENANCE_INSTALL`;
- removal action is available only through the explicit remove/unallocate workflow.

Required empty state:

```text
No active serialized installations are currently visible on this aircraft.
```

This message may appear only when active serialized installations are actually empty.

## Legacy Component Records

Legacy `aircraft_components` records may remain visible only as secondary historical context.

Required label if shown:

```text
Legacy component records
```

Rules:

- legacy records must not be the primary installed serialized component status;
- legacy records must not show a conflicting `No components installed` empty state;
- if no legacy records exist, do not show a legacy empty state;
- do not mix legacy count with active serialized installation count.

## Availability Rules

Both selected workflow forms must use the same availability rule:

- only serialized components eligible for aircraft installation are selectable;
- component must be in an allowed available state under existing lifecycle rules;
- component must not have an active `aircraft_component_installations` row where `removed_at IS NULL`;
- actively installed components must disappear from both allocation dropdowns immediately after save.

Backend guard remains required:

- install/allocation service must still reject duplicate active installation attempts;
- baseline capture service must still reject duplicate active installation attempts;
- dropdown filtering is a UX aid, not the authority boundary.

## UX Simplification

Avoid showing Baseline Capture and Install / Allocate as two side-by-side full forms.

Recommended interaction:

1. Show Installed Components summary.
2. Show primary `Allocate Serialized Component to Aircraft` action.
3. Show intent choice.
4. Show exactly one form based on intent.
5. Allow user to change intent before submit.
6. After submit, return to Installed Components with the new active serialized installation visible.

The selected workflow should be obvious from headings, helper text, and submit button.

## Labels

Preferred plain-language labels:

- `Allocate Serialized Component to Aircraft`
- `Is this component already installed on the aircraft?`
- `Already installed / onboarding capture`
- `Install now`
- `Onboarding only - existing installed component`
- `Current maintenance installation`
- `Install / Allocate to Aircraft`
- `Remove / Unallocate`
- `Legacy component records`

Avoid ambiguous labels when shown alone:

- `Baseline Capture` without onboarding context;
- `Install Serialized Component` without allocation context;
- `No components installed` when the panel is about serialized installations.

## Route And Service Intent

This phase does not require new routes by definition, but future implementation may either:

- keep existing POST endpoints and change only the UI flow; or
- add a lightweight GET/UI route or modal state for the guided intent choice.

Existing persistence authority should remain:

- baseline path calls the existing baseline capture service;
- install path calls the existing authoritative install service;
- remove/unallocate path calls the existing removal service.

## Error Handling

Validation or duplicate errors should return users to the selected workflow with:

- selected intent preserved;
- submitted values preserved where safe;
- clear error text near the form;
- no switch back to the other workflow unless the user changes intent.

Recommended duplicate message:

```text
This serialized component is already actively allocated to an aircraft.
```

## Boundaries

This phase must not:

- change component lifecycle authority;
- change aircraft lifecycle authority;
- change utilisation event logic;
- change due tracking or compliance calculations;
- change workpacks;
- change database schema;
- create migrations;
- infer installs from frontend state;
- remove backend duplicate protection;
- alter historical installation records.

## Risks

- Keeping both workflows visible as equal forms encourages accidental baseline captures.
- Relying only on `serialized_components.status` can leave stale active-install records selectable.
- Hiding legacy records entirely could remove useful historical context, but showing their empty state can mislead users.
- Copy must be explicit enough for onboarding users without making normal maintenance allocation feel secondary.

## Acceptance Criteria For Future Implement

- Installed Components shows one primary `Allocate Serialized Component to Aircraft` action.
- Intent choice appears before detailed forms.
- Only the selected workflow form is visible.
- Baseline form is clearly marked onboarding-only.
- Install form is clearly marked current maintenance installation.
- Both paths create active serialized installation visibility in the primary summary.
- Active installation provenance shows `BASELINE_CAPTURE` or `MAINTENANCE_INSTALL`.
- No conflicting legacy `No components installed` message appears.
- Actively installed serialized components are excluded from all allocation dropdowns.
- Backend duplicate install protection remains tested.
- No migrations or unrelated module changes are introduced.
