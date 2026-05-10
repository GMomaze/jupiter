# Phase 13.3 - Multi-Session Visibility

## Status

DEFINE ONLY

This phase defines how Jupiter exposes multiple planning sessions for user visibility and management.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, audit, template, library, applicability, planning, persistence, or lifecycle behavior established in Phase 10 through Phase 13.2.

## Purpose

The purpose of this phase is to allow users to view and manage multiple planning sessions without confusing those sessions with operational workpacks.

Multi-session visibility is a planning-management concern only.

## Session Listing

The system must allow:

- user can view all their planning sessions

Each listed session must show:

- aircraft
- maintenance type
- status
- last updated timestamp

### User Session List

Each user must be able to access a list of their planning sessions from the planning workflow context.

This list is the primary visibility surface for saved planning work.

### Aircraft Display

Each session entry must clearly identify the aircraft associated with the planning session.

### Maintenance Type Display

Each session entry must clearly identify the maintenance type associated with the planning session.

### Status Display

Each session entry must clearly show whether the session is still active planning work or already finalized.

### Last Updated Timestamp

Each session entry must show the most recent update timestamp so the user can understand recency and identify the latest active work.

## Session States

The planning session states are defined as:

- in-progress
- finalized

### In-Progress

An in-progress session is a planning session that has been saved but not yet finalized into a generated workpack.

It remains resumable and, subject to planning rules, may still be changed.

### Finalized

A finalized session is a planning session that has already been used to generate a workpack.

It is no longer an editable active planning session.

## Actions

The following actions are required:

- open or resume session
- delete session only if not finalized
- view finalized session as read-only

### Open or Resume Session

The user must be able to open a saved in-progress planning session and continue working from its last saved state.

### Delete Session

The user must be able to delete a planning session only if it has not been finalized.

Finalized sessions must not be deletable under this phase.

### View Finalized Session

The user must be able to open a finalized planning session for reference.

That view must be read-only.

## Filtering

The planning session list must support filtering:

- by aircraft
- by status

### Aircraft Filter

The user must be able to narrow the session list to sessions for a specific aircraft.

### Status Filter

The user must be able to narrow the session list by session status.

At minimum, the filter must support:

- in-progress
- finalized

## Invariants

The following invariants are locked for multi-session visibility:

- planning sessions remain separate from workpacks
- no lifecycle changes
- no audit changes

### Separate From Workpacks

Planning session listing and management must not cause planning sessions to be treated as workpacks.

They remain planning artifacts only.

### No Lifecycle Changes

This phase does not change:

- workpack lifecycle
- task lifecycle
- snag lifecycle

### No Audit Changes

This phase does not redefine audit structure, audit capture, audit UI behavior, or audit write logic.

## Boundary

This phase defines visibility and management of planning sessions only.

It does not define:

- execution logic
- workpack lifecycle redesign
- schema implementation
- audit redesign

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
- define persistence internals beyond visibility requirements
- change generation logic

## Final Statement

Phase 13.3 defines Jupiter multi-session visibility as a planning-only capability where users can view all of their planning sessions, see aircraft, maintenance type, status, and last updated time, filter by aircraft or status, resume in-progress sessions, delete only non-finalized sessions, and view finalized sessions as read-only without changing workpack, lifecycle, or audit behavior.
