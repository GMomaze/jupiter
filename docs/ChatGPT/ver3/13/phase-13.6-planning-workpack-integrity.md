# Phase 13.6 - Planning -> Workpack Integrity

## Status

DEFINE ONLY

This phase defines planning-to-workpack integrity rules for Jupiter.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, audit, template, library, applicability, planning, persistence, visibility, validation, status-management, or lifecycle behavior established in Phase 10 through Phase 13.5.

## Purpose

The purpose of this phase is to ensure that a generated workpack is fully independent from the planning session that produced it.

Planning is the source of generation input.

The generated workpack is the standalone operational output.

## Snapshot Rule

The following snapshot rule is mandatory:

- workpack generation creates a snapshot of planning data
- no live link exists between planning session and workpack

### Snapshot Of Planning Data

When a workpack is generated from a planning session, the system must create an operational snapshot of the selected planning content at that point in time.

That snapshot is the basis of the generated workpack content.

The workpack must represent the selected and validated planning result as it existed at generation time.

### No Live Link

After generation, the workpack must not remain behaviorally linked to the planning session.

The planning session may remain available for visibility or traceability, but it must not continue to act as a live controller of workpack content or behavior.

## Independence

The following independence rules are mandatory:

- changes to planning session after generation must not affect the workpack
- changes to templates or library data must not affect existing workpacks

### Planning Session Changes Do Not Affect Workpack

If a planning session is viewed, reopened for reference, or otherwise changed after a workpack has already been generated, those changes must not mutate, recalculate, or redefine the generated workpack.

The generated workpack remains fixed as the operational result of the earlier generation event.

### Template Or Library Changes Do Not Affect Existing Workpacks

If templates, applicability rules, or master library items are changed after generation, those later changes must not retroactively alter already-generated workpacks.

Existing workpacks are operational records, not live mirrors of evolving planning content.

## Data Ownership

The following data ownership rules are mandatory:

- workpack owns its task content after generation
- planning session retains planning data only

### Workpack Owns Generated Task Content

After generation, the workpack owns the operational task and content records created for execution.

This includes the generated workpack task set and all downstream execution-related data that belongs to the workpack context.

### Planning Session Retains Planning Data Only

The planning session retains only planning-state information such as candidate content, user selection state, and planning history relevant to the planning workflow.

It does not own the operational execution records produced in the generated workpack.

## Constraints

The following constraints are mandatory:

- planning session cannot modify generated workpack
- workpack cannot reference planning session for execution logic

### Planning Session Cannot Modify Generated Workpack

Once generation is complete, the planning session must have no authority to add, remove, update, or restructure content inside the generated workpack.

Any later operational changes to the workpack must occur within the workpack domain under the already-locked operational rules.

### Workpack Cannot Depend On Planning Session For Execution Logic

The generated workpack must not rely on the planning session for:

- execution state decisions
- task state decisions
- certification behavior
- close behavior
- runtime applicability resolution

Execution logic belongs entirely to the workpack and the existing operational lifecycle model.

## Invariants

The following invariants are locked:

- no lifecycle changes
- no audit changes
- no execution triggered by planning changes

### No Lifecycle Changes

This phase does not change:

- workpack lifecycle
- task lifecycle
- snag lifecycle

Planning-to-workpack integrity must preserve the already-locked lifecycle framework.

### No Audit Changes

This phase does not redefine audit structure, audit capture, audit UI behavior, or audit write logic.

### No Execution Triggered By Planning Changes

Changes to planning sessions after generation must not automatically:

- start a workpack
- start a task
- certify anything
- close anything
- alter generated execution state

Planning remains separate from live execution behavior.

## Boundary

This phase defines integrity rules between planning sessions and generated workpacks only.

It does not define:

- execution logic
- certification logic
- close logic
- schema implementation
- new lifecycle models

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 13.6 defines Jupiter planning-to-workpack integrity as a strict snapshot model in which workpack generation creates an independent operational copy of validated planning content, planning sessions and evolving template or library data cannot retroactively affect existing workpacks, workpacks own their execution content after generation, and no lifecycle, audit, or execution behavior is changed by later planning activity.
