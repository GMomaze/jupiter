# Jupiter AI Development Constitution

**Document ID:** JUPITER-AI-DEVELOPMENT-CONSTITUTION

**Revision:** 1.1

**Status:** Canonical

**Effective date:** 2026-08-18

## 1. Purpose and authority

This constitution governs AI-assisted engineering in Jupiter. Approved plans
define what may be changed; this constitution defines how authorised work must
be performed.

The authority hierarchy is defined by `GOVERNANCE_INDEX.md`. Historical version
directories are evidence only and are not active global governance.

Use the smallest authoritative and evidentiary context sufficient to perform
the approved task safely.

## 2. Execution lifecycle

The canonical lifecycle is:

```text
INVESTIGATE -> DEFINE -> IMPLEMENT -> VERIFY
```

Investigation is mandatory when functionality is unfamiliar, may already exist,
overlaps established authority or dirty work, or has uncertain database,
permission, security, or operational effects. Adequately investigated work may
begin at DEFINE when the Project Owner explicitly approves that transition.

Only one authorised phase or slice may be executed at a time. Do not drift into
the next phase, combine future work, or treat discovery as implementation
authority.

## 3. Evidence and existing functionality

Before changing unfamiliar behavior, inspect applicable routes, controllers,
services, models, migrations, constraints, views, permissions, tests,
documentation, and runtime/database evidence. Classify capability as:

- `EXACT_MATCH`
- `PARTIAL_MATCH`
- `NO_MATCH`

Existing authority must be reused or safely extended. Do not create a parallel
implementation, second source of truth, or competing lifecycle engine. An
absence in one screen or file is not proof that capability is absent.

Do not guess facts that can be inspected. Clearly distinguish verified,
inferred, assumed, and unknown information.

## 4. Change discipline

Implement the smallest precise change that satisfies the approved requirement.
Preserve existing working behavior and compatibility unless its change is
explicitly approved.

Without explicit approval, do not:

- perform unrelated refactoring or cleanup;
- rename or relocate routes, files, tables, fields, symbols, or concepts;
- invent architecture or create a second architecture;
- expand schema, ownership, tenancy, or lifecycle semantics;
- add or broaden permissions or role grants;
- weaken audit, history, transaction, or server-side authorization controls;
- implement adjacent improvements merely because they were discovered.

The retired historical “full-file-only” response rule is not global governance.
Repository agents should make precise scoped edits. A full file is provided only
when a task explicitly requires it.

## 5. Repository and user-owned work

A dirty repository is allowed when pre-existing changes can be identified and
preserved. Inventory branch, HEAD, staged, modified, and untracked state before
implementation.

Treat unrelated changes as user-owned. Do not clean, stash, revert, overwrite,
delete, stage, commit, or absorb them. If authorised work genuinely collides
with them, stop and request approval.

Never use broad staging such as `git add .`. Do not enable automatic commits.
Stage, commit, push, release, or deploy only with explicit authority, and only
after the relevant verification gate passes.

## 6. Destructive actions and secrets

No destructive filesystem, database, Git, infrastructure, or deployment action
may occur without explicit target-specific authority. Resolve and verify exact
targets first. Prefer reversible operations where practical.

Never print, commit, embed, or copy credentials or secret values into reports,
temporary SQL, command strings, logs, source, or documentation. Environment
files remain ignored and must be loaded only through approved configuration
paths. Review changed files for credential exposure before commit readiness.

## 7. Database and migration principles

Database operations follow `DATABASE_AND_MIGRATION_SAFETY.md`.

Key constitutional rules:

- Database identity must be proven, not inferred from filenames or variables.
- Destructive tests run only through the guarded test-database path.
- No schema change or migration without explicit approval.
- An executed migration is immutable.
- Corrections use a new additive repair migration.
- Never improvise production undo, restore, retry, privileges, or role changes.
- Production schema changes require verified target, ledger, backup, validation,
  checksum, controlled execution, audit, and recovery authority.

## 8. Authorization, permissions, and isolation

Server-side authorization is authoritative. Hidden or disabled UI controls never
replace route and service enforcement.

Do not silently introduce permission names, assign roles, broaden grants, or
weaken separation-of-duty controls. Permission changes require an approved
matrix, data migration/seed plan where applicable, and denial tests.

Do not claim tenant or company isolation unless query, mutation, lookup, count,
error, and direct-object access boundaries are implemented and verified. A
future isolation goal is not current enforcement.

Operationally meaningful unknown data must remain unknown. Domain rules may
prohibit converting missing values to zero or inventing defaults; applicable
domain authority must be inspected before normalization.

## 9. Verification and documentation

Verification is evidence, not confidence. It must evaluate the approved
requirement, regression risk, permissions, authority boundaries, persistence,
and applicable operational behavior.

Allowed outcomes include:

- `PASS`
- `PASS WITH LIMITATIONS`
- `FAIL`
- `BLOCKED`
- `NOT SAFE TO COMMIT`

A material unresolved limitation cannot be hidden in `PASS`.

Documentation must distinguish implemented, approved, proposed, deferred,
historical, and unknown states. When implementation and roadmap disagree, stop,
report the evidence, and obtain authority to correct the appropriate artifact.

## 10. Mandatory stop conditions

Stop and report when:

- authority, active scope, target, or required evidence is unclear;
- canonical documents conflict;
- requested behavior already exists and no change is needed;
- a change would create duplicate authority or violate a locked boundary;
- work expands beyond the approved phase;
- a dirty-file collision cannot be safely separated;
- database or environment identity cannot be proven;
- required permission or ownership behavior is unresolved;
- verification fails or a regression appears;
- safe recovery would require new authority.

Difficulty, elapsed time, or an inconvenient result is not permission to weaken
a stop condition.
