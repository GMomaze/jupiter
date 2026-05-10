# Phase 13.2 - Planning Persistence

## Status

DEFINE ONLY

This phase defines how Jupiter planning sessions may be saved, resumed, and finalized later.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, audit, template, library, applicability, planning, or lifecycle behavior established in Phase 10 through Phase 13.1.

## Purpose

The purpose of this phase is to allow maintenance planning to be paused and continued without immediately generating a workpack.

Planning persistence supports controlled work-in-progress planning before final generation.

## Planning Session Definition

A planning session is defined as:

- a work-in-progress maintenance plan
- is not a workpack
- not yet a workpack
- exists before workpack generation

### Work-In-Progress Plan

A planning session holds an unfinished planning state while the user is still reviewing, refining, or preparing maintenance content.

It exists before workpack generation.

### Not a Workpack

A planning session must not be treated as an operational workpack.

It is a planning artifact only.

It does not enter the workpack lifecycle and does not behave as an execution record.

## Save Behavior

The planning workflow must support the following save behavior:

- user can save planning state at any time
- saved state includes:
  - selected aircraft
  - maintenance type
  - candidate content
  - user modifications

### Save Versioning Behavior

A planning session may be saved multiple times during its lifecycle.

The system must define how successive saves are handled.

For Phase 13.2, the following rule applies:

- the latest save overwrites the previous saved state

Only the most recent saved state is retained as the active planning session state.

Historical version tracking is not required in this phase and may be introduced in a future phase if needed.

This ensures a simple and predictable save/resume behavior for planning sessions.

### Save Planning State At Any Time

The user must be able to save planning progress without generating a workpack.

This allows planning to be paused and resumed later.

### Saved Aircraft Selection

The saved planning state must retain the selected aircraft.

This preserves the asset context for future resume.

### Saved Maintenance Type

The saved planning state must retain the selected maintenance type.

This preserves the planning intent and candidate selection context.

### Saved Candidate Content

The saved planning state must retain the candidate content prepared during planning.

This includes the proposed maintenance items under review at the time of save.

### Saved User Modifications

The saved planning state must retain user modifications made during planning.

This includes:

- items the user kept
- items the user removed
- items the user added within the planning workflow
- items the user removed within the planning workflow

This ensures resumed planning reflects the last intentional user state.

## Resume Behavior

The planning workflow must support the following resume behavior:

- user can reopen a saved planning session
- system restores previous state

### Reopen Saved Planning Session

The user must be able to return to a previously saved planning session.

Resume must reopen the planning session as a planning artifact, not as a generated workpack.

### Restore Previous State

When a saved planning session is resumed, the system must restore the prior saved state, including:

- selected aircraft
- maintenance type
- candidate content
- prior user modifications

Resume must return the user to the full same planning state exactly as it was intentionally saved.

## Finalize Behavior

The planning workflow must support the following finalize behavior:

- user completes planning
- system generates workpack using existing generation logic
- planning session becomes read-only or closed after generation

### User Completes Planning

Finalization occurs only when the user explicitly completes the planning session.

The planning session remains editable until that confirmation step.

### Generate Workpack Using Existing Logic

When finalized, the system must generate the workpack using the existing workpack generation logic already established in earlier phases.

This phase does not introduce a new generation model.

It only defines that finalization is the boundary between saved planning state and actual workpack creation.

### Planning Session Closed After Generation

Once a planning session has been finalized into a workpack, the planning session must no longer remain an editable active planning record.

After generation, the planning session must become:

- read-only
- closed

This prevents ambiguity between an in-progress planning artifact and an already-finalized generation outcome.

## Session Scope

Planning session scope is defined as follows:

- planning sessions are user-owned
- planning sessions are tied to aircraft

### User-Owned Sessions

Each planning session must have a clear owning user.

This phase explicitly defines planning sessions as user-owned, not team-shared by default.

Any broader team visibility or collaboration model is outside the scope of this phase unless explicitly defined in a future phase.

### Aircraft-Tied Sessions

Each planning session must remain tied to the selected aircraft.

The aircraft linkage is part of the saved planning context and must be preserved across save, resume, and finalization.

## Invariants

The following invariants are locked for planning persistence:

- planning session is not a workpack
- no lifecycle changes
- no audit changes
- no execution triggered
- no certification triggered

### Planning Session Is Not a Workpack

Saved planning data must remain distinct from operational workpack records until final generation occurs.

### No Lifecycle Changes

This phase does not change:

- workpack lifecycle
- task lifecycle
- snag lifecycle

Planning persistence must remain outside the lifecycle system.

### No Audit Changes

This phase does not redefine audit structure, audit immutability, audit UI behavior, or audit write logic.

### No Execution Triggered

Saving or resuming a planning session must not automatically:

- create execution state
- start a workpack
- start a task
- certify anything
- close anything

Execution begins only through the already-defined operational lifecycle after workpack generation.

### No Certification Triggered

Saving, resuming, or finalizing a planning session must not automatically:

- certify any task
- certify any workpack

Certification remains an explicit later operational action under the locked lifecycle rules.

## Relationship to Planning Workflow

Planning persistence extends the planning workflow by allowing planning progress to be stored between sessions.

It does not change how applicability is evaluated, how candidate content is reviewed, or how finalized content is ultimately generated into a workpack.

## Non-Goals

This phase explicitly does not include:

- execution logic
- lifecycle changes
- schema design

More specifically, this phase does not:

- change workpack lifecycle rules
- change task lifecycle rules
- change snag lifecycle rules
- define database schema
- define persistence implementation details
- define execution controls
- define certification controls
- redefine generation logic

## Final Statement

Phase 13.2 defines Jupiter planning persistence as the ability to save and resume a work-in-progress planning session that retains aircraft selection, maintenance type, candidate content, and user modifications, while remaining separate from workpacks until the user explicitly finalizes planning and invokes the existing workpack generation logic.
