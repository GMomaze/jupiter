# Phase 15.3 - Lock Session Behavior

## Status

DEFINE ONLY

This phase defines Jupiter session governance only.

This phase does not implement code, does not modify schema, does not change migrations, does not fix TypeScript errors, does not refactor application behavior, and does not invent new system features.

This phase locks execution discipline for future AI and session work.

## Purpose

The purpose of this phase is to formally lock Jupiter session execution behavior so future work remains controlled, phase-correct, and aligned with verified system truth.

This phase exists to prevent:

- phase mixing
- implementation drift
- verification drift
- silent redesign
- unapproved deletion
- schema drift
- lifecycle drift
- planning/workpack drift
- audit-boundary weakening

This phase defines how future sessions must behave.

## Scope

Phase 15.3 covers session governance rules for:

- one active phase at a time
- `DEFINE -> IMPLEMENT -> VERIFY` enforcement
- phase isolation
- locked-phase handling
- no-drift behavior
- scope-expansion prevention
- cleanup governance
- documentation authority
- session start discipline
- AI behavior restrictions

This phase applies to future Jupiter documentation, implementation, verification, and cleanup sessions.

## Out Of Scope

The following are out of scope for Phase 15.3:

- code changes
- schema changes
- migration changes
- TypeScript fixes
- refactoring
- feature design changes
- lifecycle redesign
- planning redesign
- audit redesign
- customer-system redesign
- changing already-verified business rules

This phase defines governance only.

## Single-Phase Enforcement

Only one active phase may exist at a time.

### One Active Phase Only

Every session must operate against exactly one declared active phase.

The active phase must be explicit before substantive work begins.

### No Parallel Phase Execution

A session must not execute work for multiple phases in parallel.

If additional phase work is discovered, it must be deferred until the current phase is complete or explicitly changed.

### No Implicit Phase Switching

A session must not silently move from one phase to another because of convenience, curiosity, or perceived dependency.

Phase changes must be explicit.

## DEFINE -> IMPLEMENT -> VERIFY Enforcement

Jupiter sessions must follow:

- `DEFINE`
- `IMPLEMENT`
- `VERIFY`

in controlled order where applicable.

### DEFINE Rules

During `DEFINE`:

- define only
- no implementation
- no code changes
- no schema changes
- no behavior changes

### IMPLEMENT Rules

During `IMPLEMENT`:

- implement only the active phase scope
- do not add future-phase behavior
- do not reopen locked phases unless explicitly instructed

### VERIFY Rules

During `VERIFY`:

- verify only
- no code changes
- no schema changes
- no “while here” fixes
- no behavior edits

## Phase Isolation Rules

Each phase must remain isolated from unrelated work.

### No Mixing Phases

Do not combine multiple phases in one response, one edit set, or one implementation pass unless the governing document explicitly makes them the same phase.

### No Future-Phase Logic

Do not introduce logic, schema, validation, cleanup, or documentation behavior that belongs to a later phase.

### No Retroactive Phase Drift

Do not silently revise the meaning of earlier completed phases through unrelated work in later phases.

## Locked-Phase Behavior

Verified phases are treated as locked truth unless explicitly reopened.

### Verified Phase Truth

Once a phase has been verified, its accepted behavior becomes locked project truth.

Future sessions must preserve that truth.

### No Silent Reinterpretation

Locked phases must not be reinterpreted casually because of stale assumptions, partial memory, or convenience.

### Reopening Requires Explicit Instruction

If a locked phase truly needs reconsideration, that reopening must be explicit.

Absent that, the locked phase stands.

## No-Drift Rules

Future sessions must not drift away from verified Jupiter system truth.

### No Schema Drift

Do not introduce schema changes outside the active approved phase.

Do not assume schema gaps justify unscheduled schema edits.

### No Lifecycle Drift

Do not weaken, bypass, or redesign locked lifecycle behavior through incidental edits, documentation drift, or convenience fixes.

### No Planning / Workpack Drift

Do not collapse planning sessions into workpacks.

Do not blur the separation between planning and execution.

Do not treat workpacks as the source of truth.

### No Audit-Boundary Weakening

Do not weaken audit integrity, audit capture, or audit-boundary protection through later work unless an explicit phase reopens it.

### No Silent Redesigns

Do not change domain meaning, workflow meaning, lifecycle meaning, or document meaning without an explicit phase and instruction.

## Scope-Expansion Prevention

Sessions must resist uncontrolled expansion.

### Active Scope Only

Only the work required for the active phase may be performed.

### No “While Here” Changes

Do not fix adjacent issues, style issues, old TODOs, or unrelated defects just because they were discovered during the active phase.

### Dependencies Must Be Declared, Not Assumed

If the active phase is blocked by another issue, the blocker must be identified clearly rather than silently solved by expanding scope.

## Cleanup Governance Rules

Cleanup remains controlled.

### No Unapproved Deletions

No file, route, service, migration, model, helper, view, or document may be deleted without explicit approval.

### Phase 14 Cleanup Discipline Remains Locked

Cleanup must continue to follow the controlled pattern:

- identify
- approve
- remove
- verify

### No Broad Cleanup By Default

Do not treat old files, duplicate docs, or suspicious artifacts as removable without evidence and approval.

## Documentation Authority Hierarchy

Documentation authority must remain ordered.

### Primary Authority

The primary execution authority is:

- `docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md`

### Phase Authority

The active phase document and verified phase documents are the next authority level for the behavior they define and lock.

### Current-State References

Current-state support documents include:

- `docs/ChatGPT/AI_CONTEXT.md`
- `docs/ChatGPT/ver3/system_snapshot.md`
- `docs/ChatGPT/ver3/file_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `docs/ChatGPT/ver3/migration_inventory.md`
- `docs/ChatGPT/ver3/schema.sql`

These support accurate current-state interpretation but do not override the master execution plan or locked verified phase truth.

### Stale Historical Material

Older documentation may be consulted for history only.

It must not override current verified ver3 authority.

## Session Start Requirements

Every session must begin with explicit execution discipline.

### Active Phase Must Be Declared

The session must identify:

- active phase
- mode
- applicable rules

before substantive work is performed.

### Relevant Documents Must Be Loaded

The controlling master plan and the active phase document must be used before acting.

Where needed, supporting current-state documents must also be consulted.

### Current Scope Must Be Confirmed

The session must align the requested work with the active phase before implementation or verification begins.

## AI Behavior Restrictions

AI behavior must remain constrained by Jupiter governance.

### No Guessing System Truth

Do not invent data, routes, schema, behaviors, workflows, or phase meaning not verified in code or controlled docs.

### No Hidden Refactoring

Do not perform cleanup, restructuring, or redesign under the label of a narrower phase.

### No Implementation During DEFINE

During `DEFINE`, do not modify code or implement behavior.

### No Verification Changes During VERIFY

During `VERIFY`, do not fix or modify the system being verified.

### No Unapproved Deletions

Do not delete anything unless explicitly approved by the correct cleanup governance path.

### Preserve Locked Invariants

AI work must preserve locked invariants including:

- one active phase at a time
- no phase mixing
- no schema drift
- no lifecycle drift
- no planning/workpack drift
- no audit-boundary weakening

## Verification Requirements

Phase 15.3 governance definition must be verified against Jupiter’s locked execution discipline.

Verification must confirm that this phase defines:

- one active phase at a time
- no phase mixing
- `DEFINE -> IMPLEMENT -> VERIFY` enforcement
- no implementation during `DEFINE`
- no verification changes during `VERIFY`
- verified phases treated as locked truth
- no unapproved deletions
- no silent redesigns
- no schema drift
- no lifecycle drift
- no planning/workpack drift
- no audit-boundary weakening

Verification sources must include:

- the master execution plan
- current AI context
- Phase 14 cleanup governance outputs
- verified Phase 10 through Phase 15 documents where relevant

## Completion Criteria

Phase 15.3 is complete only when all of the following are true:

- the session-governance purpose is defined
- scope is defined
- out-of-scope items are defined
- single-phase enforcement is defined
- `DEFINE -> IMPLEMENT -> VERIFY` enforcement is defined
- phase isolation rules are defined
- locked-phase behavior is defined
- no-drift rules are defined
- scope-expansion prevention is defined
- cleanup governance is defined
- documentation authority hierarchy is defined
- session start requirements are defined
- AI behavior restrictions are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migrations were changed
- no TypeScript fixes were attempted

## Final Statement

Phase 15.3 formally locks Jupiter session behavior so future work remains single-phase, mode-correct, drift-resistant, approval-controlled, and aligned to verified project truth, with no implementation during `DEFINE`, no changes during `VERIFY`, no unapproved deletions, no silent redesigns, and no weakening of locked schema, lifecycle, planning/workpack, or audit boundaries.
