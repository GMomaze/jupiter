# Phase 13.1 - Planning Workflow

## Status

DEFINE ONLY

This phase defines the Jupiter planning workflow for scheduled maintenance preparation.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, audit, template, library, applicability, or lifecycle behavior established in Phase 10 through Phase 12.

## Purpose

The purpose of this phase is to define how users plan maintenance using aircraft context, maintenance type, master library content, applicability rules, and templates before workpack generation.

Planning is a pre-execution workflow.

It prepares candidate maintenance content for user review and final workpack generation.

## Planning Trigger

The planning workflow begins when:

- user selects aircraft
- user selects maintenance type

Examples of maintenance type include:

- `MPI`
- `100hr`
- `Annual`
- other scheduled maintenance classifications supported by planning policy

### Aircraft Selection

The selected aircraft is the operational target for planning.

It establishes the planning context for model-specific, aircraft-specific, and component-specific applicability resolution.

### Maintenance Type Selection

The selected maintenance type determines the planning intent.

It is used to identify the relevant templates and maintenance content for the planned maintenance event.

## Planning Inputs

The planning workflow must use the following inputs:

- aircraft
- aircraft model
- installed components
- maintenance type

### Aircraft

Aircraft identity is required so planning is tied to a real operational asset.

### Aircraft Model

Aircraft model is required because planning must evaluate model-level applicability and template compatibility.

### Installed Components

Installed components are required where component applicability influences whether maintenance content is relevant.

### Maintenance Type

Maintenance type is required so planning can identify the correct scheduled maintenance structure and candidate templates.

## System Behavior

The system behavior during planning is defined as follows:

- system evaluates applicability
- system selects relevant templates
- system prepares workpack candidates

### Applicability Evaluation

The system must evaluate applicability using the locked applicability model.

This includes determining which library items and template content are relevant to the selected:

- aircraft
- aircraft model
- installed components

Applicability evaluation is a planning filter only.

It does not trigger execution or lifecycle changes.

### Template Selection

The system must identify relevant templates for the selected maintenance type and aircraft context.

Template selection is driven by planning relevance, not execution state.

Templates remain reusable planning structures and do not become execution records.

### Workpack Candidate Preparation

The system must prepare workpack candidates from the relevant template and library content.

A workpack candidate is a proposed maintenance content set prepared for user review before final generation.

Candidate preparation may include:

- applicable standard tasks
- applicable AD content
- applicable SB content
- applicable SID content

This phase defines candidate preparation only.

It does not define automatic workpack creation without user review.

## User Interaction

The required user interaction is:

- user reviews suggested content
- user can add or remove items before generation

### Review of Suggested Content

The user must be able to inspect the proposed maintenance content before generation.

This review step is required so planning remains controlled and intentional.

### Add or Remove Content

Before generation, the user may refine the candidate content by:

- adding relevant items
- removing unwanted items

This editing step applies to planning selection only.

It does not alter the underlying master library, template definitions, or applicability model.

## Output

The planning workflow output is:

- finalized workpack generated from selected content

The generated workpack is the operational result of the planning workflow after user review and selection are complete.

The workpack becomes a standalone execution entity under the already-locked workpack lifecycle.

## Invariants

The following invariants are locked for the planning workflow:

- no automatic execution
- no lifecycle changes
- no audit changes

### No Automatic Execution

Planning must not automatically:

- start a workpack
- start a task
- create in-progress execution state
- certify any task or workpack
- close any task or workpack

Planning prepares and finalizes content only.

### No Lifecycle Changes

This phase does not change:

- workpack lifecycle
- task lifecycle
- snag lifecycle

Planning must operate within the existing lifecycle framework established in earlier phases.

### No Audit Changes

This phase does not redefine audit structure, audit capture, audit UI behavior, or audit write logic.

## Boundary

This phase defines the planning workflow only.

It does not define:

- execution logic
- certification logic
- close logic
- lifecycle redesign
- schema implementation

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 13.1 defines Jupiter planning as a controlled pre-execution workflow where a user selects an aircraft and maintenance type, the system evaluates applicability and relevant templates, prepares workpack candidates, the user reviews and adjusts suggested content, and a finalized workpack is then generated without changing execution, lifecycle, or audit behavior.
