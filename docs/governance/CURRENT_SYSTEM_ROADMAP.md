# Jupiter Current System Roadmap

**Document ID:** JUPITER-CURRENT-SYSTEM-ROADMAP

**Revision:** 1.7

**Status:** Canonical evidence-based implementation map

**Evidence review date:** 2026-09-06

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

**Status:** `PARTIALLY IMPLEMENTED — MT-4A + MT-4B + MT-4C3A + MT-4C3B + MT-4C3C + MT-4C4 + MT-4C5 + MT-4C6B1 + MT-4C6B2 COMPLETE + VERIFIED`

Proven MT-3 capability includes tenant and membership foundations, regenerated
staff sessions, Organisation eligibility decisions, selection, active-context
resolution, switching, stale-context and concurrency protection, switch audit,
and customer-session preservation.

MT-4A read-only profiling completed for test and production. Production roots
were empty at profile time; no ownership backfill was required, and shared
master/reference data remains outside root operational ownership.

MT-4B establishes verified authoritative root ownership: Aircraft, Customer,
PlanningSession, and Workpack use `tenant_id`; SerializedComponent uses
`custodian_tenant_id`. Ownership is UUID `NOT NULL`, Tenant-FK constrained with
`RESTRICT`/`RESTRICT`, immutable under current authority, and uses normalized
tenant-scoped uniqueness. Workpack tenant attribution is historical.

Migration `590_add_root_operational_tenant_ownership.ts` and matching model/
create-authority changes passed DB-free and guarded `jupiter_test` live
verification, including clean DOWN/reapply, non-empty DOWN refusal, suspension
persistence, cross-tenant creation rejection, and zero synthetic residue.

Production deployment has not occurred. The observed production lineage ends
at 581; deployment requires guarded sequential migrations 582–590 and the
matching application as one maintenance-window release unit after identity,
ledger, empty-root, backup and recovery preflight. Migration 590 may be undone
only before root creation while all five roots remain empty. Populated ownership
columns must never be discarded.

Root ownership is not operational tenant isolation. Tenant-scoped query and
mutation APIs, joins/children, search/count/dashboard/report/export and
background/file/cache boundaries, mixed domains, tenant-scoped RBAC,
Platform/System Owner authority, the operational context gate, and RLS remain
future work. Global `user_roles` remains authoritative and
`requireValidActiveTenantContext` remains globally unmounted except for the
verified route-local dashboard boundary.

MT-4C3B5 establishes verified tenant-authorized aircraft utilisation, local
serialized-component life calculation and monitoring, and utilisation
propagation preview. Local life acquisition enforces both the Aircraft tenant
and SerializedComponent custodian roots. Focused verification passed 52/52
database-backed tests and 11/11 DB-free tests under marker
`JUPITER_MT4_SLICE_4C3B5_VERIFY_PASS`. Transaction, locking, audit, utilisation
event, snapshot, correction, and grounding semantics remain preserved.

MT-4C3B6 is complete and verified across its aircraft view/component workflow
reads, legacy AircraftComponent mutations, and seven aircraft compliance-child
operations. MT-4C3B7 static/AST enforcement passed 186/186 tests and rejected
5/5 negative fixtures. MT-4C3B8 guarded two-tenant live verification passed
4/4 tests against `jupiter_test`, with B7 reconfirmed at 186/186 PASS. No
remaining B1–B8 isolation gap was identified within the approved MT-4C3B
boundary.

MT-4C4 establishes verified tenant-authorized broad due monitoring across all
seven CalendarDue recalculation entry points, aircraft component monitoring,
the broad component-life calculation path, and directly affected compliance
and scheduled-task recalculation callers. Tenant-wide enumeration is confined
to one tenant; guarded two-tenant monitoring passed within 49/49 `jupiter_test`
tests, with 20/20 DB-free tests also passing. No schema, migration, production,
RBAC, RLS, tenant-gate, or scheduler work was performed. The unrelated stale
direct-model inventory suite remains outside MT-4C4. This does not establish
system-wide tenant isolation.

MT-4C5 establishes verified tenant-authorized operational dashboard aggregates.
Authenticated `GET /` obtains authentic authority through a route-local tenant
context gate without globally activating `requireValidActiveTenantContext`.
Aircraft, Customer, historical Workpack, SerializedComponent custody, and both
Workpack-linked and standalone Aircraft-rooted snag counts are tenant-scoped.
Focused DB-free/static verification passed 196/196 tests and guarded
two-tenant `jupiter_test` verification passed 3/3. No schema, migration, or
production change occurred. The unrelated AircraftComponent tenant repository
cast error remains outside MT-4C5.

Migration `594_grant_tenant_login_provisioning_access.ts` repairs the tenant
runtime ACL gap with least privilege: `jupiter_app` receives read-only access
to Tenant and TenantMembership roots plus `INSERT`/`UPDATE` on the dedicated
tenant-switch attempt ledger. Tenant and membership provisioning remains an
administrator operation through `OrganisationProvisioningService`. Migration
594 is verified on development `jupiter_db` and guarded `jupiter_test` only;
production remains untouched. Development login and persisted active tenant
context were verified after provisioning one active `JUPITER_DEV` membership.

MT-4C3C establishes verified Workpack aggregate tenant isolation across
Workpack, PlanningSession, task, snag, audit, execution, and component-context
boundaries. Workpack historical `tenant_id` remains authoritative, and
cross-tenant ambiguous TaskCards are neutral and unavailable. Standalone snags
retain mandatory audit history through migrations 591–593, applied only to
`jupiter_test`. Focused verification passed 14/14 DB-free and 9/9 guarded
`jupiter_test` tests. Production was not migrated. The unrelated existing
TypeScript cast error in `aircraft-component-tenant.repository.live.ts` remains
outside this slice.

MT-4C6B1 establishes verified durable custody for legacy
`aircraft_components` and immutable event-time movement history. Migration 595
adds non-null `custodian_tenant_id`, deterministic Aircraft-tenant backfill,
custody FK/index/normalized identity enforcement, custody immutability and
Aircraft-tenant matching, plus constrained installation/removal history with
database-enforced UPDATE/DELETE rejection. Existing component state received no
fabricated retrospective movement rows. Migration 596 leaves `jupiter_app`
movement-history `SELECT` and `INSERT` privileges only, with no `UPDATE` or
`DELETE`. Verification passed 241/241 DB-free/static and 5/5 guarded
`jupiter_test` tests. Migrations 595 and 596 are applied to local development
and test databases; production remains untouched. Fleet projection conversion
remains incomplete and is outside the MT-4C6B1 boundary.

MT-4C6B2 establishes verified authoritative mounted legacy component removal
and same-tenant reinstall. The compatibility inventory URLs now require
authentic tenant and actor authority and use custody-scoped AircraftComponent
repositories rather than the stale `components`/`inventory_movements` path.
Removal preserves custody and retained Aircraft identity while carrying accrued
TSN/TSO; reinstall targets an ACTIVE Aircraft under the same tenant. Both use
locked optimistic mutation and atomically append server-authoritative immutable
movement history. Focused verification passed 35/35 DB-free/static and 10/10
guarded `jupiter_test` tests. Fleet projection conversion remains incomplete
and outside this verified boundary.

MT-4C6B3 is DEFINE PASS / IMPLEMENTATION NOT AUTHORIZED. Its approved boundary
is a route-local active-tenant gate plus authority-first projection
service/repository for both mounted projection endpoints. Aircraft,
both-root installed legacy components, and custody-owned removed inventory must
be tenant-scoped in database queries; fleet health and summary must share the
same truthful NORMAL/CRITICAL/EXPIRED/UNKNOWN rules. Runtime dependence on
stale `components`, `SERVICEABLE`, and tenant-unsafe `vw_component_status` is
to be replaced without altering schema. Movement history is not current custody
authority. B3 excludes SerializedComponent redesign, transfer, wider gate
activation, production, and migrations.

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

MT-4C3C adds verified tenant isolation around these established authorities,
including historical Workpack ownership and standalone Aircraft-rooted snags.

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
- serialized-component isolation outside the verified MT-4C3B local paths
  remains incomplete;
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

Aircraft utilisation, local serialized-component life propagation, and broad
due monitoring are tenant-authorized and verified. Authority and propagation
remain incomplete across other legacy or aggregate paths.

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
- Current migration lineage extends through migration 596 at the last evidence
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
