# Phase 11.5 - Recurring Snag Detection

## Status

DEFINE ONLY

This phase defines how recurring snag detection is interpreted within Jupiter.

This phase does not implement code, change schema, alter lifecycle behavior, or modify the locked behavior of Phase 10.12 or Phase 11.1 through Phase 11.4.

## Purpose

Recurring snag detection exists to identify repeated defect patterns on the same aircraft so users can see that a snag may represent a repeated operational issue rather than an isolated event.

This phase defines the recurrence threshold, scope, grouping basis, output, UI expectation, and audit interpretation.

## Recurrence Rule

A snag is considered recurring when:

`occurrence_count >= 2`

This is the locked recurrence threshold for Phase 11.5.

Any occurrence count below `2` is not considered recurring.

## Scope

Recurring snag detection is calculated:

- across the same aircraft
- from historical snag records
- not only from the current workpack

Interpretation:

- recurrence must consider snag history for the aircraft as a whole
- recurrence is not limited to the currently open workpack
- recurrence may include snag records created in previous workpacks or other historical defect contexts for that same aircraft

## Historical Basis

Recurring snag detection must use historical snag data as its source.

This means recurrence is based on previously recorded snag events, not on a manually flagged static field.

The system evaluates existing snag history and derives recurrence from that history at the time of inspection or display.

## Grouping Logic

Recurring snag detection must group snag records by defect similarity.

The grouping basis is:

- same defect text
- or normalized defect pattern

Normalization may be used to identify equivalent wording patterns that represent the same practical defect.

Examples of normalization intent include:

- punctuation-insensitive matching
- spacing normalization
- repeated wording cleanup
- directional wording normalization where appropriate

This phase does not lock a specific normalization algorithm. It locks the grouping intent.

## Optional Component Grouping

If `component_id` is present, grouping may additionally consider component context.

That means:

- recurrence may be grouped more precisely by `component_id`
- component-aware grouping is optional refinement, not a mandatory replacement for text or normalized-pattern grouping

Interpretation:

- where the same defect pattern repeatedly occurs on the same component, the system may treat that as a more precise recurrence signal
- absence of `component_id` must not prevent recurrence detection

## Output

Recurring snag detection must produce:

- recurrence count
- recurring indication

The recurring indication should be represented as:

`recurring snag`

At minimum, the user-facing result must tell the user:

- that the snag is recurring
- how many matching occurrences have been detected

## Informational-Only Behavior

Recurring snag detection is informational only.

It must not:

- auto-create tasks
- auto-change lifecycle
- auto-block workpack

This means:

- recurring detection cannot automatically create maintenance tasks
- recurring detection cannot move a snag, task, or workpack into another lifecycle state
- recurring detection cannot by itself block certification, close, or execution flow

Any future operational action based on recurrence must be a separate explicit workflow.

## UI Expectation

Recurring snag indication must be visible in execution where relevant.

Required UI expectations:

- recurring indicator visible in execution
- recurrence count displayed

Example display:

`5 occurrences`

The UI may present this as a badge, label, panel, or advisory block, but the meaning must remain clear:

- this snag pattern has occurred before on the same aircraft
- the count shown is historical occurrence count

## Non-Blocking UI Meaning

The recurring indicator is advisory only.

It must not visually imply that:

- the task is completed
- the snag is resolved
- the workpack is certified
- the workpack is blocked solely because recurrence exists

The UI must communicate recurrence as diagnostic context, not as a lifecycle state.

## Audit and Data Interpretation

Recurring status is derived from historical data.

It is not stored as fixed state.

This means:

- the system derives recurrence from existing snag records
- recurrence output may change as history changes
- recurrence is not treated as a permanent standalone lifecycle field

The auditable source of recurrence is the underlying snag history itself, not a frozen recurrence flag.

## Lifecycle Boundary

This phase does not change:

- snag lifecycle
- task lifecycle
- workpack lifecycle
- certification rules
- close-enforcement rules

Recurring snag detection is an informational analysis layer only.

It extends visibility, not lifecycle behavior.

## Invariants

The following invariants are established by Phase 11.5:

- recurrence threshold is `occurrence_count >= 2`
- recurrence is evaluated across the same aircraft
- recurrence uses historical snag data, not only the current workpack
- grouping is based on same defect text or normalized defect pattern
- `component_id` may be used as an optional grouping refinement
- output includes recurrence count and recurring indication
- recurrence is informational only
- recurrence does not auto-create tasks
- recurrence does not auto-change lifecycle
- recurrence does not auto-block a workpack
- recurrence is derived from history, not stored as fixed state

## Final Statement

Phase 11.5 defines recurring snag detection as an informational historical analysis across the same aircraft, using matching or normalized defect patterns with a recurrence threshold of `occurrence_count >= 2`, optionally refined by `component_id`, and displayed in execution as a recurring indicator with count, without creating tasks, changing lifecycle state, or blocking workpack progression.
