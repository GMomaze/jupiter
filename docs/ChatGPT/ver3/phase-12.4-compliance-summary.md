# Phase 12.4 - Compliance Summary

## Status

DEFINE ONLY

This phase defines compliance summary behavior for Jupiter document output.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, compliance, planning, audit, or lifecycle behavior established in other phases.

This phase does not change CRS eligibility rules, CRS data mapping, or CRS generation-service behavior already defined in earlier phases.

## Purpose

The purpose of this phase is to define how compliance completion is represented in release documents.

This phase defines document-side compliance summary representation only.

It does not define compliance calculation logic.

## Compliance Categories

The compliance categories that must be represented are:

- `AD` (Airworthiness Directives)
- `SB` (Service Bulletins)
- `SID` (Supplemental Inspection Documents)

### `AD`

`AD` items are Airworthiness Directives and must appear within the compliance summary under the `AD` category when completed and eligible for inclusion.

### `SB`

`SB` items are Service Bulletins and must appear within the compliance summary under the `SB` category when completed and eligible for inclusion.

### `SID`

`SID` items are Supplemental Inspection Documents and must appear within the compliance summary under the `SID` category when completed and eligible for inclusion.

## Summary Behavior

The compliance summary must behave as follows:

- show completion status per category
- only completed items included in CRS
- incomplete items must block CRS (per 12.1)

### Show Completion Status Per Category

The document must represent compliance completion in a way that clearly separates the categories of:

- `AD`
- `SB`
- `SID`

The summary must make it clear which completed compliance items belong to each category.

### Only Completed Items Included In CRS

Only compliance items with completed workpack compliance status may be represented in the CRS compliance summary.

Incomplete compliance items must not appear as if they were completed.

### Incomplete Items Block CRS

If any required workpack compliance item is incomplete, CRS generation must be blocked according to the eligibility rules defined in Phase 12.1.

This phase does not redefine that blocking rule.

It only confirms that incomplete items are not represented as completed document output.

## Output

The compliance summary output must be:

- clear summary section in CRS
- grouped by `AD` / `SB` / `SID`

### Clear Summary Section In CRS

The CRS must contain a compliance summary section that is clearly identifiable as the compliance portion of the release document.

The summary must be readable and operationally understandable.

### Grouped By `AD` / `SB` / `SID`

Within the CRS, completed compliance items must be organized by category:

- `AD`
- `SB`
- `SID`

The grouping must make the compliance status representation unambiguous.

## Constraints

The following constraints are mandatory:

- read-only
- no recalculation
- uses stored `workpack_compliance` data only

### Read-Only

Compliance summary generation must not modify compliance records, workpacks, tasks, snags, or any other system state.

### No Recalculation

The compliance summary must not recalculate compliance status during document generation.

It must read the already-stored workpack compliance state.

### Stored `workpack_compliance` Data Only

The compliance summary must use stored `workpack_compliance` data only.

It must not infer completion from unrelated task state, planning state, or external assumptions.

## Invariants

The following invariants are locked:

- no lifecycle changes
- no execution changes
- no audit changes

### No Lifecycle Changes

This phase does not change:

- workpack lifecycle
- task lifecycle
- snag lifecycle

### No Execution Changes

This phase does not start, complete, certify, or close any operational work.

It defines document representation only.

### No Audit Changes

This phase does not redefine audit capture, audit immutability, audit UI behavior, audit storage, or audit write logic.

## Boundary

This phase defines compliance summary representation in documents only.

It does not define:

- compliance logic recalculation
- lifecycle changes
- schema changes
- planning behavior
- snag behavior changes

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 12.4 defines the Jupiter compliance summary as a read-only CRS document section that represents completed `AD`, `SB`, and `SID` workpack compliance items using stored `workpack_compliance` data only, groups them clearly by category, includes only completed items, and relies on existing CRS eligibility rules to block generation when incomplete compliance remains.
