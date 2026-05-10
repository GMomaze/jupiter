# Phase 15.2 - Update Workflows

## Status

DEFINE ONLY

This phase defines and locks the canonical Jupiter operational workflow chain.

This phase does not implement code, does not modify schema, does not change migrations, does not fix TypeScript errors, does not refactor application behavior, and does not invent new workflows.

This phase documents the verified current workflow only.

## Purpose

The purpose of this phase is to define the canonical Jupiter operational workflow chain and lock it as the correct end-to-end system flow.

The canonical workflow is:

- import
- applicability
- template
- workpack
- execute
- certify

This phase ensures that future documentation, implementation, and verification work remain aligned to the verified current Jupiter operating model.

## Scope

This phase covers definition of:

- the canonical workflow stages
- source-of-truth ownership at each stage
- the separation between planning and workpacks
- execution boundaries
- certification boundaries
- document-generation boundaries
- workflow invariants that must remain locked

This phase applies to the verified operational flow already established across the completed phases.

## Out Of Scope

The following are out of scope for Phase 15.2:

- code changes
- schema changes
- migration changes
- TypeScript fixes
- route changes
- lifecycle redesign
- certification redesign
- planning redesign
- audit redesign
- cleanup changes
- customer portal redesign
- inventing new workflow stages not already verified

This phase defines workflow only.

## Canonical Workflow Stages

The canonical Jupiter operational workflow chain is:

- import
- applicability
- template
- workpack
- execute
- certify

### 1. Import

Import is the controlled intake stage for master maintenance data.

This stage covers the loading and maintenance of source maintenance content such as:

- standard tasks
- airworthiness directives
- service bulletins
- supplemental inspection documents

Import is an upstream source-maintenance stage.

It is not execution.

It is not workpack activity.

### 2. Applicability

Applicability is the stage where source maintenance content is matched to the relevant aircraft, model, configuration, component, or operational context.

Applicability determines what content is relevant.

Applicability does not create execution state.

Applicability does not certify anything.

### 3. Template

Template is the stage where applicable source content is organized into reusable maintenance structure for operational preparation.

Templates define the reusable maintenance composition used before workpack creation.

Templates are upstream from execution.

Templates are not workpacks.

### 4. Workpack

Workpack is the operational snapshot stage.

A workpack is created from upstream prepared content and becomes the operational unit used for execution.

Workpacks are snapshots of prepared maintenance content at generation time.

Workpacks are not the source of truth.

### 5. Execute

Execution is the operational performance stage where workpack tasks and snag activity are performed inside the locked execution lifecycle.

Execution occurs only inside workpack-controlled operational state.

Execution does not redefine imported source content, applicability logic, or template truth.

### 6. Certify

Certification is the controlled release and signoff stage after execution satisfies the locked operational rules.

Certification is downstream of execution.

Certification does not rewrite the upstream source-of-truth chain.

Certification does not change planning into execution.

## Source-Of-Truth Ownership At Each Stage

Source-of-truth ownership is locked by stage.

### Import Owns Master Maintenance Content

The source of truth for master maintenance content exists in the imported and maintained master data domain, including:

- standard task content
- `AD` content
- `SB` content
- `SID` content

This is upstream truth.

### Applicability Owns Relevance Determination

Applicability owns the determination of whether imported source content applies to a given aircraft or context.

Applicability decides relevance.

It does not become execution state.

### Template Owns Reusable Maintenance Composition

Templates own the reusable maintenance structure assembled from applicable source content.

Templates remain upstream preparation artifacts.

They are not execution records.

### Planning Owns Pre-Execution Session Preparation

Where planning is used, planning sessions own pre-execution planning preparation only.

Planning sessions are not workpacks.

Planning sessions do not become execution state until generation creates a workpack snapshot.

### Workpack Owns Operational Snapshot State

Workpacks own the generated operational snapshot used for execution.

A workpack is a controlled operational instance derived from upstream content.

It is not the authoritative master source of truth.

### Execution Owns Performance State

Execution owns operational performance state such as:

- workpack execution status
- task execution status
- work performed
- certification preparation state
- snag operational handling
- compliance completion state inside the workpack context

Execution state is operational state only.

### Certification Owns Release Signoff State

Certification owns the operational release and signoff boundary after execution completes according to locked rules.

Certification does not replace import, applicability, or template truth.

### Document Generation Owns Read-Only Release Output

Document generation owns the rendering of release documents from stored eligible operational data.

Document generation does not own lifecycle state.

Document generation does not own execution state.

## Planning / Workpack Separation

Planning and workpacks must remain separate.

### Planning Sessions Are Not Workpacks

Planning sessions are planning-only records.

They are not operational workpacks.

They do not execute work.

They do not start lifecycle activity.

### Workpack Generation Creates The Boundary

The boundary between planning and operations is workpack generation.

Generation creates the operational workpack from validated planning or prepared upstream content.

### Workpacks Are Snapshots

Generated workpacks are snapshots.

They are independent from later planning-session changes.

They are independent from later template or library changes after generation.

### No Live Planning-To-Execution Behavior Link

Planning must not remain live-linked to operational execution behavior after workpack generation.

Planning integrity and workpack operational integrity remain separate.

## Execution Boundaries

Execution boundaries remain locked.

### Execution Starts Only Inside Operational Workpack Context

Execution begins only through the operational workpack/task lifecycle.

Import, applicability, template, and planning stages do not themselves start execution.

### Execution Lifecycle Remains Locked

The verified execution lifecycle remains locked.

This includes:

- workpack lifecycle rules
- task lifecycle rules
- snag lifecycle rules already established in their own phases

### CLOSED Workpacks Remain Immutable

`CLOSED` workpacks remain immutable.

They must not return to active execution behavior.

They must not expose active execution actions.

### Execution Does Not Rewrite Upstream Truth

Execution must not rewrite:

- imported master data
- applicability truth
- template truth
- planning-session history

Execution is downstream operational activity only.

## Certification Boundaries

Certification boundaries remain locked.

### Certification Is Downstream Of Execution

Certification occurs only after the required operational execution conditions are satisfied.

Certification is not a substitute for execution.

### Certification Rules Remain Locked

The verified certification rules remain locked.

This includes the existing task and workpack certification boundaries already defined in earlier phases.

### Certification Does Not Reopen CLOSED State

Certification does not permit a `CLOSED` workpack to re-enter mutable execution behavior.

### Certification Does Not Change Source Ownership

Certification does not transform workpacks into source-of-truth artifacts.

Certification remains an operational signoff boundary only.

## Document-Generation Boundaries

Document generation remains a downstream read-only activity.

### CRS Generation Remains Read-Only

`CRS` generation remains read-only.

It must not change:

- lifecycle
- execution
- compliance
- snags

### CRS Uses Eligible Stored Data Only

`CRS` generation uses stored eligible operational data only, according to the locked document-system rules.

It is not a recalculation or state-mutation step.

### CRMA Remains Separate From CRS

`CRMA` remains a separate optional document for limited maintenance-action scope where applicable.

It does not replace `CRS`.

### Document Generation Is Not Workflow Control

Document generation must not act as a lifecycle transition or execution control step.

It is document output only.

## Locked Invariants

The following invariants are locked and must be preserved:

- workpacks are snapshots, not source-of-truth
- planning sessions are not workpacks
- execution lifecycle remains locked
- certification rules remain locked
- `CLOSED` workpacks remain immutable
- `CRS` generation remains read-only
- audit integrity remains protected
- planning/workpack separation remains protected

### Workpacks Are Not Source-Of-Truth

Workpacks remain downstream operational artifacts derived from upstream source content.

### Planning Sessions Are Not Workpacks

Planning must remain pre-execution and separate from operational workpack state.

### Locked Lifecycle Remains In Force

No workflow update may weaken or redefine the verified execution lifecycle.

### Locked Certification Remains In Force

No workflow update may weaken or redefine verified certification boundaries.

### CLOSED Immutability Remains In Force

No workflow update may imply that `CLOSED` workpacks are mutable or operationally reopenable by normal workflow behavior.

### CRS Read-Only Rule Remains In Force

No workflow update may imply that `CRS` generation changes system state.

## Workflow Anti-Patterns That Must Not Return

The following anti-patterns must not return:

- treating workpacks as the source of truth
- treating planning sessions as workpacks
- allowing planning to trigger execution automatically
- allowing execution to rewrite upstream source content
- allowing lifecycle drift outside locked rules
- allowing certification to bypass execution rules
- allowing `CLOSED` workpacks to behave as mutable operational records
- allowing document generation to act as workflow control
- allowing `CRS` generation to mutate lifecycle or execution state

### Workpack-As-Truth Anti-Pattern

The system must not drift back to a model where workpacks become the authoritative maintenance source.

### Planning-As-Execution Anti-Pattern

Planning must not be treated as a hidden execution path or operational lifecycle surrogate.

### Document-As-State-Change Anti-Pattern

Release document generation must not be treated as a mutation step.

### Lifecycle Drift Anti-Pattern

Workflow updates must not silently bypass or weaken verified lifecycle controls.

## Verification Requirements

Phase 15.2 workflow definition must be verified against the current locked Jupiter system.

Verification must confirm:

- the canonical workflow chain is exactly:
  - import
  - applicability
  - template
  - workpack
  - execute
  - certify
- source-of-truth ownership is clearly separated by stage
- planning/workpack separation is preserved
- execution boundaries remain aligned to locked lifecycle behavior
- certification boundaries remain aligned to locked certification behavior
- document-generation boundaries preserve read-only `CRS` behavior
- no anti-pattern reintroduces old assumptions

Verification sources must include:

- the master execution plan
- the current AI context
- verified Phase 10 through Phase 14 documentation
- current system snapshot and repository inventories where needed for alignment

## Completion Criteria

Phase 15.2 is complete only when all of the following are true:

- the workflow purpose is defined
- workflow scope is defined
- out-of-scope items are defined
- the canonical workflow stages are defined
- source-of-truth ownership is defined by stage
- planning/workpack separation is defined
- execution boundaries are defined
- certification boundaries are defined
- document-generation boundaries are defined
- locked invariants are defined
- prohibited workflow anti-patterns are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migrations were changed
- no TypeScript fixes were attempted

## Final Statement

Phase 15.2 defines and locks the canonical Jupiter operational workflow as `import -> applicability -> template -> workpack -> execute -> certify`, preserves upstream source-of-truth ownership outside the workpack, preserves planning/workpack separation, preserves locked execution and certification boundaries, preserves `CLOSED` immutability, and preserves read-only `CRS` generation as downstream document output only.
