# Phase 12.6 - Document Verification

## Status

DEFINE ONLY

This phase defines release-document verification for Jupiter.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, compliance, planning, audit, or lifecycle behavior established in other phases.

## Purpose

The purpose of this phase is to define how generated release documents are verified for correctness and integrity.

This phase covers both:

- `CRS`
- `CRMA`

## CRS Verification

The `CRS` must be verified against the previously defined CRS phases.

Required CRS verification:

- meets Phase 12.1 eligibility
- uses Phase 12.2 mapping
- follows Phase 12.3 generation
- includes Phase 12.4 compliance summary

### Meets Phase 12.1 Eligibility

Verification must confirm that the generated `CRS` is only produced when the eligibility rules of Phase 12.1 are satisfied.

This includes confirming that:

- workpack is `CERTIFIED`
- all tasks are `CERTIFIED_BY_ENGINEER` or `LOCKED`
- compliance is complete
- all snags are `CLOSED`

### Uses Phase 12.2 Mapping

Verification must confirm that the `CRS` uses the defined stored data sources and mappings from Phase 12.2.

### Follows Phase 12.3 Generation

Verification must confirm that the `CRS` is generated through the read-only generation flow defined in Phase 12.3:

- eligibility check
- data mapping
- document rendering

### Includes Phase 12.4 Compliance Summary

Verification must confirm that the `CRS` contains the compliance summary defined in Phase 12.4 and that the summary is grouped and represented correctly.

## CRMA Verification

The `CRMA` must be verified as a separate partial-scope maintenance release document.

Required CRMA verification:

- correct task scope
- certification present
- does not imply full release

### Correct Task Scope

Verification must confirm that the `CRMA` represents only the intended specific task or limited maintenance-action scope.

It must not silently expand into full-workpack release scope.

### Certification Present

Verification must confirm that the required stored certification data for the `CRMA` is present in the document.

### Does Not Imply Full Release

Verification must confirm that the `CRMA` does not appear to certify the full workpack unless that full-release case is actually represented by the `CRS`.

## Data Integrity

Release-document data integrity verification must confirm:

- no missing required fields
- no null critical values

### No Missing Required Fields

Verification must confirm that all required document fields are present for the document type being generated.

If a required field is missing, the document must be treated as invalid.

### No Null Critical Values

Verification must confirm that critical document values are not null or empty where required for regulatory release meaning.

Critical null or empty values must be treated as blocking defects.

## Constraints

The following constraints are mandatory:

- read-only
- no recalculation
- no mutation

### Read-Only

Document verification must inspect generated document inputs or outputs only.

It must not edit workpack, task, compliance, signature, or snag data.

### No Recalculation

Document verification must not recalculate operational state as part of verification.

It verifies the document against stored system state and defined rules only.

### No Mutation

Document verification must not mutate:

- workpack data
- task data
- compliance data
- snag data
- lifecycle state

## Boundary

This phase defines release-document verification only.

It does not define:

- lifecycle changes
- execution logic changes
- schema changes
- planning behavior

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 12.6 defines Jupiter document verification as a read-only integrity check over generated `CRS` and `CRMA` outputs, confirming that CRS satisfies its eligibility, mapping, generation, and compliance-summary rules, that CRMA stays within certified partial scope and does not imply full release, and that no required fields or critical values are missing, without recalculation or mutation.
