# Phase 12.5 - Template System Foundation

## Status

DEFINE ONLY

This phase defines the foundational template system for Jupiter.

This phase does not implement code, change schema, alter execution behavior, or modify any lifecycle, snag, audit, library, or applicability behavior established in earlier phases.

## Purpose

The purpose of this phase is to define reusable maintenance templates that group master library items into operationally useful maintenance structures.

Templates are planning constructs that organize maintenance content for later workpack generation.

## Template Role

Templates serve the following role in Jupiter:

- templates group library items into structured maintenance packages
- templates do not execute work
- templates do not define lifecycle

### Grouping Function

A template is a reusable planning structure that assembles related maintenance content into a coherent operational package.

This allows planning users to work from organized maintenance groupings rather than manually rebuilding the same content repeatedly.

### No Execution Role

Templates are not execution records.

They do not represent live operational work and are not themselves worked, certified, resolved, or closed.

### No Lifecycle Role

Templates do not define or modify lifecycle behavior.

They do not create new lifecycle states and do not override the locked workpack, task, or snag lifecycle rules.

## Template Contents

Templates may include:

- ADs
- SBs
- SIDs
- standard tasks

These content types may be grouped together when operationally appropriate.

A template may include one or more of these categories depending on planning needs.

## Relationship to the Master Library

The relationship between templates and the master library is defined as follows:

- templates reference library items
- templates do not duplicate library content

### Reference Model

Templates are built by referencing reusable master library items.

They are consumers of library content, not owners of the underlying maintenance definitions.

### No Library Duplication

Templates must not become a second source of truth for the maintenance content itself.

The underlying AD, SB, SID, and standard task definitions remain owned by the master library.

Templates may organize those items, but they do not replace or duplicate the library as the canonical maintenance content source.

## Usage

Templates are used during:

- workpack planning
- workpack content generation

### Workpack Planning

Templates are planning tools that help users assemble maintenance content efficiently and consistently before execution begins.

They support repeatable workpack definition without requiring manual recreation of recurring maintenance packages.

### Workpack Generation

Templates generate workpack tasks and related content.

This means templates contribute structured maintenance content into workpack planning outputs, but the workpack remains the operational execution container.

## Invariants

The following invariants are locked for the template system foundation:

- templates do not affect execution lifecycle
- templates do not affect audit
- templates do not alter library data

### No Execution Lifecycle Effect

Templates have no authority over:

- workpack lifecycle
- task lifecycle
- snag lifecycle
- certification flow
- close flow

Templates may influence what content is planned, but not how operational lifecycle transitions behave.

### No Audit Effect

This phase does not change audit capture, audit immutability, audit structure, or audit UI behavior.

Templates are defined here only as planning structures, not as an audit-system change.

### No Library Mutation

Templates do not rewrite, mutate, or redefine the underlying library records they reference.

The master library remains the source of truth, and templates remain organizational consumers of that content.

## Boundary

This phase establishes the template system foundation only.

It does not define:

- execution behavior
- workpack execution logic
- certification behavior
- close behavior
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
- define persistence implementation
- define execution controls
- change audit write behavior
- change audit UI behavior

## Final Statement

Phase 12.5 defines Jupiter templates as reusable planning structures that group AD, SB, SID, and standard task library items into structured maintenance packages for workpack planning and generation, while keeping templates separate from execution, lifecycle control, audit behavior, and master library ownership of maintenance content.
