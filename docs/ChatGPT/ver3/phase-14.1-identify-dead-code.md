# Phase 14.1 - Identify Dead Code

## Status

DEFINE ONLY

This phase defines how Jupiter dead-code discovery must be performed safely.

This phase does not implement cleanup, does not delete files, does not modify source code, does not change schema, does not alter migrations, does not remove routes, and does not refactor existing behavior.

This phase is investigation only.

## Purpose

The purpose of this phase is to establish a controlled method for identifying code and documentation that may be unused, duplicated, stale, orphaned, or superseded.

Phase 14.1 does not decide final removal.

Phase 14.1 only defines how suspected dead code must be discovered, documented, and evidenced before any later approval or deletion phase.

## Scope

This phase covers investigation of:

- unused routes
- unused services
- duplicate migrations
- stale files
- orphaned views
- obsolete docs only if clearly superseded
- unused controllers
- unused models
- unused helpers or utilities
- old migration folders if present

The output of this phase is a documented list of suspected cleanup candidates with evidence.

## Out Of Scope

The following are out of scope for Phase 14.1:

- deleting any file
- renaming any file
- modifying any code
- modifying any view
- modifying any migration
- modifying any schema
- modifying any route registration
- modifying any service registration
- refactoring
- redesign
- changing lifecycle behavior
- changing audit behavior
- changing planning behavior
- changing customer behavior
- changing permissions or authorization

Phase 14.1 is discovery only.

## Investigation Rules

Dead-code investigation must follow these rules:

- inspect existing code only
- inspect existing route registration only
- inspect existing view usage only
- inspect existing migration history only
- inspect existing docs only
- make no cleanup changes
- make no assumptions without evidence
- treat suspected dead code as active until evidence proves otherwise
- treat verified phases as locked unless direct evidence shows superseded or unused files

Investigation must prefer direct evidence from:

- route registration
- imports and exports
- controller references
- service call sites
- model registrations
- view render calls
- migration ordering and duplicate table definitions
- document cross-references

## Evidence Required Before Anything May Be Called Dead Code

Nothing may be called dead code without explicit evidence.

Minimum evidence requires all applicable checks for the file or artifact type.

### General Evidence Standard

A candidate must include:

- exact file path
- artifact type
- why it is suspected
- where it would normally be referenced
- search evidence showing no active references, or duplicate/superseded references
- any ambiguity or uncertainty

### Route Evidence

A route may be marked suspected dead only if evidence shows:

- no active mount path, or
- controller route exists but is unreachable from registration, or
- duplicate route path supersedes it, or
- feature was replaced by a newer route with clear active usage

### Controller Evidence

A controller may be marked suspected dead only if evidence shows:

- no route references
- no internal service calls requiring it
- no render path or export usage

### Service Evidence

A service may be marked suspected dead only if evidence shows:

- no imports
- no direct invocation
- no indirect registration
- no documented active feature dependency

### View Evidence

A view may be marked suspected dead only if evidence shows:

- no `res.render(...)` reference
- no partial include reference
- no route/controller path that can render it

### Migration Evidence

A migration may be marked suspected duplicate or obsolete only if evidence shows:

- duplicate table creation intent
- duplicate index or seed intent
- later repair migration fully supersedes earlier broken logic
- file exists in an old folder not used by the active migration chain

Migrations must not be called removable merely because they are old.

### Documentation Evidence

A document may be marked suspected obsolete only if evidence shows:

- a later document clearly supersedes it
- the newer document is active and authoritative
- the older document is not referenced as current guidance

## Categories To Inspect

The dead-code investigation must inspect at minimum the following categories:

- routes
- controllers
- services
- views
- migrations
- old migration folders
- unused models
- unused helpers or utilities
- obsolete docs

### Routes

Inspect:

- route registration files
- app-level mounts
- feature route modules
- duplicate route patterns
- unreachable route handlers

### Controllers

Inspect:

- route-linked controllers
- exported handlers with no route usage
- legacy handlers replaced by newer flows

### Services

Inspect:

- imported services
- wrapper services
- legacy services no longer referenced
- duplicate service implementations covering the same feature

### Views

Inspect:

- top-level EJS views
- partials
- pages with no render path
- views replaced by new feature pages

### Migrations

Inspect:

- duplicate table creation
- duplicate seed/reference migrations
- repair migrations
- superseded migration logic
- migrations targeting tables no longer represented in active code

### Old Migration Folders

Inspect:

- alternate migration directories
- abandoned backup folders
- legacy migration locations outside the active configured path

### Unused Models

Inspect:

- model exports
- associations
- route/service/controller references
- schema alignment versus actual runtime use

### Unused Helpers Or Utilities

Inspect:

- helper modules
- utility functions
- compatibility shims
- old adapters no longer wired into runtime paths

### Obsolete Docs

Inspect:

- phase docs
- audit docs
- snapshots
- system guides
- superseded design notes

Only clearly superseded docs may be flagged.

## Safety Rules

The following safety rules are mandatory:

- no deletion in 14.1
- no modification in 14.1
- suspected dead code only
- every candidate must include evidence
- deletion requires Phase 14.2 approval

### No Deletion In 14.1

Phase 14.1 must not remove any file, route, service, model, view, migration, helper, or document.

### No Modification In 14.1

Phase 14.1 must not rewrite or clean up suspected artifacts.

### Suspected Dead Code Only

Candidates found in this phase must be labeled as suspected only.

They are not approved for removal in this phase.

### Every Candidate Must Include Evidence

Every suspected candidate must include traceable evidence.

No candidate may be listed based on intuition, age, naming, or preference alone.

### Deletion Requires Phase 14.2 Approval

No suspected candidate may proceed to removal without explicit approval in Phase 14.2.

## Required Investigation Report Format

Phase 14.1 investigation output must use the following structure:

### Report Header

- phase name
- investigation date
- investigator
- scope inspected

### Summary

- total candidates found
- categories inspected
- high-risk candidates
- ambiguous candidates

### Candidate Entry Format

Each suspected dead-code candidate must include:

- category
- file path
- status: suspected only
- reason suspected
- evidence
- active references found: yes or no
- replacement or superseding file if applicable
- risk if removed incorrectly
- recommendation:
  - keep
  - review in Phase 14.2
  - not enough evidence

### Category Sections

The report must group candidates by:

- routes
- controllers
- services
- views
- migrations
- old migration folders
- models
- helpers or utilities
- docs

### No-Action Statement

The report must end with a clear statement that:

- no files were deleted
- no code was modified
- no migrations were changed
- no routes were removed
- no services were removed

## Completion Criteria

Phase 14.1 is complete only when all of the following are true:

- the purpose and safety boundary are documented
- investigation categories are defined
- evidence rules are defined
- report format is defined
- deletion is explicitly deferred to Phase 14.2
- no code changes were made
- no files were deleted
- no routes were removed
- no services were removed
- no migrations were changed

## Final Statement

Phase 14.1 defines Jupiter dead-code identification as a controlled investigation-only phase that inspects routes, controllers, services, views, migrations, old migration folders, models, helpers, and obsolete documents, records only suspected candidates with explicit evidence, forbids deletion or modification, and defers any removal decision to Phase 14.2 approval.
