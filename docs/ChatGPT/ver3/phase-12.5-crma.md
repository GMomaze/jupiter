# Phase 12.5 - CRMA

## Status

DEFINE ONLY

This phase defines the Certificate of Release to Maintenance Action (`CRMA`) for Jupiter.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, compliance, planning, audit, or lifecycle behavior established in other phases.

This phase does not change CRS eligibility rules, CRS data mapping, CRS generation-service behavior, or compliance-summary behavior already defined in earlier phases.

## Purpose

The purpose of this phase is to define the `CRMA` as a separate optional document.

The `CRMA` is a maintenance-action release document, not the same document as the full `CRS`.

## CRMA Nature

The `CRMA` is:

- separate from `CRS`
- used when applicable (partial release, specific action, etc.)

### Separate From `CRS`

The `CRMA` is a distinct document type from the Certificate of Release to Service (`CRS`).

It must not be treated as the same release artifact.

### Used When Applicable

The `CRMA` is used only where an applicable maintenance-action release scenario exists, such as:

- partial release
- specific maintenance action release
- limited maintenance certification scope

This phase defines the document role only.

It does not define new operational approval rules beyond the existence of the separate document type.

## Usage

The `CRMA` usage is defined as follows:

- issued for specific maintenance actions
- not necessarily tied to full workpack completion

The CRMA must clearly identify the specific task or maintenance action it certifies, including a unique reference to that task or action.

### Issued For Specific Maintenance Actions

The `CRMA` may be issued to represent the certification of a defined maintenance action or subset of maintenance work.

Its scope is narrower than a full workpack release.

### Not Necessarily Tied To Full Workpack Completion

The `CRMA` does not require the same full-document scope as the `CRS`.

It may apply to a specific task or bounded maintenance action without implying that the entire workpack has reached full release status.

This phase defines that narrower usage boundary only.

It does not redefine lifecycle or completion logic.

## Data Sources

The required `CRMA` data sources are:

- `workpack`
- specific task or subset of tasks
- signatures or certification data

### `workpack`

The `workpack` provides the parent maintenance context for the `CRMA`.

It supplies the operational reference needed to anchor the maintenance-action release.

### Specific Task Or Subset Of Tasks

The `CRMA` may use a specific task or selected subset of tasks as the maintenance-action scope represented by the document.

This task-level scope distinguishes the `CRMA` from the full-workpack scope of the `CRS`.

### Signatures Or Certification Data

Stored signatures or equivalent stored certification data provide the certifying person details and certification evidence used by the `CRMA`.

Only stored certification data may be used.

## Constraints

The following constraints are mandatory:

- read-only
- no lifecycle changes
- no execution changes

### Read-Only

Generating a `CRMA` must not mutate workpack, task, compliance, signature, or snag data.

The document service must only read stored system state.

### No Lifecycle Changes

Generating a `CRMA` must not change:

- workpack lifecycle
- task lifecycle
- snag lifecycle

The document is a release artifact only.

It must not become a state-transition mechanism.

### No Execution Changes

Generating a `CRMA` must not:

- start work
- complete work
- certify tasks
- certify workpacks
- close tasks
- close workpacks

## Relationship To `CRS`

The relationship between `CRMA` and `CRS` is:

- `CRMA` does not replace `CRS`
- `CRS` remains the full release document

### `CRMA` Does Not Replace `CRS`

The `CRMA` must not be treated as a substitute for the full Certificate of Release to Service.

It is a separate optional document for narrower maintenance-action release cases.

### `CRS` Remains The Full Release Document

The `CRS` remains the full release-to-service certification document for the complete eligible workpack release scenario.

The existence of the `CRMA` does not weaken or replace the role of the `CRS`.

## Boundary

This phase defines the `CRMA` document role only.

It does not define:

- lifecycle changes
- execution logic changes
- compliance logic changes
- schema changes
- planning behavior

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 12.5 defines the Jupiter `CRMA` as a separate optional read-only maintenance-action release document, distinct from the full `CRS`, used when applicable for specific or partial maintenance scope, based on stored workpack, task-scope, and certification data, without changing lifecycle, execution, or the role of the full CRS release document.
