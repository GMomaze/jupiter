# Phase 12.4 - Applicability Model

## Status

DEFINE ONLY

This phase defines the applicability model for Jupiter master library items.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, audit, or lifecycle logic established in earlier phases.

## Purpose

The purpose of this phase is to define how master library items determine where they apply in the maintenance domain.

Applicability is the mechanism that decides whether a library item is relevant to a specific aircraft, aircraft model, or component context.

## Applicability Targets

Library item applicability must support the following target types:

- aircraft
- aircraft model
- component

These are the required applicability targets for the master library foundation.

### Aircraft

An item may apply to a specific aircraft.

This supports maintenance content that is tied to an individual tail, serialised asset, or aircraft-specific operational condition.

### Aircraft Model

An item may apply to an aircraft model.

This supports reusable maintenance content that is valid across all aircraft of the same model type.

### Component

An item may apply to a component.

This supports maintenance content that is relevant only when a particular component or component class is installed, tracked, or under maintenance consideration.

## Applicability Rules

The applicability model must support the following rules:

- a library item may apply to one or more targets
- a library item may be global

### One or More Targets

A single library item may be associated with multiple applicability targets where operationally required.

Examples:

- an item may apply to multiple aircraft
- an item may apply to multiple models
- an item may apply to multiple component contexts
- an item may combine model and component applicability

### Global Applicability

A library item may be marked as global.

Global means the item applies to all relevant operational contexts unless a more specific applicability resolution applies.

Global applicability is the least specific level in the applicability hierarchy.

## Resolution Hierarchy

When more than one applicability level could apply, the resolution hierarchy is:

- aircraft-specific overrides all
- component-specific overrides model
- model overrides global

Expressed as specificity order from highest to lowest:

1. aircraft-specific
2. component-specific
3. model-specific
4. global

### Aircraft-Specific Override

Aircraft-specific applicability is the highest-priority applicability resolution.

If a library item is targeted to a specific aircraft, that applicability must take precedence over model, component, and global matching.

### Component-Specific Override

Component-specific applicability overrides model-level applicability.

This ensures component-driven maintenance content is treated as more specific than a general model-level rule.

### Model Override

Model-level applicability overrides global applicability.

This ensures model-specific maintenance content takes precedence over content that applies to all contexts.

### Global Fallback

Global applicability is the default fallback when no more specific applicability rule is present.

## Usage

Applicability is used during:

- template creation
- workpack planning

Applicability is not used to alter execution lifecycle behavior.

### Template Creation

Applicability must be usable when selecting, composing, or validating the library content used to build templates.

This allows template definitions to be grounded in relevant maintenance content for the intended aircraft, model, or component context.

### Workpack Planning

Applicability must be usable when planning or generating workpacks from maintenance content.

This allows planning workflows to determine which library items are relevant before execution begins.

### No Execution Lifecycle Effect

Applicability does not affect:

- task execution state
- snag execution state
- workpack lifecycle state
- certification flow
- close flow

Applicability is a planning and content-selection concern only.

## Invariants

The following invariants are locked for the applicability model:

- applicability does not change library content
- applicability does not alter workpack lifecycle
- applicability does not trigger automatic actions

### Does Not Change Library Content

Applicability determines where a library item is relevant.

It does not rewrite, mutate, or redefine the underlying maintenance content of the library item itself.

### Does Not Alter Workpack Lifecycle

Applicability has no authority over workpack lifecycle state.

It must not introduce, block, bypass, or modify lifecycle transitions.

### Does Not Trigger Automatic Actions

Applicability by itself must not:

- auto-create workpacks
- auto-create tasks
- auto-certify anything
- auto-close anything
- auto-start execution

Applicability may inform planning decisions, but it is not an execution trigger.

## Relationship to Master Library

Applicability is part of how library items are resolved and consumed.

It does not replace the library as the maintenance content source of truth.

The master library remains the canonical content source, while applicability determines the relevant scope of that content.

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
- define execution behavior
- define audit behavior changes

## Final Statement

Phase 12.4 defines the Jupiter applicability model as a reusable targeting and resolution system for library items across aircraft, model, component, and global scopes, with specificity resolved by aircraft over component over model over global, used for template creation and workpack planning only, and without introducing execution, lifecycle, schema, or automatic-action changes.
