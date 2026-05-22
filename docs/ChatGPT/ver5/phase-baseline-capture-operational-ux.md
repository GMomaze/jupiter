# Phase: Serialized Component Baseline Capture Operational UX

## Purpose

Define an operational UX that lets AMO users capture an aircraft's already-installed serialized component state during onboarding, without confusing that onboarding activity with authoritative maintenance install/remove workflow events.

This UX must preserve:

- explicit maintenance install/remove authority
- active installation architecture
- technical dashboard derivation
- due/compliance derivation from current authoritative state
- lifecycle integrity
- auditability
- installation traceability

This UX must not:

- blur baseline capture with maintenance install/remove
- fabricate maintenance history
- silently mutate aircraft configuration
- create hidden lifecycle mutation
- redesign technical dashboard logic
- redesign install/remove workflow
- bypass operational authority boundaries

## Operational Positioning

Baseline capture is an onboarding-only workflow used to declare the real-world installed serialized component configuration already present on the aircraft at the moment the aircraft is brought into Jupiter operational visibility.

Baseline capture is not a maintenance action.

Baseline capture does not mean:

- the AMO installed the component
- the component was removed and reinstalled
- historical maintenance provenance is complete
- maintenance release evidence exists inside this action

Baseline capture does mean:

- the aircraft is entering Jupiter with an inherited installed state
- the component is considered actively installed from the effective captured baseline point
- the installation record must remain visible, traceable, and explicitly marked as inherited baseline provenance

## 1. Onboarding UX Entry Point

Baseline capture starts from the aircraft UI, inside the aircraft's serialized component onboarding area, not from the standard maintenance install/remove controls.

Recommended entry point:

- aircraft detail screen
- serialized components or installed components section
- dedicated action: `Capture Existing Installed Configuration`

Entry-point rules:

- show this action only in aircraft onboarding/setup context, or within a clearly labeled onboarding subsection
- do not place it beside routine maintenance install/remove buttons with equal visual weight
- do not label it as `Install Component`
- do not reuse maintenance-install modal titles or submit labels

Recommended supporting text at entry point:

`Use this only to capture components already installed on the real aircraft when onboarding into Jupiter. This is not a maintenance installation action.`

## 2. Distinguishing Baseline Capture vs Maintenance Install/Remove

The UX must separate these workflows in language, location, and audit meaning.

### Baseline Capture

Use language such as:

- `Capture Existing Installed Component`
- `Baseline Capture`
- `Inherited Aircraft Configuration`
- `Effective Onboarding State`

Never use:

- `Install`
- `Reinstall`
- `Fit`
- `Replace`

### Maintenance Install/Remove

Maintenance workflow language remains:

- `Install Serialized Component`
- `Remove Serialized Component`
- `Resulting Status`
- `Installed At`
- `Removed At`

Separation requirements:

- baseline capture uses a dedicated form and dedicated explanatory text
- maintenance install/remove actions remain explicit operational authority actions
- baseline capture records must display provenance `BASELINE_CAPTURE`
- maintenance records must display provenance `MAINTENANCE_INSTALL`

## 3. Baseline Onboarding Workflow

### Step 1. Enter onboarding context

User opens the aircraft record and enters the serialized component onboarding area.

UX guidance:

- explain that the user is declaring current inherited installed state
- explain that each record becomes an active installed component record
- explain that later changes must use normal maintenance install/remove workflow

### Step 2. Start baseline capture

User selects `Capture Existing Installed Configuration` or equivalent baseline-specific action.

System shows a baseline-specific form, not the maintenance install form.

### Step 3. Select serialized component

User selects the serialized component that is physically already installed on the aircraft.

The system should only allow eligible serialized components that can become actively installed under existing authority rules.

### Step 4. Define effective baseline state

User captures the effective inherited installation state as-of onboarding by entering:

- effective installed date for baseline visibility
- position if applicable
- inherited TSN/TSO if known
- contextual notes describing inherited or uncertain provenance

### Step 5. Declare uncertainty where needed

If any historical detail is incomplete, the UX must require the user to state that the data is inherited, estimated, or unknown rather than implying certainty.

### Step 6. Review baseline warning

Before submit, show a summary warning that confirms:

- this action captures existing installed state only
- this action is not evidence of a maintenance installation event
- unknown or estimated information will remain visible in audit/history context

### Step 7. Confirm explicit baseline capture

User submits with a baseline-specific confirmation label such as:

- `Capture Baseline Installation`

Never use:

- `Install`
- `Complete Installation`

### Step 8. Post-submit visibility

After success, the component appears as actively installed, but visibly marked as baseline provenance in:

- installed component visibility
- installation history
- operational traceability text
- technical dashboard supporting context where applicable

## 4. Required User Inputs

Required baseline inputs:

- aircraft
- serialized component
- effective installed date for the inherited baseline state

Conditionally required:

- position when the component type is position-sensitive in the existing workflow

Required UX declarations:

- user must understand this is baseline capture, not maintenance install
- user must be able to distinguish known versus uncertain inherited data

Required submit affordances:

- baseline-specific title
- baseline-specific confirmation text
- pre-submit warning/disclaimer

## 5. Optional, Inherited, and Unknown Data Handling

Optional inputs:

- position where not operationally required
- inherited TSN
- inherited TSO
- freeform notes
- inherited status context
- uncertainty notes

Rules for inherited and unknown data:

- do not force users to invent history
- allow empty TSN/TSO where unknown
- allow date to represent effective onboarding baseline point when precise original install date is not available, but label it clearly as baseline-effective context
- require uncertainty notes when material historical precision is missing and the user is entering estimates or partial information

Recommended field language:

- `Inherited TSN at Baseline`
- `Inherited TSO at Baseline`
- `What is known about this inherited installation?`
- `Uncertainty or evidence limitations`

Recommended helper text:

- `Enter the best known inherited values if supported by records. Leave blank if unknown.`
- `Do not estimate unless operationally necessary. If estimated, explain why.`

## 6. Inherited TSN/TSO Entry UX

The UX for inherited TSN/TSO must communicate that these values are inherited operational inputs, not newly created maintenance measurements.

Requirements:

- label TSN/TSO as inherited baseline values
- explain they represent the component state at the captured baseline point
- allow blank values when not available
- if values are estimated, require uncertainty explanation

Recommended control behavior:

- numeric input for TSN
- numeric input for TSO
- adjacent helper text clarifying inherited/estimated/unknown status
- optional checkbox or structured selection for `Exact`, `Estimated`, or `Unknown` if supported later, without changing current architecture

## 7. Uncertainty Handling and Audit Visibility

Uncertainty must be explicit, user-authored, and reviewable later.

Required uncertainty handling:

- provide a dedicated uncertainty notes input
- distinguish ordinary notes from uncertainty/evidence limitation notes
- carry baseline context into the stored explanatory note trail
- never hide uncertainty after capture

Audit visibility requirements:

- the record must visibly indicate baseline provenance
- the record must preserve the explanatory baseline note
- inherited status context and uncertainty notes must remain readable in record detail and history views
- reviewers must be able to see that the state was captured during onboarding rather than produced by maintenance execution

Recommended audit language:

- `Baseline Capture: Existing aircraft configuration captured during onboarding.`
- `Inherited Status Context: ...`
- `Uncertainty Notes: ...`

## 8. Appearance in Installed Component Visibility

In installed component visibility, baseline-captured records should appear as normal active installed records for operational awareness, but with explicit provenance indicators.

Required visibility behavior:

- include the component in active installed visibility
- show provenance badge or label: `Baseline Capture`
- include traceability text such as `Baseline captured effective <date>`
- do not describe the record as a maintenance installation performed by the AMO unless separate evidence exists elsewhere

The installed visibility layer should still support:

- position awareness
- due/compliance visibility
- missing-data visibility
- removal initiation through the normal authoritative removal workflow

## 9. Appearance in Installation History

Installation history must preserve lifecycle truth without fabricating prior events.

Required history behavior:

- create a visible history entry labeled `Baseline Capture`
- show the effective baseline installed date
- show position and inherited TSN/TSO when available
- show uncertainty and inherited context notes where captured
- if later removed, the same lifecycle should close through standard removal flow rather than rewriting baseline provenance

History must not imply:

- a newly performed maintenance install event
- a complete prior maintenance chain
- prior removals or prior installs not actually recorded

## 10. Appearance in Technical Dashboard

The technical dashboard must continue deriving from current authoritative installed state and technical data, not from rewritten history.

Required dashboard behavior:

- baseline-captured active installations participate in current technical visibility the same way as other active installations
- due/compliance derivation continues using current authoritative component/life data
- missing TSN/TSO or inherited uncertainty must surface as unknown or limited-data visibility where appropriate
- provenance may be shown as supporting context, but must not redesign dashboard logic

The technical dashboard must not:

- treat baseline capture as maintenance completion evidence
- suppress missing-data indicators
- infer nonexistent historical maintenance events

## 11. Operational Safety Protections

Required protections:

- baseline capture entry point separated from maintenance install/remove actions
- explicit onboarding-only language
- explicit confirmation warning before submit
- position conflict protection preserved
- serialized component availability checks preserved
- active installation uniqueness preserved
- later state changes must continue through explicit install/remove workflow only

Safety warnings should explain:

- baseline capture declares inherited current state
- it does not replace maintenance records
- it should be used only when onboarding a real aircraft configuration already in place

## 12. Prevention of Accidental Misuse

The UX should reduce accidental misuse through wording, placement, and confirmation.

Required anti-misuse measures:

- separate button from maintenance install controls
- baseline-only modal title and submit action
- warning banner before submit
- explicit statement that future swaps/removals must use normal maintenance workflows
- no silent defaulting to maintenance-install language
- no auto-conversion of baseline capture into a maintenance event

Recommended warning copy:

`This action captures an inherited installed configuration during onboarding. Do not use it for components being installed or removed as part of current maintenance work.`

## 13. Baseline Provenance Visibility

Baseline provenance must remain visible anywhere the installed lifecycle is reviewed.

Required provenance signals:

- installation context value of `BASELINE_CAPTURE`
- visible label in installed component summaries
- visible label in installation history
- traceability wording that references baseline capture
- retained explanatory notes for inherited context and uncertainty

## 14. Verification Requirements

Verification should confirm operational clarity, lifecycle integrity, and audit visibility.

### UX verification

- baseline capture starts from a dedicated onboarding entry point in aircraft UI
- baseline capture language is distinct from maintenance install/remove language
- submit action is baseline-specific
- warnings/disclaimers are visible before confirmation

### Data-behavior verification

- baseline capture creates an active installation record with baseline provenance
- baseline-captured components appear in installed component operational visibility
- baseline-captured components appear in installation history as `Baseline Capture`
- future removal still uses normal authoritative removal flow
- no fabricated prior maintenance events appear

### Technical visibility verification

- technical dashboard includes baseline-captured active installations in current state visibility
- unknown inherited TSN/TSO causes missing-data or uncertainty visibility where applicable
- due/compliance derivation still follows current technical logic

### Safety verification

- users cannot reasonably mistake baseline capture for maintenance install
- baseline capture does not silently change non-target lifecycle state
- authority boundaries between onboarding capture and maintenance workflow remain explicit

## 15. Acceptance Summary

This phase is complete when Jupiter has a clearly defined operational UX in which:

- AMO users can capture already-installed serialized components during onboarding
- the workflow is clearly marked as baseline capture, not maintenance installation
- inherited and unknown data are handled honestly
- uncertainty remains visible and auditable
- active installation architecture remains intact
- technical dashboard behavior remains derived, not redesigned
- future lifecycle actions still require explicit maintenance install/remove workflow
