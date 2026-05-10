# Phase 18.6 - Compile Failure Fix Batch 4

## Status

DEFINE ONLY

This phase defines the fourth narrow compile-fix batch for captured `TS2339` transaction typing errors in the snag service.

This phase does not implement code, does not change schema, does not change migrations, does not refactor existing behavior, and does not redesign behavior.

This phase preserves locked lifecycle, audit, planning, customer, and snag boundaries.

## Purpose

The purpose of this phase is to define the fourth narrow compile-fix batch for the captured `TS2339` transaction typing errors in `snag.service.ts`.

Jupiter must correct the remaining compile blockers by aligning local transaction-related typing in the snag service without redesigning snag workflow behavior, transaction behavior, execution behavior, or any locked subsystem boundary.

This phase defines the fourth correction batch only.

It does not authorize compile-wide cleanup.

## File In Scope

The following file is in scope for Phase 18.6:

- `src/modules/workpacks/services/snag.service.ts`

## Exact TS2339 Patterns In Scope

The following captured `TS2339` pattern is in scope:

- property `transaction` does not exist on type `{}`

## In-Scope Compile Targets

The following captured error locations are within this batch scope:

- line `535`
  - `TS2339`
  - property `transaction` does not exist on type `{}`

- line `614`
  - `TS2339`
  - property `transaction` does not exist on type `{}`

- line `677`
  - `TS2339`
  - property `transaction` does not exist on type `{}`

## Allowed Correction Types

Later implementation in this batch may use only narrow compile-safe corrections such as:

- local option/context typing correction
- safe parameter typing alignment
- local interface/type refinement
- safe narrowing of options objects

### Safe Correction Direction

The allowed direction is limited to proving the presence and type of the existing transaction-bearing object to TypeScript without changing when transactions are used or how snag operations behave.

## Out Of Scope

The following files are out of scope for Phase 18.6:

- `src/modules/customers/customers.service.ts`
- `src/modules/library/ad-import.controller.ts`
- `src/modules/library/sb-import.adapters.ts`
- `src/modules/workpacks/services/TaskImportService.ts`
- any file outside `src/modules/workpacks/services/snag.service.ts`

The following error categories are out of scope for Phase 18.6:

- `TS2379`
- `TS2532`
- `TS2345`
- `TS18048`
- compile-wide cleanup
- broad typing cleanup
- unrelated nullability cleanup

## Forbidden Changes

The following are explicitly forbidden in Phase 18.6:

- snag workflow redesign
- transaction behavior redesign
- execution workflow redesign
- lifecycle redesign
- compile-wide cleanup
- broad typing cleanup
- behavior redesign

## No Behavior Redesign Rule

This batch must not become a disguised functional change.

### Explicit Non-Redesign Constraints

Phase 18.6 must not:

- redesign snag creation behavior
- redesign snag update behavior
- redesign snag execution behavior
- redesign transaction semantics
- redesign execution sequencing
- redesign workflow intent
- widen scope into unrelated cleanup

## Preserved Behaviors

This batch must preserve:

- snag workflow behavior
- existing transaction usage behavior
- existing execution behavior
- existing validation behavior
- existing error handling intent

## Preserved Boundaries

This batch must preserve:

- lifecycle boundaries
- audit boundaries
- planning boundaries
- customer boundaries
- snag boundaries
- locked Phase 10 boundaries
- locked Phase 14 boundaries
- locked Phase 17 boundaries

## Verification Checks

Phase 18.6 is correctly defined only if all of the following are true:

- exact file in scope is defined
- exact `TS2339` pattern in scope is defined
- in-scope compile targets are defined
- allowed correction types are defined
- out-of-scope files and errors are defined
- behavior redesign is explicitly forbidden
- snag workflow behavior is explicitly preserved
- lifecycle, audit, planning, customer, and snag boundaries are explicitly preserved
- verification checks are defined

## Completion Criteria

Phase 18.6 is complete only when all of the following are true:

- the purpose is defined
- exact file in scope is defined
- exact `TS2339` pattern in scope is defined
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
- locked lifecycle, audit, planning, customer, and snag boundaries were preserved

## Final Statement

Phase 18.6 defines Jupiter’s fourth compile-fix batch as a narrow, single-file correction set limited to the captured `TS2339` transaction typing errors in `src/modules/workpacks/services/snag.service.ts`, allowing only local option/context typing correction, safe parameter typing alignment, local interface/type refinement, and safe narrowing of options objects while explicitly forbidding snag workflow redesign, transaction behavior redesign, execution workflow redesign, lifecycle redesign, compile-wide cleanup, broad typing cleanup, and any change to locked lifecycle, audit, planning, customer, or snag boundaries.
