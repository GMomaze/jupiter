# Phase 18.1 - TypeScript Compile Stabilization

## Status

DEFINE ONLY

This phase defines how current TypeScript compile failures must be investigated and corrected safely.

This phase does not implement code, does not change schema, does not change migrations, does not refactor existing behavior, and does not alter Phase 17 customer behavior.

This phase preserves lifecycle, audit, and planning rules.

## Purpose

The purpose of this phase is to define a safe correction boundary for current TypeScript compile failures.

Jupiter must be able to investigate and fix compile-breaking TypeScript issues without using compiler cleanup as a reason to redesign application behavior, alter locked customer boundaries, or change lifecycle, audit, or planning rules.

This phase defines compile-stabilization rules only.

It does not authorize behavior redesign.

## Scope

This phase defines:

- investigation rules for current compile failures
- compile-error capture requirements
- file-by-file correction rules
- no behavior redesign rules
- verification requirements
- completion criteria

This phase applies specifically to known failing areas including:

- `src/modules/library/ad-import.controller.ts`
- `src/modules/library/sb-import.adapters.ts`
- `src/modules/workpacks/services/snag.service.ts`
- `src/modules/workpacks/services/TaskImportService.ts`

## Out Of Scope

The following are out of scope for Phase 18.1:

- schema changes
- migration changes
- refactoring
- lifecycle redesign
- audit redesign
- planning redesign
- customer visibility redesign
- customer identity redesign
- portal redesign
- feature expansion unrelated to compile stabilization

This phase defines safe compile correction only.

## Investigation Rules

Compile stabilization must begin with direct investigation of actual current compiler failures.

### Investigation Direction

The investigation must:

- identify the exact TypeScript compiler errors currently preventing successful compile
- record the affected files and failing symbols, types, imports, signatures, or property references
- distinguish true compile failures from warnings, style concerns, or optional cleanup
- isolate file-local correction needs before considering shared-type adjustments

### Investigation Boundaries

The investigation must not:

- assume intended behavior changes
- redesign domain workflows while fixing types
- widen scope into unrelated cleanup
- change locked customer, lifecycle, audit, or planning rules

## Compile-Error Capture Requirements

Compile corrections must be based on captured compiler output rather than guesswork.

### Required Error Capture

The compile-stabilization process must capture:

- the exact failing file path
- the exact TypeScript error code where available
- the exact failing line or symbol context where available
- the reason the compiler rejects the current code
- whether the issue is caused by typing, imports, nullability, incompatible interfaces, missing properties, or invalid call signatures

### Evidence Rule

Each correction should later map back to a specific compile failure rather than to broad speculative cleanup.

## File-By-File Correction Rules

Compile stabilization must be applied file by file and error by error.

### Correction Direction

Each affected file must be corrected in the narrowest safe way that resolves the compile failure.

### Allowed Correction Types

Allowed correction types later may include:

- import fixes
- type annotation fixes
- interface alignment fixes
- null and undefined safety fixes
- property-access fixes
- call-signature fixes
- safe local type narrowing
- safe adaptation to existing domain contracts

### File Isolation Rule

A correction in one failing file must not trigger unrelated redesign in another area unless a direct compile dependency requires it.

### Known Failing Area Rule

The following files must be treated as explicit compile-stabilization targets in this phase:

- `src/modules/library/ad-import.controller.ts`
- `src/modules/library/sb-import.adapters.ts`
- `src/modules/workpacks/services/snag.service.ts`
- `src/modules/workpacks/services/TaskImportService.ts`

## No Behavior Redesign Rule

Compile stabilization must not become a disguised behavior change.

### Locked Behavior Rule

Type corrections must preserve existing intended behavior unless a compile failure can only be resolved by aligning code to already established behavior.

### Explicit Non-Redesign Constraints

This phase must not:

- alter Phase 17 customer behavior
- alter customer identity boundaries
- alter customer visibility boundaries
- alter lifecycle rules
- alter audit rules
- alter planning rules
- redesign import workflows
- redesign snag workflows
- redesign task import workflows

### Safe Correction Standard

If multiple compile-fix options exist, the later implementation should choose the smallest correction that restores compile success while preserving existing system behavior.

## Verification Requirements

Phase 18.1 is correctly defined only if all of the following are true:

- investigation rules are defined
- compile-error capture requirements are defined
- file-by-file correction rules are defined
- no behavior redesign rule is defined
- known failing files are explicitly listed
- Phase 17 customer behavior is explicitly preserved
- lifecycle rules are explicitly preserved
- audit rules are explicitly preserved
- planning rules are explicitly preserved
- verification requirements are defined
- completion criteria are defined

## Completion Criteria

Phase 18.1 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- investigation rules are defined
- compile-error capture requirements are defined
- file-by-file correction rules are defined
- no behavior redesign rule is defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no refactoring was performed
- Phase 17 customer behavior was preserved
- lifecycle, audit, and planning rules were preserved

## Final Statement

Phase 18.1 defines Jupiter’s TypeScript compile-stabilization boundary as a narrow investigation-and-correction process in which actual compiler failures are captured, traced, and corrected file by file for the known failing areas without altering Phase 17 customer behavior, without redesigning lifecycle, audit, or planning rules, and without expanding compile cleanup into unrelated refactoring or behavior change.
