# Phase: Operational Regression Stop Gate

## Purpose

Jupiter must not continue feature development while operational subsystems can be partially removed, partially restored, or silently orphaned.

This stop gate is mandatory before any new phase, feature, UI change, workflow change, route change, model change, or migration change.

The goal is to prevent loss of operational surface visibility across:

- Library
- Aircraft
- Serialized components
- Component models
- Workpacks
- Compliance visibility
- Supporting operational views and workflows

This gate is not optional.

If the gate fails, development stops until the failure is resolved and re-verified.

## Mandatory Stop Rules

The following rules are absolute:

1. No new feature work may begin on a dirty worktree.
2. No new feature work may begin while uploaded runtime files are tracked by Git.
3. No new feature work may begin if `npm run build` fails.
4. No new feature work may begin if any required migration, model, export, association, route, view, link, workflow action, or CSRF protection is missing.
5. No new feature work may begin if any subsystem is orphaned.
6. No release, merge, or phase transition may occur until this gate passes in full.
7. Partial restoration is not considered recovery.
8. A subsystem is only considered present when storage, model, association, route, view, navigation, action wiring, and safety protections all align.

## Required Subsystem Inventory

The following subsystem inventory must be maintained and verified before every new phase.

### 1. Database migration layer

Required expectation:

- every persisted operational model has at least one authoritative migration path
- required tables for active operational subsystems exist in migrations
- migrations are present in the repository and not only in local database state
- migration numbering/order is coherent

Required inventory includes:

- component models
- serialized components
- aircraft component installations
- serialized component life state
- serialized component maintenance events
- manufacturers
- asset types
- maintenance requirements
- maintenance templates
- service bulletins
- compliance items
- workpack core entities required by current workflows

### 2. Model file layer

Required expectation:

- each operational subsystem has a model file
- model filenames are stable and discoverable
- model definitions map to real persisted structures

Required model coverage includes:

- `src/models/ComponentModel.ts`
- `src/models/SerializedComponent.ts`
- `src/models/AircraftComponentInstallation.ts`
- `src/models/SerializedComponentLifeState.ts`
- `src/models/SerializedComponentMaintenanceEvent.ts`
- `src/models/Manufacturer.ts`
- `src/models/AssetType.ts`
- `src/models/MaintenanceRequirement.ts`
- `src/models/MaintenanceTemplate.ts`
- `src/models/ServiceBulletin.ts`
- `src/models/ComplianceItem.ts`
- current workpack models under `src/models/core/`

### 3. Model export layer

Required expectation:

- required models are exported from the model index and available to the app
- no operational model exists on disk but is omitted from exports

Verification scope includes:

- `src/models/index.ts`
- any central model registration used by associations or bootstrapping

### 4. Association layer

Required expectation:

- all required operational relationships are defined
- model associations exist where workflows depend on joined visibility
- association registration is not partially removed

Required association coverage includes:

- manufacturer to component model
- asset type to component model
- component model to maintenance requirements
- component model to serialized components where applicable
- serialized component to installation history
- serialized component to maintenance events
- aircraft to active component installation records
- workpacks to the entities they visibly depend on

Verification scope includes:

- `src/models/associations.ts`
- any model-local association definitions

### 5. Route registration layer

Required expectation:

- required routers exist
- required routes are registered in the app bootstrap
- route modules are not present but unmounted

Verification scope includes:

- `src/app.ts`
- subsystem route files under `src/modules/**`

Required operational route surfaces include:

- Library
- Aircraft
- Workpacks
- Inventory when referenced by UI
- Service bulletin and related operational read paths when linked from current UI

### 6. View layer

Required expectation:

- every user-facing GET route that renders HTML has a view
- every current workflow entry point has a discoverable page or partial
- every form-rendering route has the expected view or partial

Verification scope includes:

- `src/views/library/**`
- `src/views/aircraft/**`
- `src/views/workpacks/**`
- required partials used by current operational screens

### 7. Library navigation layer

Required expectation:

- Library index must expose the operational surfaces Jupiter claims to support
- hidden but still-working routes are not acceptable for active subsystems

Required Library menu visibility includes:

- component model management entry
- serialized component management entry if the subsystem is claimed active
- any create flow the Library expects users to initiate
- any read/list view the Library expects users to use operationally

### 8. Aircraft workflow layer

Required expectation:

- aircraft screens must visibly expose required operational component workflows
- UI actions must post to valid registered routes
- active installed component visibility must not be orphaned from forms or drilldowns

Required Aircraft workflow visibility includes:

- install serialized component workflow
- baseline capture workflow if active
- remove serialized component workflow
- any direct component install workflow still claimed by the UI

### 9. Workpack workflow layer

Required expectation:

- workpack screens must visibly expose the operational surfaces they depend on
- execution, planning, and drilldown views must not point at missing routes or missing context layers

Required Workpack workflow visibility includes:

- planner route and view
- execution route and view
- any component-related drilldown currently linked from workpacks

### 10. Runtime file hygiene layer

Required expectation:

- uploaded runtime files must not be committed
- transient runtime content must remain outside source control or be ignored properly

Blocked examples include:

- `uploads/` content tracked by Git
- generated runtime artifacts mistakenly staged for commit

## Verification Checklist

Every new phase must begin only after all checks below are run and recorded.

### A. Required migrations exist

Pass when:

- every required operational model has a supporting migration path in `migrations/`
- no active subsystem depends on a table that cannot be recreated from repository migrations

Fail when:

- an active model has no migration
- a required table exists only in a developer database
- a migration was lost, renamed incorrectly, or never committed

### B. Required model files exist

Pass when:

- all required model files are present in `src/models/`

Fail when:

- a required model file is missing
- the subsystem is referenced elsewhere but its model file is gone

### C. Required model exports exist

Pass when:

- every required model is exported through the active model registration path

Fail when:

- the model file exists but the app cannot access it through exports

### D. Required associations exist

Pass when:

- operational joins and workflow dependencies are backed by real associations

Fail when:

- a workflow relies on related data but the associations are absent or only partially defined

### E. Required routes are registered

Pass when:

- the route file exists
- the router contains the required endpoints
- the router is mounted in `src/app.ts`

Fail when:

- the route file exists but is not mounted
- the UI points to a route path that is not registered
- a required route was removed or renamed without coordinated UI updates

### F. Required views exist

Pass when:

- every rendered route has the required full-page view or partial

Fail when:

- a route renders a missing view
- a view dependency was deleted or renamed without route updates

### G. Required Library menu links exist

Pass when:

- Library entry pages visibly link to all active Library subsystems

Fail when:

- Library routes still work manually but are no longer linked
- active Library functionality is hidden behind direct URL entry only

### H. Required Aircraft workflow links exist

Pass when:

- aircraft screens visibly expose the active workflows they depend on
- install, remove, baseline, and drilldown entry points are present when those subsystems are active

Fail when:

- a workflow route exists but no UI exposes it
- a UI action points to the wrong route

### I. Required Workpack workflow links exist

Pass when:

- workpack planning and execution surfaces remain navigable and internally coherent

Fail when:

- a workpack workflow depends on missing routes, missing views, or dead links

### J. No uploaded runtime files tracked by Git

Pass when:

- runtime upload directories are ignored or empty from Git’s perspective

Fail when:

- uploaded runtime files appear in `git status`
- generated files are staged or committed as source

### K. No dirty worktree before new phase

Pass when:

- `git status --short` is clean

Fail when:

- modified, staged, or untracked files exist
- exceptions are being carried informally between phases

### L. `npm run build` passes

Pass when:

- the TypeScript build completes successfully

Fail when:

- the build errors
- the build passes only after local uncommitted rescue edits

### M. Core smoke routes load

Pass when:

- the core user-facing routes for current operational surfaces respond successfully and render their expected views

Minimum smoke scope:

- `/library`
- core Library child routes currently linked by UI
- core aircraft route used for installed component workflows
- core workpack routes used for planning and execution

Fail when:

- any core smoke route 404s
- any route errors due to missing render target, missing data contract, or broken registration

### N. No orphaned subsystem exists

Pass when all of the following are false:

- model exists but no route
- route exists but no view
- view exists but no menu link
- migration missing for model
- UI action posts to wrong route
- form missing CSRF

Fail when any one of these is true.

## Pass/Fail Criteria

The stop gate is binary.

### Pass

The gate passes only when:

- every checklist item passes
- no orphaned subsystem condition exists
- no runtime uploads are tracked by Git
- the worktree is clean
- `npm run build` passes
- core smoke routes load

### Fail

The gate fails if:

- any single checklist item fails
- any required operational surface is only partially restorable
- any current UI route, view, or form is orphaned
- any active subsystem is reachable only through manual URL entry
- any form that mutates state is missing CSRF protection

## Blocked-Release Criteria

Release, merge, phase transition, or new implementation work is blocked when any of the following is true:

- a required migration is missing
- a required model file is missing
- a required model export is missing
- a required association is missing
- a required route is missing or unmounted
- a required view is missing
- a required Library link is missing
- a required Aircraft workflow link is missing
- a required Workpack workflow link is missing
- a core smoke route does not load
- `npm run build` fails
- uploaded runtime files are tracked by Git
- the worktree is dirty
- any subsystem is orphaned
- a UI action posts to the wrong route
- a state-changing form is missing CSRF

There is no “acceptable partial fail” category.

## Recovery Procedure

If the gate fails, the recovery sequence is mandatory.

1. Stop new feature work immediately.
2. Name the failed subsystem explicitly.
3. Classify the failure:
   - migration gap
   - model gap
   - export gap
   - association gap
   - route registration gap
   - view gap
   - navigation gap
   - workflow action mismatch
   - CSRF gap
   - runtime file hygiene gap
   - dirty worktree gap
   - build failure
4. Restore the subsystem end-to-end, not partially.
5. Re-run the full stop gate, not only the previously failing check.
6. Record the verified result before resuming development.

Recovery is complete only when:

- the original failure is resolved
- no secondary orphaning remains
- the full checklist passes again

## Commit Discipline

Jupiter must use strict commit discipline to avoid partial operational restoration.

Required discipline:

- one coherent operational change per commit
- no mixed feature and rescue work in the same commit
- no untracked runtime uploads in commits
- no beginning a new phase with a dirty worktree
- no “temporary UI removal” without explicit documented replacement
- no deleting or renaming routes, views, or models without verifying all callers and links
- no adding forms without CSRF review
- no adding UI actions without route verification
- no merging work that fails the stop gate

Required pre-phase sequence:

1. `git status --short` is clean.
2. runtime upload directories are clean from Git tracking.
3. subsystem inventory is checked.
4. `npm run build` passes.
5. core smoke routes load.
6. orphan checks pass.
7. only then may the next phase begin.

## Operational Definition of Done for Any Future Phase

A future phase may start only when:

- this stop gate passes in full
- the currently active operational surfaces remain visible
- no required workflow is discoverable only through manual URL knowledge
- no subsystem is partially present
- the repository state is clean and releasable

Until then, Jupiter is blocked for feature expansion.
