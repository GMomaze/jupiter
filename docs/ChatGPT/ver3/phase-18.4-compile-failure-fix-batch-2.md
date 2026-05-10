# Phase 18.4 - Compile Failure Fix Batch 2

## Status

DEFINE ONLY

This phase defines the second narrow compile-fix batch for captured TypeScript errors in the library import files.

This phase does not implement code, does not change schema, does not change migrations, does not refactor existing behavior, and does not redesign behavior.

This phase preserves locked lifecycle, audit, planning, customer, and library boundaries.

## Purpose

The purpose of this phase is to define the second narrow compile-fix batch for the captured `TS2532` and `TS2345` errors in the library import files.

Jupiter must correct these compile blockers using narrow local safety adjustments only, without redesigning import workflows, CSV handling, applicability behavior, or broader library architecture.

This phase defines the second correction batch only.

It does not authorize compile-wide cleanup.

## Files In Scope

The following files are in scope for Phase 18.4:

- `src/modules/library/ad-import.controller.ts`
- `src/modules/library/sb-import.adapters.ts`

## Exact Error Families In Scope

The following captured TypeScript error families are in scope:

- `TS2532`
  - object is possibly `undefined`

- `TS2345`
  - `string | undefined` passed where `string` is required

## In-Scope Compile Targets

The following captured error locations are within this batch scope:

### `src/modules/library/ad-import.controller.ts`

- `TS2532`
  - lines `470`, `505`, `516`

- `TS2345`
  - lines `471`, `525`, `536`, `540`

### `src/modules/library/sb-import.adapters.ts`

- `TS2532`
  - line `154`

- `TS2345`
  - line `295`

## Allowed Correction Types

Later implementation in this batch may use only narrow compile-safe corrections such as:

- local null guards
- safe narrowing
- safe argument defaulting
- property-access guards
- local type alignment

### Safe Correction Direction

The allowed direction is limited to making current code paths compile-safe while preserving existing behavior and existing library import intent.

## Out Of Scope

The following files are out of scope for Phase 18.4:

- `src/modules/customers/customers.service.ts`
- `src/modules/workpacks/services/snag.service.ts`
- `src/modules/workpacks/services/TaskImportService.ts`
- any file outside the two defined library import files

The following error categories are out of scope for Phase 18.4:

- `TS2379`
- `TS18048`
- `TS2339`
- broad nullability cleanup
- compile-wide cleanup
- unrelated typing cleanup

## Forbidden Changes

The following are explicitly forbidden in Phase 18.4:

- import workflow redesign
- CSV parsing redesign
- applicability redesign
- library architecture redesign
- broad nullability cleanup
- compile-wide cleanup
- behavior redesign

## No Behavior Redesign Rule

This batch must not become a disguised functional change.

### Explicit Non-Redesign Constraints

Phase 18.4 must not:

- redesign AD import workflow behavior
- redesign SB import workflow behavior
- redesign CSV interpretation behavior
- redesign parser sequencing
- redesign applicability behavior
- change import-result meaning
- widen scope into unrelated cleanup

## Preserved Boundaries

This batch must preserve:

- import workflow behavior
- library boundaries
- customer boundaries
- lifecycle boundaries
- audit boundaries
- planning boundaries
- locked Phase 10 boundaries
- locked Phase 14 boundaries
- locked Phase 17 boundaries

## Verification Checks

Phase 18.4 is correctly defined only if all of the following are true:

- exact files in scope are defined
- exact error families in scope are defined
- allowed correction types are defined
- out-of-scope files and errors are defined
- behavior redesign is explicitly forbidden
- import workflow behavior is explicitly preserved
- library, customer, lifecycle, audit, and planning boundaries are explicitly preserved
- forbidden redesign categories are explicitly defined
- verification checks are defined

## Completion Criteria

Phase 18.4 is complete only when all of the following are true:

- the purpose is defined
- exact files in scope are defined
- exact error families in scope are defined
- in-scope compile targets are defined
- allowed correction types are defined
- out-of-scope files and errors are defined
- forbidden changes are defined
- no behavior redesign rules are defined
- preserved boundaries are defined
- verification checks are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no refactoring was performed
- locked lifecycle, audit, planning, customer, and library boundaries were preserved

## Final Statement

Phase 18.4 defines Jupiter’s second compile-fix batch as a narrow, two-file correction set limited to the captured `TS2532` and `TS2345` library import errors in `src/modules/library/ad-import.controller.ts` and `src/modules/library/sb-import.adapters.ts`, allowing only local null guards, safe narrowing, safe argument defaulting, property-access guards, and local type alignment while explicitly forbidding import workflow redesign, CSV parsing redesign, applicability redesign, library architecture redesign, broad nullability cleanup, compile-wide cleanup, and any change to locked lifecycle, audit, planning, customer, or library boundaries.
