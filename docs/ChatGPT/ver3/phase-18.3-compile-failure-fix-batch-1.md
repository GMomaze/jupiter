# Phase 18.3 - Compile Failure Fix Batch 1

## Status

DEFINE ONLY

This phase defines the first narrow compile-fix batch based only on captured TypeScript errors.

This phase does not implement code, does not change schema, does not change migrations, does not refactor existing behavior, and does not redesign behavior.

This phase preserves locked lifecycle, audit, planning, and customer boundaries.

## Purpose

The purpose of this phase is to define the smallest safe first compile-fix batch from the recorded TypeScript failure inventory.

Jupiter must begin compile stabilization with a tightly bounded correction set that removes a single low-risk error pattern without widening into broader nullability cleanup, workflow redesign, or subsystem behavior change.

This phase defines the first correction batch only.

It does not authorize broad compile cleanup.

## Batch Selection

The smallest safe first batch is the `TS2379` `actor_id` optional-property incompatibility captured in the customer audit logging path.

This batch is selected because:

- it is limited to one file
- it is limited to one repeated TypeScript error pattern
- it is narrow and type-shape focused
- it does not require lifecycle redesign
- it does not require planning redesign
- it does not require customer-boundary redesign
- it does not require compile-wide nullability cleanup

## Files In Scope

The following file is in scope for Phase 18.3:

- `src/modules/customers/customers.service.ts`

## Exact Errors In Scope

The following captured compile errors are in scope:

- `src/modules/customers/customers.service.ts:144`
  - `TS2379`
  - `AuditService.log(...)` payload `actor_id`

- `src/modules/customers/customers.service.ts:174`
  - `TS2379`
  - `AuditService.log(...)` payload `actor_id`

- `src/modules/customers/customers.service.ts:240`
  - `TS2379`
  - `AuditService.log(...)` payload `actor_id`

## Error Pattern In Scope

The allowed correction target for this batch is only the exact captured pattern below:

- a value typed as `string | null | undefined` being passed into a target contract that accepts `string | null` under `exactOptionalPropertyTypes: true`

## Allowed Correction Types

Later implementation in this batch may use only narrow compile-safe corrections such as:

- local payload shaping for `AuditService.log(...)`
- omission of optional properties when the value is `undefined`
- safe narrowing of `actor_id` before constructing the audit payload
- local type alignment to the existing `AuditService.log(...)` contract

## Out Of Scope

The following files are out of scope for Phase 18.3:

- `src/modules/library/ad-import.controller.ts`
- `src/modules/library/sb-import.adapters.ts`
- `src/modules/workpacks/services/snag.service.ts`
- `src/modules/workpacks/services/TaskImportService.ts`

The following error categories are out of scope for Phase 18.3:

- `TS2532`
- `TS2345`
- `TS18048`
- `TS2339`
- nullability cleanup unrelated to `actor_id`
- import adapter corrections
- workpack service corrections
- parser-flow corrections
- broader audit-service redesign

## No Behavior Redesign Rule

This batch must not become a behavior change.

### Explicit Non-Redesign Constraints

Phase 18.3 must not:

- redesign customer behavior
- redesign audit behavior
- redesign lifecycle behavior
- redesign planning behavior
- redesign customer identity boundaries
- redesign customer visibility boundaries
- change the meaning of audit events
- alter when audit logging occurs
- alter the business rules for customer-aircraft linking

### Locked Boundary Preservation

This batch must preserve:

- Phase 10 locked boundaries
- Phase 14 locked boundaries
- Phase 17 locked customer boundaries
- lifecycle rules
- audit rules
- planning rules

## Verification Checks

Phase 18.3 is correctly defined only if all of the following are true:

- the first fix batch is selected from the compile-failure inventory only
- the batch is limited to one file or one tightly related correction set
- exact files in scope are defined
- exact TypeScript errors in scope are defined
- allowed correction types are defined
- out-of-scope files and errors are defined
- behavior redesign is explicitly forbidden
- lifecycle, audit, planning, and customer boundaries are explicitly preserved

## Completion Criteria

Phase 18.3 is complete only when all of the following are true:

- the purpose is defined
- the first narrow batch is selected
- files in scope are defined
- exact errors in scope are defined
- allowed correction types are defined
- out-of-scope files and errors are defined
- no behavior redesign rules are defined
- verification checks are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no refactoring was performed
- locked lifecycle, audit, planning, and customer boundaries were preserved

## Final Statement

Phase 18.3 defines Jupiter’s first compile-fix batch as a narrow, single-file correction set limited to the captured `TS2379` `actor_id` optional-property incompatibility in `src/modules/customers/customers.service.ts`, with only local type-shaping or optional-property alignment allowed and with all broader compile fixes, audit redesign, lifecycle changes, planning changes, and customer-boundary changes explicitly excluded from this batch.
