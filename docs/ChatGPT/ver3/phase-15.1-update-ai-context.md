# Phase 15.1 - Update AI_CONTEXT

## Status

DEFINE ONLY

This phase defines how `docs/ChatGPT/AI_CONTEXT.md` must be updated so it reflects the real current Jupiter system after the completed and locked phases.

This phase does not implement code, does not modify application logic, does not refactor behavior, does not change schema, does not fix TypeScript errors, and does not rename phases.

This phase defines documentation update requirements only.

## Purpose

The purpose of this phase is to replace outdated assumptions in `docs/ChatGPT/AI_CONTEXT.md` with verified current-system facts.

The updated AI context must:

- reflect the real current Jupiter system
- align with completed and verified phases
- preserve locked lifecycle behavior
- preserve locked audit behavior
- preserve locked planning integrity behavior
- preserve the controlled cleanup outcome from Phase 14
- clarify current workflows, boundaries, and source-of-truth rules

The updated AI context must become a reliable briefing document for future sessions.

## Scope

Phase 15.1 covers documentation updates to `docs/ChatGPT/AI_CONTEXT.md` only.

The update must cover:

- actual current system purpose
- actual current architecture and stack
- actual source-of-truth model
- actual workpack, execution, document, planning, and customer-visibility boundaries
- actual locked lifecycle rules
- actual locked audit rules
- actual planning-system rules
- actual controlled cleanup outcome from Phase 14
- actual documentation usage rules for future AI sessions

The update must correct outdated statements and replace placeholders with real, current descriptions where evidence exists.

## Out Of Scope

The following are out of scope for Phase 15.1:

- code changes
- route changes
- service changes
- schema changes
- migration changes
- fixing TypeScript errors
- redesigning system behavior
- reopening verified phases
- cleanup beyond the already-approved Phase 14 outcome
- inventing new phases
- renaming existing phases
- altering locked business rules

Phase 15.1 updates documentation context only.

## Source Documents To Use

The AI context update must be based on current verified project evidence.

Required source documents and sources include:

- `docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md`
- `docs/ChatGPT/ver3/file_inventory.md`
- `docs/ChatGPT/ver3/system_snapshot.md`
- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/model_inventory.md`
- `docs/ChatGPT/ver3/migration_inventory.md`
- verified phase documents from Phase 10, Phase 11, Phase 12, Phase 13, and Phase 14
- current route registration and application structure
- current active models and services where needed for factual alignment

If a statement in `AI_CONTEXT.md` conflicts with verified phase documents or current inspected code, the verified phase and current inspected code take precedence.

## Required AI_CONTEXT Sections To Update

The updated `AI_CONTEXT.md` must include or correct the following sections:

### 1. System Overview

Must describe Jupiter as the current aircraft maintenance management system actually present in the repository.

### 2. Source Of Truth

Must clearly state that workpacks are not the source of truth.

Must reflect the current source-of-truth chain:

- Standard Tasks
- ADs
- SBs
- SIDs
- Applicability
- Templates

### 3. Core Domain Boundaries

Must clearly separate:

- master library
- applicability
- templates
- workpack generation
- execution
- documents
- planning
- customer visibility

### 4. Execution And Lifecycle Rules

Must describe the locked lifecycle model and execution invariants currently verified in Phase 10.

### 5. Snag System

Must describe the actual snag lifecycle and closure rules from Phase 11.

### 6. Document System

Must describe the actual CRS and CRMA document boundaries from Phase 12.

### 7. Planning System

Must describe the actual planning subsystem from Phase 13, including:

- planning is separate from execution
- planning session persistence
- planning states
- planning validation
- planning-to-workpack integrity
- planning metadata

### 8. Customer Visibility Boundary

Must describe the current customer-visibility design boundary defined in completed customer phases, without overstating unimplemented enforcement if not verified in code.

### 9. Technical Stack And Architecture

Must reflect the real current stack and structure actually present in the repository.

### 10. Current Known Repository Constraints

Must record current known repository-level limitations, including pre-existing compile-failure boundaries if they remain unresolved and are relevant to future work.

### 11. Documentation And Session Rules

Must align future AI use with:

- single-phase execution
- DEFINE -> IMPLEMENT -> VERIFY
- no drift
- no unapproved deletion
- verified phases treated as locked

## Locked Facts That Must Be Preserved

The following facts are locked and must not be altered in `AI_CONTEXT.md`:

- verified phases remain locked unless explicitly reopened
- Jupiter follows single-phase execution discipline
- workpacks are not the source of truth
- execution lifecycle rules from Phase 10 remain locked
- snag lifecycle and closure rules from Phase 11 remain locked
- audit integrity from Phase 12 remains locked
- planning integrity and planning-workpack separation from Phase 13 remain locked
- controlled cleanup outcome from Phase 14 remains locked
- only explicitly approved cleanup removals from Phase 14 may be reflected as removed

### Locked Execution Facts

The AI context must preserve the verified execution lifecycle and enforcement model, including certification and close controls.

### Locked Audit Facts

The AI context must preserve the audit system as a protected integrity boundary.

### Locked Planning Facts

The AI context must preserve:

- planning sessions are not workpacks
- planning validation is mandatory before readiness and generation
- generated workpacks are snapshots independent from later planning changes

### Locked Cleanup Facts

The AI context must preserve that Phase 14 cleanup was controlled and limited.

It must not imply broad cleanup or speculative removals.

## Old Assumptions That Must Be Removed Or Corrected

The updated `AI_CONTEXT.md` must remove or correct outdated assumptions such as:

- workpack module is incomplete if verified phases have already locked major behavior
- snag system is not properly implemented if later verified phases define and implement it
- planning is absent or undefined
- customer visibility is undefined where design phases already exist
- mixed ORM usage as a current architectural assumption if the actual active system context no longer depends on that wording
- “database to be filled later” placeholder language where schema inventory already exists
- outdated statements that imply execution rules are still undecided
- outdated statements that imply audit boundaries are still undefined
- outdated statements that imply cleanup has not happened when approved Phase 14 removals have already occurred

Old assumptions must not simply be deleted.

They must be replaced with verified current-state facts.

## Verification Requirements

The AI context update must be verified against current evidence.

Verification must confirm:

- `AI_CONTEXT.md` reflects current locked system behavior
- outdated assumptions were removed or corrected
- no locked lifecycle rules were changed in wording
- no locked audit rules were weakened
- no planning integrity rules were lost
- cleanup outcome from Phase 14 is reflected accurately and narrowly
- future AI session rules align with the master execution plan

Verification must be based on:

- current docs
- current inspected code structure
- current schema and inventories
- verified phase outputs

## Completion Criteria

Phase 15.1 is complete only when all of the following are true:

- `docs/ChatGPT/AI_CONTEXT.md` is identified as the target document
- required source documents are defined
- required sections to update are defined
- locked facts to preserve are defined
- outdated assumptions to remove or correct are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migrations were changed
- no TypeScript fixes were attempted

## Final Statement

Phase 15.1 defines the Jupiter AI context update as a documentation-only correction phase in which `docs/ChatGPT/AI_CONTEXT.md` must be rewritten to reflect the verified current system, remove outdated assumptions, preserve locked lifecycle, audit, planning, and cleanup facts, and provide an accurate future-session briefing aligned to the real repository state and the master execution plan.
