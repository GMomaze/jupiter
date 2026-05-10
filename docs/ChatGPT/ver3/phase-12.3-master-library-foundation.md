# Phase 12.3 - Master Library Foundation

## Status

DEFINE ONLY

This phase defines the foundational structure of the Jupiter master library for maintenance content.

This phase does not implement code, change schema, alter execution behavior, or modify any lifecycle, snag, audit, or workpack logic established in earlier phases.

## Purpose

The purpose of this phase is to establish a central, reusable maintenance content library that exists independently from operational workpacks.

The master library is the controlled repository of reusable maintenance source content that workpacks and templates consume.

## Library Scope

The master library scope includes the following maintenance content categories:

- Airworthiness Directives (`AD`)
- Service Bulletins (`SB`)
- Supplemental Inspection Documents (`SID`)
- Standard Task Templates

These categories form the baseline maintenance knowledge set that Jupiter must manage centrally.

## Separation From Workpacks

The master library is independent of workpacks.

This separation is mandatory.

The rule is:

- library defines reusable maintenance content
- workpacks consume library content
- workpacks do not define the library

This means a workpack is an operational execution container, while the library is the source repository of reusable maintenance definitions.

## Core Entities

The master library must be built around reusable library records.

Each library record must be designed to support repeated operational use without being recreated per workpack.

Core entity expectations:

- library records must be reusable
- library records must support applicability

### Reusable Records

A library item must be created once as controlled maintenance content and then referenced many times across planning, generation, and execution contexts as applicable.

Examples include:

- an AD record reused across multiple affected aircraft
- an SB record reused whenever applicable
- a SID record reused for recurring inspection needs
- a standard task template reused across multiple workpacks

### Applicability Support

Library records must support applicability so the system can determine whether a record is relevant in a given maintenance context.

Applicability must support:

- aircraft
- model
- component

This phase defines the requirement only. It does not define the final storage design or applicability resolution algorithm.

## Invariants

The following invariants are locked for the master library foundation:

- library data must not depend on workpack state
- library must be the source of truth for maintenance content

### Library Independent of Workpack State

Library records must remain valid and structurally independent regardless of whether a workpack is:

- `DRAFT`
- `ISSUED`
- `IN_PROGRESS`
- `CERTIFIED`
- `CLOSED`

Workpack state must not redefine, mutate, or control the existence of library content.

### Source of Truth

The master library must be treated as the authoritative maintenance content source for planning and template usage.

Operational workpacks may copy, reference, or consume that content, but they do not replace the library as the canonical maintenance definition source.

## Relationship Model

The relationship between the library and the operational system is defined as follows:

- workpacks reference library items
- templates reference library items

### Workpacks Reference Library Items

A workpack may include tasks, ADs, SBs, SIDs, or template-derived content that originated from the library.

The workpack remains an execution container and must not become the ownership source of the underlying library definition.

### Templates Reference Library Items

Templates may be constructed from, linked to, or otherwise driven by master library records.

This allows the planning system to assemble reusable operational structures from centrally managed maintenance content.

## Library Boundary

This phase establishes the library foundation only.

It does not define:

- execution behavior
- workpack generation mechanics
- certification behavior
- close behavior
- recurrence logic
- audit behavior

Those concerns remain outside the scope of the master library foundation.

## Non-Goals

This phase explicitly does not include:

- execution logic
- lifecycle changes
- audit changes

More specifically, this phase does not:

- change workpack lifecycle rules
- change task lifecycle rules
- change snag lifecycle rules
- introduce execution workflows
- introduce certification workflows
- change audit capture or audit UI behavior
- define schema implementation details

## Final Statement

Phase 12.3 defines Jupiter’s master library as the independent, reusable, applicability-aware source of truth for AD, SB, SID, and standard task template content, with workpacks and templates consuming that library rather than defining it, and without introducing execution, lifecycle, or audit changes.
