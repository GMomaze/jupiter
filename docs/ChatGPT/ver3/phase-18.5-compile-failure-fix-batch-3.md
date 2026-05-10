# Phase 18.5 - Compile Failure Fix Batch 3

## Status

DEFINE ONLY

This phase defines the third narrow compile-fix batch for captured `TS18048` errors involving possibly undefined local variables.

This phase does not implement code, does not change schema, does not change migrations, does not refactor existing behavior, and does not redesign behavior.

This phase preserves locked lifecycle, audit, planning, customer, library, and task-import boundaries.

## Purpose

The purpose of this phase is to define the third narrow compile-fix batch for the captured `TS18048` local-variable nullability errors.

Jupiter must correct these compile blockers using narrow local safety checks only, without redesigning import workflows, task import workflows, parser behavior, or any locked subsystem behavior.

This phase defines the third correction batch only.

It does not authorize compile-wide cleanup.

## Files In Scope

The following files are in scope for Phase 18.5:

- `src/modules/library/ad-import.controller.ts`
- `src/modules/workpacks/services/TaskImportService.ts`

## Exact TS18048 Patterns In Scope

The following captured `TS18048` patterns are in scope:

### `src/modules/library/ad-import.controller.ts`

- `attributes` is possibly `undefined`
- `cellBody` is possibly `undefined`

### `src/modules/workpacks/services/TaskImportService.ts`

- `record` is possibly `undefined`

## In-Scope Compile Targets

The following captured error locations are within this batch scope:

### `src/modules/library/ad-import.controller.ts`

- line `520`
  - `TS18048`
  - `attributes` is possibly `undefined`

- line `526`
  - `TS18048`
  - `attributes` is possibly `undefined`

- line `531`
  - `TS18048`
  - `cellBody` is possibly `undefined`

- line `535`
  - `TS18048`
  - `cellBody` is possibly `undefined`

- line `539`
  - `TS18048`
  - `cellBody` is possibly `undefined`

### `src/modules/workpacks/services/TaskImportService.ts`

- lines `97`, `98`, `99`, `100`
  - `TS18048`
  - `record` is possibly `undefined`

- lines `121`, `122`, `123`, `124`
  - `TS18048`
  - `record` is possibly `undefined`

## Allowed Correction Types

Later implementation in this batch may use only narrow compile-safe corrections such as:

- local variable guards
- safe narrowing
- presence checks
- loop-record guards
- safe conditional access
- local variable initialization safety

### Safe Correction Direction

The allowed direction is limited to ensuring the existing local control flow proves variable presence to TypeScript without changing the intended import or task-processing behavior.

## Out Of Scope

The following files are out of scope for Phase 18.5:

- `src/modules/customers/customers.service.ts`
- `src/modules/library/sb-import.adapters.ts`
- `src/modules/workpacks/services/snag.service.ts`
- any file outside the two defined scope files

The following error categories are out of scope for Phase 18.5:

- `TS2379`
- `TS2532`
- `TS2345`
- `TS2339`
- broad nullability cleanup
- compile-wide cleanup
- unrelated typing cleanup

## Forbidden Changes

The following are explicitly forbidden in Phase 18.5:

- import workflow redesign
- task import redesign
- parser redesign
- workflow redesign
- broad nullability cleanup
- compile-wide cleanup
- behavior redesign

## No Behavior Redesign Rule

This batch must not become a disguised functional change.

### Explicit Non-Redesign Constraints

Phase 18.5 must not:

- redesign library import behavior
- redesign task import behavior
- redesign parser sequencing
- redesign record interpretation
- redesign commit behavior
- redesign validation intent
- widen scope into unrelated cleanup

## Preserved Behaviors

This batch must preserve:

- import workflow behavior
- task import behavior
- existing preview behavior where applicable
- existing commit behavior
- existing validation behavior
- existing error handling intent

## Preserved Boundaries

This batch must preserve:

- lifecycle boundaries
- audit boundaries
- planning boundaries
- customer boundaries
- library boundaries
- locked Phase 10 boundaries
- locked Phase 14 boundaries
- locked Phase 17 boundaries

## Verification Checks

Phase 18.5 is correctly defined only if all of the following are true:

- exact files in scope are defined
- exact `TS18048` patterns in scope are defined
- in-scope compile targets are defined
- allowed correction types are defined
- out-of-scope files and errors are defined
- behavior redesign is explicitly forbidden
- import workflow behavior is explicitly preserved
- task import behavior is explicitly preserved
- lifecycle, audit, planning, customer, and library boundaries are explicitly preserved
- verification checks are defined

## Completion Criteria

Phase 18.5 is complete only when all of the following are true:

- the purpose is defined
- exact files in scope are defined
- exact `TS18048` patterns in scope are defined
- in-scope compile targets are defined
- allowed correction types are defined
- out-of-scope files and errors are defined
- forbidden changes are defined
- no behavior redesign rules are defined
- preserved behaviors are defined
- preserved boundaries are defined
- verification checks are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no refactoring was performed
- locked lifecycle, audit, planning, customer, library, and task-import boundaries were preserved

## Final Statement

Phase 18.5 defines Jupiter’s third compile-fix batch as a narrow, two-file correction set limited to the captured `TS18048` local-variable nullability errors in `src/modules/library/ad-import.controller.ts` and `src/modules/workpacks/services/TaskImportService.ts`, allowing only local variable guards, safe narrowing, presence checks, loop-record guards, safe conditional access, and local variable initialization safety while explicitly forbidding import workflow redesign, task import redesign, parser redesign, workflow redesign, broad nullability cleanup, compile-wide cleanup, and any change to locked lifecycle, audit, planning, customer, library, or task-import boundaries.
