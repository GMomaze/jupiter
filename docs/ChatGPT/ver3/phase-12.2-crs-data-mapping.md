# Phase 12.2 - CRS Data Mapping

## Status

DEFINE ONLY

This phase defines CRS data mapping for Jupiter.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, compliance, planning, audit, or lifecycle behavior established in other phases.

This phase does not change the CRS eligibility rules defined in Phase 12.1.

## Purpose

The purpose of this phase is to define exactly which system data is used to build the Certificate of Release to Service (`CRS`) document.

This phase defines the CRS data map only.

It does not define eligibility, lifecycle transitions, or document-side recalculation behavior.

## Data Sources

The required CRS data sources are:

- `workpack`
- `task_cards`
- `workpack_compliance`
- `workpack_signatures` or equivalent certification data

### `workpack`

The `workpack` is the primary source for the release record context.

It provides the core operational identity and release document anchor.

### `task_cards`

`task_cards` provide the task-level maintenance content used to summarize work performed in the CRS.

### `workpack_compliance`

`workpack_compliance` provides the linked compliance completion records relevant to the workpack.

This is the source for compliance inclusion in the CRS.

### `workpack_signatures` Or Certification Data

`workpack_signatures` or the equivalent stored certification data provides the certifying engineer identity and release-signoff details used by the CRS.

This phase allows an equivalent stored certification source if the implementation uses stored workpack certification fields rather than a separate signature table for the final certifier reference.

## Mapping Rules

The required mapping rules are:

- workpack -> aircraft, reference, dates
- tasks -> work performed summary
- compliance -> AD/SB/SID completion status
- signatures -> certifying engineer details


Only tasks in eligible final states (CERTIFIED_BY_ENGINEER or LOCKED) may be included in the CRS mapping.

### Workpack Mapping

The `workpack` maps to the following CRS document elements:

- aircraft identity
- workpack reference
- relevant release dates

This includes the operational document identity for the CRS, such as:

- aircraft registration
- aircraft serial or equivalent stored aircraft reference
- workpack number or release reference
- stored certification or release dates that belong to the workpack record

### Task Mapping

`task_cards` map to the CRS work summary section.

This mapping must use the stored task content associated with the workpack to produce the work-performed summary included in the CRS.

The CRS task summary is derived from completed and eligible stored task records only.

### Compliance Mapping

`workpack_compliance` maps to the compliance section of the CRS.

This mapping must represent the stored completion status of linked compliance items, including applicable:

- `AD`
- `SB`
- `SID`

Only stored workpack-linked compliance completion records may be used.

### Signature Mapping

`workpack_signatures` or equivalent stored certification data maps to the certifying engineer section of the CRS.

This mapping must provide the stored certifying engineer details required for the release document, such as:

- certifying engineer identity
- certification timestamp
- stored licence or equivalent recorded certification reference if available in the system

## Constraints

The following constraints are mandatory:

- CRS uses existing stored data only
- no recalculation during document generation
- no inferred or missing data allowed

### Existing Stored Data Only

The CRS must be built only from data already stored in the system at the time of generation.

Document generation must not invent, fabricate, or reconstruct missing operational facts.

### No Recalculation During Document Generation

CRS generation must not recalculate operational state during document rendering beyond reading the already-stored eligible data set.

The document reflects stored system state only.

### No Inferred Or Missing Data Allowed

If required CRS data is missing, the CRS must not silently infer or substitute it.

Missing required data must be treated as a generation blocker under the CRS eligibility and validation model.

## Invariants

The following invariants are locked:

- mapping is read-only
- no lifecycle changes
- no execution changes
- no compliance changes
- no snag changes

### Read-Only Mapping

CRS data mapping must only read and organize stored system data for document output.

It must not edit the source records it reads.

### No Lifecycle Changes

CRS mapping must not change:

- workpack lifecycle
- task lifecycle
- snag lifecycle

### No Execution Changes

CRS mapping must not start, complete, certify, or close operational work.

It is a document data-read step only.

### No Compliance Changes

CRS mapping must not mark compliance items complete, incomplete, or otherwise alter compliance records.

### No Snag Changes

CRS mapping must not create, resolve, close, reopen, or alter snags.

## Boundary

This phase defines CRS data-source mapping only.

It does not define:

- eligibility rules
- lifecycle changes
- schema changes
- planning behavior
- compliance logic changes

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 12.2 defines CRS data mapping as a strict read-only mapping from stored `workpack`, `task_cards`, `workpack_compliance`, and `workpack_signatures` or equivalent certification data into aircraft, reference, dates, work summary, compliance completion, and certifying engineer details, using existing stored data only, with no recalculation, inference, lifecycle change, execution change, compliance change, or snag change during document generation.
