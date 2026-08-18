# Jupiter Current System Roadmap

**Document ID:** JUPITER-CURRENT-SYSTEM-ROADMAP

**Revision:** 1.1

**Status:** Canonical evidence-based implementation map

**Evidence review date:** 2026-08-18

**Evidence basis:** current source, migrations, focused verification evidence,
and approved programme records available at the last evidence review.

This document describes proven Jupiter capability and maturity.

It does not authorize current work.

Current and paused work authorization is recorded only in
[`ACTIVE_WORK.md`](ACTIVE_WORK.md).

## Status vocabulary

- `COMPLETE + LOCKED` — implemented authority with regression evidence; do not recreate.
- `IMPLEMENTED` — present and operational, but not declared globally locked.
- `PARTIALLY_IMPLEMENTED` — useful implementation exists with proven gaps.
- `DEFINE ONLY` — approved definition exists; implementation is absent or paused.
- `FUTURE` — programme intent without implementation authority.
- `UNKNOWN` — evidence is insufficient; investigation is required.

Status describes evidence, not permission to modify a capability.

## Programme evidence summary

### Governance Modernisation

**Status:** `COMPLETE + VERIFIED + COMMITTED`

Canonical governance baseline:

`8b5cd409e8f50c3b9dbf112729983b7726d53231`

Current programme authorization must be read from `ACTIVE_WORK.md`.

### Component Management Unified Workspace

**Status:** `DEFINE ONLY / PAUSED`

Evidence establishes:

- Phase 1 investigation approved;
- Phase 2 functional/UX definition approved;
- Phase 3 technical design approved;
- implementation has not started.

The active plan remains:

`docs/JUPITER_COMPONENT_MANAGEMENT_UNIFIED_WORKSPACE_PHASED_TASK_PLAN.md`

### Jupiter SaaS / Multi-Tenant Foundation

**Status:** `FUTURE / NEXT PROGRAMME PRIORITY`

The intended programme objective is to evolve existing Jupiter into a
multi-tenant SaaS AMMS while preserving existing working functionality and data.

No tenant architecture, schema conversion, RLS, tenant context, membership
model, or isolation implementation is proven by this roadmap.

The programme requires its own approved investigation and definition before
implementation.

### CI / release hardening

**Status:** `FUTURE`

Known engineering deficiencies exist, but implementation authority is separate.

## Operational authority map

### Workpacks and task execution

**Status:** `COMPLETE + LOCKED` with separately documented gaps outside the
locked authority.

Current implementation includes workpack planning/generation, task execution,
status transitions, certification/close gates, snags, audit history, and printed
workpack/CRS/CRMA flows.

Workpacks remain operational snapshots/records and do not replace maintenance
content authority.

Do not recreate workpack lifecycle, task lifecycle, certification, close, snag,
or workpack audit authority.

### Serialized components

**Status:** `COMPLETE + LOCKED` foundation; unified workspace remains
`DEFINE ONLY`.

Implemented authority includes:

- serialized identity and model relationship;
- installation/removal and baseline-capture records;
- per-component life state;
- tracking bases and installation/removal baselines;
- life-limit evaluation with safe `UNKNOWN` outcomes;
- LIFE_ADJUSTMENT, OVERHAUL, and maintenance-event history;
- serialized life dashboard and operational visibility.

Legacy `aircraft_components` functionality still coexists with serialized
component functionality.

Known gaps include:

- no unified Component Management workspace;
- current serialized lookup is not proven tenant/company isolated;
- ordinary serialized creation has orchestration/duplicate-handling gaps;
- no dedicated truthful opening-lifecycle-intake authority;
- some legacy meter normalization paths can convert missing values to zero;
- install/baseline/remove permission hardening remains unresolved.

### Component life-limit governance

**Status:** `IMPLEMENTED`

Migrations 577–584 establish controlled proposal, independent decision,
publication, activation, immutable history, ownership, and transition controls.

Governance remains associated with `ComponentModel` and dynamically consumed.

Do not copy governance rules into serialized components or bypass the controlled
governance lifecycle.

### Aircraft and utilisation

**Status:** `PARTIALLY_IMPLEMENTED`

Aircraft CRUD, technical views, utilisation services, hours/cycles,
utilisation-event architecture, and component installation/removal compatibility
exist.

Authority and propagation are not uniformly mature across all legacy and
serialized paths.

Unknown operational values must not be assumed zero.

### Library master data

**Status:** `PARTIALLY_IMPLEMENTED`

Manufacturers, component models, reference data, ADs, SBs, SIDs, tasks,
templates, imports, assignments, and serialized library functions exist.

Manufacturer and component-model data currently behave as global master data.

Known gaps include uneven validation/audit behavior, intentionally compatible
duplicate model names, and incomplete workspace orchestration.

### Compliance and applicability

**Status:** `IMPLEMENTED` with deferred advanced automation.

Current implementation includes compliance assignments, applicability services,
AD/SB/SID relationships, due calculations, manual compliance actions, and
read-only projections.

Do not create a parallel applicability or due engine.

### Authentication, RBAC, and customers

**Status:** `PARTIALLY_IMPLEMENTED`

Staff authentication, PostgreSQL-backed sessions, roles/permissions, customers,
customer users, customer-aircraft relationships, and portal visibility exist.

Enforcement remains route-dependent.

Current Jupiter must not be described as tenant-isolated merely because
authorization controls exist.

### Audit and document authority

**Status:** `IMPLEMENTED` across specialised authorities.

General audit, workpack audit, snag audit, component maintenance history, and
governance history coexist.

These authorities are not interchangeable.

Generated documents and PDFs remain downstream of operational authority and
must not mutate lifecycle state.

### Inventory, standalone tasks, projections, and maintenance triggers

**Status:** `PARTIALLY_IMPLEMENTED / REQUIRES INVESTIGATION`

These capabilities exist but are not universally authoritative for serialized
inventory, task execution, or lifecycle changes.

Do not extend or retire them without applicable investigation.

## Database and migration evidence

- PostgreSQL with Sequelize and direct `pg` usage is the current database stack.
- `migrations/` is the active migration filesystem.
- Current migration lineage extends through migration 584 at the last evidence
  review.
- Executed migrations are immutable.
- Corrections require additive repair migrations.
- Guarded test-database paths enforce `jupiter_test` safety requirements.
- Generic migration/undo/seed commands are not inherently safe without
  target-specific authority and safeguards.

For current database operations, use the canonical database safety policy
rather than this roadmap.

## Existing-functionality preservation

Jupiter is an existing working operational system.

Future development, including SaaS / Multi-Tenant conversion, must preserve
existing approved functionality, data, IDs, relationships, operational history,
audit evidence, and authority boundaries unless a specific change is separately
investigated, defined, approved, implemented, and verified.

Tenant isolation is an additional security boundary around existing Jupiter
functionality. It is not authority to replace or weaken that functionality.

A conversion slice must not be considered successful merely because tenant
isolation works if existing Jupiter functionality regresses.

## Roadmap maintenance rule

Update this roadmap only when evidence materially changes a capability or
maturity classification.

Do not use this roadmap to record short-lived execution steps, current Codex
prompts, or the next authorized phase.

Those belong only in `ACTIVE_WORK.md`.

Do not load historical evidence merely because this roadmap references a
capability. Inspect historical material only when required by the authorized
task.