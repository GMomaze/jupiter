# Jupiter Current System Roadmap

**Document ID:** JUPITER-CURRENT-SYSTEM-ROADMAP

**Revision:** 1.0

**Status:** Canonical evidence-based implementation map

**Evidence review date:** 2026-08-17

**Evidence basis:** current source, active migrations through 584, focused tests,
tracked documentation, and completed read-only governance/component audits

## Status vocabulary

- `COMPLETE + LOCKED` — implemented authority with regression evidence; do not recreate.
- `IMPLEMENTED` — present and operational, but not declared globally locked.
- `PARTIALLY_IMPLEMENTED` — useful implementation exists with proven gaps.
- `DEFINE ONLY` — approved definition exists; implementation is absent or paused.
- `FUTURE` — programme intent without current implementation authority.
- `UNKNOWN` — evidence is insufficient; investigation is required.

Status describes evidence, not permission to change a capability.

## Current programme position

| Programme | State | Current authority |
|---|---|---|
| Governance Modernisation | `AWAITING G3R3 FOCUSED VERIFICATION / NOT COMMIT READY` | G1 complete; G2 implemented; original G3 failed; G3R implemented; repeat G3 failed; G3R2 implemented; G3R2 focused verification failed on stale execution-state modelling; G3R3 state-model repair implemented |
| Component Management Unified Workspace | `DEFINE ONLY / PAUSED` | Investigation, definition, and technical design through Phase 3 approved; no implementation slice authorized |
| CI/release hardening | `FUTURE` | Deficiencies proven; separate phase required |
| Jupiter SaaS / Multi-Tenant Foundation | `FUTURE / NEXT PRIORITY` | Intended after Governance Modernisation; not authorized for implementation and requires its own approved lifecycle |

See [`ACTIVE_WORK.md`](ACTIVE_WORK.md) for the exact active phase.

## Operational authority map

### Workpacks and task execution

**Status:** `COMPLETE + LOCKED` with specific documented gaps outside the locked
authority.

Current source implements workpack planning/generation, task execution, status
transitions, certification/close gates, snags, audit history, and printed
workpack/CRS/CRMA flows. Workpacks remain operational snapshots/records; they do
not replace master maintenance content authority.

Do not recreate workpack lifecycle, task lifecycle, certification, close, snag,
or workpack audit authority. Investigate any current UI/service mismatch before
repair.

### Serialized components

**Status:** `COMPLETE + LOCKED` foundation; workspace UX remains `DEFINE ONLY`.

Implemented authority includes:

- serialized identity and model relationship;
- installation/removal and baseline-capture records;
- per-component life state;
- tracking bases and installation/removal baselines;
- life-limit evaluation with safe `UNKNOWN` outcomes;
- LIFE_ADJUSTMENT, OVERHAUL, and generic maintenance-event history;
- serialized life dashboard, reconciliation, dry-run, workpack visibility, and
  compliance visibility.

The legacy `aircraft_components` path remains operationally active alongside
serialized records. Do not remove either path without an approved transition.

Known gaps:

- no unified Component Management workspace;
- serialized lookup is not tenant/company scoped;
- ordinary serialized creation lacks strong orchestration and duplicate warning;
- no truthful dedicated opening-lifecycle-intake event authority;
- some aircraft meter snapshot normalization can convert missing/invalid values
  to zero and must not be copied into new workflows;
- install/baseline/remove route permission hardening is unresolved.

### Component life-limit governance

**Status:** `IMPLEMENTED`; security and operational authority locked pending only
separately approved repair.

Migrations 577–584 establish proposal, independent decision, publication,
activation, immutable history, dedicated ownership, transition-gate ACLs, and
activation gate-write repair. Current source and tests cover approval,
activation, rollback, permissions, ownership, and due-engine consumption.

Governance remains attached to `ComponentModel` and dynamically consumed. Do not
copy rules into serialized components or bypass proposal/decision/activation.

### Aircraft and utilisation

**Status:** `PARTIALLY_IMPLEMENTED`.

Aircraft CRUD, technical views, utilisation update services, component
installation/removal compatibility, hours, cycles, and utilisation-event
architecture exist. Authority and propagation are not uniformly mature across
all legacy and serialized paths.

Unknown operational values must not be assumed zero. Do not introduce hidden
component-life propagation or frontend-owned calculations.

### Library master data

**Status:** `PARTIALLY_IMPLEMENTED`.

Manufacturers, component models, asset/reference data, ADs, SBs, SIDs, standard
tasks, templates, imports, assignments, and serialized library functions exist.
Manufacturer and component-model data currently behave as global master data.

Known gaps include uneven validation/audit behavior, intentionally compatible
duplicate model names, and incomplete workspace orchestration.

### Compliance and applicability

**Status:** `IMPLEMENTED` with deferred advanced automation.

Current source includes compliance items/assignments, applicability services,
AD/SB/SID relationships, due calculation/recalculation services, manual AD
compliance creation/status/due actions, and read-only projections.

Do not create a parallel applicability or due engine. Structured AMOC,
terminating-action, supersedure automation, and other Phase 22 deferrals remain
unimplemented unless later evidence proves otherwise.

### Authentication, RBAC, and customers

**Status:** `PARTIALLY_IMPLEMENTED`.

Staff authentication, PostgreSQL-backed sessions, roles/permissions, customer
records, customer users, customer-aircraft links, and customer portal visibility
exist. Enforcement remains route-dependent.

Do not describe current component/library data as tenant-safe. UI visibility is
not authorization; server-side guards remain authoritative.

### Audit and document authority

**Status:** `IMPLEMENTED` across multiple specialized authorities.

General audit, workpack audit, snag audit, component maintenance history, and
governance immutable history coexist. They are not interchangeable. PDF/document
generation remains downstream of operational records and must not mutate
lifecycle state.

### Inventory, standalone tasks, projection, and maintenance triggers

**Status:** `PARTIALLY_IMPLEMENTED / BOUNDARY REQUIRES INVESTIGATION`.

These modules exist but are not universally authoritative for serialized
inventory, task execution, or lifecycle change. Do not extend or retire them
without an approved investigation.

## Database and migration state

- PostgreSQL with Sequelize and direct `pg` usage is the current database stack.
- `migrations/` is the active migration filesystem; historical migration folders
  are archival evidence.
- Active migration files extend through migration 584.
- Executed migrations are immutable; repairs require additive migrations.
- Test reset/migration/seed paths have fail-closed `jupiter_test` identity guards.
- Generic migration/undo/seed scripts remain hazardous without an approved
  target-verified procedure.

## Governance and documentation state

Canonical governance now resides in `docs/governance` with root `AGENTS.md` as
the deterministic entry. Historical version directories are classified by the
supersession register.

The prior tracked roadmap remains historical compatibility evidence. This
roadmap must be updated only from verified implementation evidence and must use
`UNKNOWN` where evidence is insufficient.

## Correct next work

1. Perform focused independent `G3R3 — VERIFY`; no development work is
   authorized by completion of the state-model repair.
2. Keep Governance Modernisation `NOT YET VERIFIED`, `NOT YET COMMIT READY`, and
   `NOT YET COMMITTED` until G3R3 verification passes.
3. If verification passes, scoped Governance Modernisation commit preparation
   remains a separately authorized operation.
4. Keep Component Management implementation paused with no authorized slice.
5. Treat Jupiter SaaS / Multi-Tenant Foundation only as the intended next major
   priority. It is not started or implementation-authorized and must begin with
   a separately owner-authorized `MT-0 — INVESTIGATE` after governance is
   verified and committed.
6. Define CI/release hardening separately.
