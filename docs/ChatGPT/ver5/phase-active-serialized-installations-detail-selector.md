# Phase: Active Serialized Installations Detail Selector

## Purpose

Define a UX refinement for the `Active Serialized Installations` area so users can focus on one installed serialized component at a time without losing fleet-on-aircraft summary awareness.

This refinement must preserve:

- active installation architecture
- baseline vs authoritative install distinction
- install/remove workflow authority boundaries
- baseline provenance visibility
- uncertainty visibility
- maintenance-event context visibility
- component document and evidence visibility
- operational readiness advisory behavior
- technical dashboard boundaries
- due/compliance derivation boundaries

This refinement must not:

- hide safety warnings globally
- remove active installed component visibility
- mutate installation state
- change install/remove behavior
- create new authority logic
- redesign backend services

## Operational Intent

The current `Active Serialized Installations` area is operationally rich, but it becomes too long when many serialized components are installed on one aircraft.

The refinement is not to remove detail.

The refinement is to reorganize detail so:

- aircraft-wide summary counts remain visible
- aircraft-wide warning visibility remains visible
- one selected installed component becomes the active detail focus
- operational review remains legible
- removal authority remains explicit and local to the selected installation only

## 1. Top-Level UX Shape

Inside the existing `Active Serialized Installations` section:

- keep the current summary cards visible above
- keep the current occupied/recent position visibility above
- add a selector control at the top of the installation-detail area
- show only one active installation detail card at a time below the selector

The selector becomes a detail navigator, not a data filter for the aircraft-wide summary.

## 2. Selector Placement

Place the selector at the top of the `Active Serialized Installations` subsection, directly above the currently expanded installation detail area.

Recommended layout:

- subsection title
- short helper text
- selector label and dropdown
- optional all-installation warning strip or compact badges
- selected installation detail panel

The selector should appear only when there is at least one active serialized installation.

If there are no active serialized installations:

- keep the existing empty-state behavior
- do not show the selector

## 3. Selector Labeling

The dropdown label must be operationally meaningful and easy to scan during maintenance review.

Recommended selector label:

`Select Active Serialized Installation`

Recommended option format:

- asset type code
- manufacturer/model
- serial number
- position if present

Example option pattern:

`NAV | Garmin GNS-430 | S/N 12345 | POS NAV-1`

If position is missing:

- still show the option
- use an explicit fallback such as `POS Unspecified`

If manufacturer is unavailable:

- use `Unknown Manufacturer`

If model is unavailable:

- use `Unknown Model`

## 4. Default State

Two acceptable default patterns are allowed:

### Option A. First-item default

- automatically select the first active installation
- immediately show its detail panel

### Option B. Explicit prompt

- show a placeholder such as `Select an installed component`
- no detail panel is shown until the user selects one

Recommended choice:

- default to the first active installation

Reason:

- preserves immediate operational visibility
- reduces empty-state friction
- keeps the section useful on first load

## 5. Detail Visibility Behavior

Only the selected component detail should be expanded and shown in full.

This single selected detail panel must continue to show all currently available detail already present for that installation, including:

- provenance label
- baseline vs authoritative distinction
- installed date
- position
- history count
- supporting document counts
- install TSN
- install TSO
- operational readiness advisory
- evidence readiness advisory
- uncertainty and missing-data badges
- evidence visibility badges
- operational warnings
- audit explainability notes
- operational traceability
- maintenance context visibility
- component document visibility
- document relationship visibility
- evidence explainability
- installation history
- removal workflow if available

No selected-installation data is removed.

It is only reorganized into a single-focus detail view.

## 6. Aircraft-Wide Summary and Warning Visibility

The user must still be able to understand the aircraft-wide installed serialized state without cycling through every detail card.

Therefore the following must remain visible outside the selector-controlled detail panel:

- summary count cards
- occupied position summary
- recent position history
- active installation count

Additionally, the UX should preserve awareness that warnings may exist across more than one installation.

Recommended approach:

- retain aircraft-wide summary cards as they are
- add a compact summary strip near the selector showing installation-level warning state per option if feasible
- if not feasible in this phase, at minimum ensure the selector option text or adjacent badges can indicate that some items require operational review

Examples of acceptable compact indicators:

- `Review Recommended`
- `Visibility Limited`
- `Baseline`
- `Authoritative`

This must not replace the detailed warnings inside the selected panel.

## 7. Removal Workflow Boundary

Removal workflow must remain available only for the selected component, if currently available.

Rules:

- only the selected installation may expose its remove form
- removal remains an explicit authoritative workflow action
- baseline provenance remains historical/visible but does not gain new authority behavior
- the selector must not create batch-remove behavior
- the selector must not imply multi-select removal authority

## 8. Provenance and Authority Preservation

The selector must not flatten or blur provenance differences.

For the selected installation, the UI must continue to show:

- `Baseline Capture` when installation provenance is inherited onboarding state
- `Authoritative Install` when installation provenance comes from explicit maintenance install workflow

This distinction remains essential because:

- baseline visibility is not maintenance evidence
- maintenance install/remove authority remains explicit
- operational review must not confuse inherited state with performed work

## 9. Safety and Warning Behavior

Safety warnings must not be hidden globally by the selector.

Required rule:

- selector narrows full-detail focus
- selector does not erase aircraft-wide risk awareness

Therefore:

- aircraft summary warnings remain visible at summary level
- selected installation warnings remain fully visible in detail
- no warning text is removed from the selected detail panel

## 10. Interaction Model

Recommended interaction:

- dropdown change swaps the selected installation detail panel in place
- no lifecycle mutation occurs on selection
- no save action is triggered by selection
- no server-side authority action occurs on selection

Acceptable implementation patterns:

- server-rendered selector with client-side show/hide
- server-rendered selector with HTMX partial swap
- server-rendered selector with small progressive enhancement script

Preferred implementation principle:

- minimal-risk UI reorganization using already available rendered installation data where possible

## 11. Data Model and Service Boundaries

This phase does not require backend redesign.

The selector should consume the same active serialized installation data already being rendered for the current section.

Do not:

- redesign installation queries
- invent new backend authority rules
- reclassify baseline capture
- reinterpret document visibility as maintenance proof
- derive new due/compliance behavior from selector choice

## 12. Empty and Edge States

### No active serialized installations

- show existing empty state
- no selector

### One active serialized installation

- selector may still be shown for consistency, but it is optional
- simplest acceptable UX is to show the single detail panel directly

### Missing position

- option label must still remain meaningful
- use `POS Unspecified`

### Many installations with mixed warning states

- summary visibility must remain above
- selected-item detail remains single-focus
- compact per-item indicator is preferred if feasible

## 13. Recommended Minimal UX

The safest implementation for this phase is:

1. Keep all current summary cards and aircraft-wide summary visibility unchanged.
2. Replace the stacked full-detail list with:
   - one dropdown selector
   - one selected-installation detail panel
3. Default to the first active installation.
4. Preserve the current detail content structure inside that one panel.
5. Preserve the current removal form inside that one selected panel only.

This gives immediate length reduction without altering operational semantics.

## 14. Acceptance Definition

This phase is successful when:

- the aircraft-wide summary remains visible
- the user can select one active serialized installation from a dropdown
- the dropdown options are operationally meaningful
- only the selected installation detail is fully shown
- removal remains available only on the selected installation
- baseline provenance remains visible
- uncertainty and warning visibility remain visible
- document/evidence visibility remains visible
- no installation data is removed
- no authority behavior changes

## Minimal Implementation Target

Implement a selector-driven single-detail view within the existing `Active Serialized Installations` section, while preserving:

- all aircraft-wide summary visibility
- all selected-installation operational detail
- provenance distinction
- warning visibility
- removal authority boundaries
- existing backend behavior
