# Phase 12.6 - Workpack Generation from Templates

## Status

DEFINE ONLY

This phase defines how Jupiter generates workpacks from templates.

This phase does not implement code, change schema, alter execution behavior, or modify any locked lifecycle, snag, audit, library, applicability, or template-system behavior established in earlier phases.

## Purpose

The purpose of this phase is to define the controlled generation path by which reusable templates become new operational workpacks.

Template generation is the boundary where planning structures are transformed into workpack-owned operational content.

## Generation Process

The workpack generation process is defined as follows:

- user selects template
- system generates a new workpack
- workpack is populated with tasks and related content derived from the template

### User Selects Template

Generation begins when a user explicitly selects a reusable template for a valid planning context.

Template selection is a planning action, not an execution action.

### System Generates a New Workpack

Once a valid template is selected, the system generates a new workpack as a distinct operational record.

The generated workpack becomes its own execution container within the locked workpack lifecycle.

### Workpack Populated From Template

The generated workpack must be populated with workpack content derived from the selected template.

This includes the template-defined maintenance structure and the resolved maintenance items that are relevant for that generation context.

## Independence From Template After Generation

The following independence rules are mandatory:

- generated workpack must not remain linked to template for behavior
- template changes must not affect existing workpacks

### No Behavioral Dependency

After generation, the workpack must behave as an independent operational record.

The template may be the origin of the workpack content, but it must not remain the live behavioral controller of that workpack.

### No Retroactive Template Effect

If a template is edited after a workpack has already been generated, those later template changes must not mutate or redefine the already-generated workpack.

Generated workpacks are operational snapshots, not live mirrors of the template.

## Data Handling

The following data handling rules are mandatory:

- template references are converted into workpack tasks and related content
- workpack owns its execution data

### Conversion of Template References

Templates reference reusable library items and planning structure.

During generation, those references must be converted into workpack-owned tasks and related planning content suitable for operational use.

The resulting workpack content is the generated operational form of the selected template, not a continued live reference for execution behavior.

### Workpack Ownership of Execution Data

Once generated, the workpack owns its own operational execution data.

This includes all downstream work performed against:

- workpack task state
- task notes
- measurements
- execution records
- certification actions
- close actions

Execution data belongs to the workpack context, not the template context.

## Applicability Usage

Template generation must respect applicability rules.

Only relevant library items may be included in the generated workpack.

### Applicability Enforcement

When generating from a template, the system must resolve applicability using the locked applicability model.

Generation must include only content relevant to the selected operational context.

### Relevant Content Only

If a referenced item is not applicable to the aircraft, model, or component context of the generation target, it must not be included in the generated workpack output.

This ensures workpack generation remains valid, targeted, and operationally correct.

## Invariants

The following invariants are locked for template-driven workpack generation:

- no lifecycle changes
- no automatic execution
- no automatic certification
- no audit changes

### No Lifecycle Changes

Generation does not change the locked lifecycle definitions for:

- workpacks
- tasks
- snags

Generated workpacks enter the operational system under the existing lifecycle model only.

### No Automatic Execution

Generation must not automatically:

- start a workpack
- start a task
- create in-progress execution state
- mark tasks complete

Generation creates planning content only.

### No Automatic Certification

Generation must not automatically:

- certify tasks
- certify workpacks
- close tasks
- close workpacks

Certification and close remain explicit operational actions governed by the locked lifecycle rules.

### No Audit Changes

This phase does not redefine audit structure, audit immutability, audit UI behavior, or audit writing rules.

## Boundary

This phase defines workpack generation behavior only at the planning-to-workpack boundary.

It does not define:

- execution behavior
- task execution rules
- certification rules
- close rules
- lifecycle redesign
- schema implementation

Those concerns remain outside the scope of this phase.

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
- change audit generation logic

## Final Statement

Phase 12.6 defines Jupiter workpack generation as an explicit planning process where a user selects a template, the system creates a new independent workpack, template references are converted into workpack-owned tasks and content, applicability rules determine what is included, and no execution, certification, lifecycle, or audit behavior is automatically changed.
