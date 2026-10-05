# Jupiter Active Work Registry

**Document ID:** JUPITER-ACTIVE-WORK

**Revision:** 1.76

**Status:** Canonical

**Reviewed:** 2026-09-15

This is the lightweight canonical registry for current, paused, and next
programme work.

It records programme state and authorization boundaries. Historical programme
detail belongs in the roadmap and programme records and is not loaded through
this registry by default.

## Completed governance baseline

### Governance Modernisation

Status: `COMPLETE / VERIFIED / COMMITTED`

Canonical baseline commit:

`8b5cd409e8f50c3b9dbf112729983b7726d53231`

No Governance Modernisation phase remains active.

## Next priority

### Jupiter SaaS / Multi-Tenant Foundation


Status: `MT-4A + MT-4B COMPLETE / VERIFIED — MT-4C3A + MT-4C3B + MT-4C3C + MT-4C4 + MT-4C5 + MT-4C6B1 + MT-4C6B2 + MT-4C6B3 + MT-4C7A + MT-4C7B + MT-4C7C + MT-4C7D + MT-4C8A + LEVEL 1 OPERATIONAL AUTHORITY ACTIVATION + AIRCRAFT PHOTO PERSISTENCE LIFECYCLE COMPLETE / VERIFIED`

The objective is to evolve the existing working Jupiter system into a
multi-tenant SaaS AMMS while preserving its existing functionality and data.

Locked programme boundaries:

- Existing working Jupiter functionality must remain operational and must not be
  damaged by the SaaS conversion.
- Existing Jupiter data, IDs, relationships, history, and audit evidence must be
  preserved through controlled migration.
- Tenants and their private data must ultimately be invisible and
  non-discoverable to other tenants.
- Tenant isolation must be enforced beyond UI visibility.
- Jupiter Platform Administrator authority must remain separate from tenant
  administrator authority.
- The Platform Administrator must ultimately be able to suspend and reinstate a
  tenant without deleting, corrupting, transferring, resetting, or recreating
  that tenant's data.
- Suspension is an access/lifecycle control, not deletion.
- Jupiter's multi-tenant architecture must be established from Jupiter's own
  requirements and evidence. QA-MAN and SAFETYMAN are not architectural
  authorities for this programme.
- No blind `tenant_id` conversion is authorized.
- PostgreSQL RLS is not pre-authorized; its use requires an approved Jupiter
  architecture decision.
- No tenant-isolation claim may be made before applicable adversarial isolation
  and regression verification passes.

Completed and verified through MT-3:

- tenant and membership foundation;
- safe staff session regeneration and logout;
- Organisation eligibility and ZERO/ONE/MULTIPLE login decisions;
- Organisation selection, active-context resolution, and switching;
- stale-context and concurrent-switch protection;
- switch audit evidence and customer-session preservation.

MT-4A read-only operational ownership profiling is complete for `jupiter_test`
and `jupiter_db`. All five production operational roots were empty at profile
time, so no production ownership backfill or reconciliation was required.
Shared master/reference data remains separate from tenant-owned operational
data.

MT-4B root operational ownership is implemented and verified:

- Aircraft `tenant_id` records current tenant ownership and is initially
  immutable pending separately authorized transfer authority;
- Customer `tenant_id` records a tenant-local record and its creation tenant is
  immutable;
- SerializedComponent `custodian_tenant_id` records current custody and is
  initially immutable pending separately authorized custody transfer;
- PlanningSession `tenant_id` records an immutable creation tenant;
- Workpack `tenant_id` records immutable historical tenant attribution.

Migration `590_add_root_operational_tenant_ownership.ts` provides five UUID
`NOT NULL` ownership/custody columns, `tenants.id` foreign keys with
`RESTRICT`/`RESTRICT`, immutability, normalized tenant-scoped uniqueness,
zero-root UP prerequisites, and non-empty-root DOWN prohibition. Guarded clean
DOWN/reapply and non-empty DOWN refusal are verified on `jupiter_test`.

Verification evidence: 4B4 DB-free PASS (5 focused files / 29 tests) and 4B5
guarded `jupiter_test` live PASS, including valid creation of all five roots,
missing/client-derived authority rejection, cross-tenant PlanningSession and
Workpack rejection, uniqueness, immutability, Tenant delete restriction,
suspension persistence, Workpack historical attribution, and zero synthetic
residue.

MT-4B establishes authoritative root ownership. It does **not** establish
complete operational tenant isolation. Mandatory query context, read and
mutation predicates, child/join isolation, search/count/autocomplete,
dashboards, reporting/PDF/export, import/job/file/cache isolation, mixed-domain
separation, tenant-scoped RBAC, Platform/System Owner authority, and RLS remain
incomplete. Global `user_roles` remains runtime RBAC authority, and operational
`requireValidActiveTenantContext` remains globally unmounted except for the
verified route-local dashboard boundary.

Production deployment has not occurred. At the 4B6 DEFINE evidence point,
production was established at migrations 010–581 UP; 582–590 were not yet
deployed. Production requires a coordinated maintenance-window release:
stop application traffic and background writers, prove exact `jupiter_db`
identity/ledger and five empty roots, verify backup/recovery, apply
582→583→584→585→586→587→588→589→590, deploy the matching application, verify,
and reopen traffic only after PASS. Migration 590 and its matching model/create-
authority changes are one release unit.

Before root creation, guarded 590 DOWN is possible only while all five roots
are empty. Once any tenant-owned root exists, 590 DOWN is prohibited; ownership
columns must never be discarded from populated roots. Later defects require a
compatible application rollback, forward repair, or explicitly authorized
backup restoration.


Proven MT-4C3A authority:
- Customer tenant repository/service/controller and Customer-Aircraft relationship conversion COMPLETE / VERIFIED


Proven MT-4C3B DEFINE authority completed and approved:
- 4C3B1 SerializedComponent tenant repository/authenticity COMPLETE / VERIFIED
- 4C3B2 Library SerializedComponent root/life/history service and route authority conversion COMPLETE / VERIFIED
- 4C3B3 AircraftComponent and AircraftComponentInstallation tenant read repositories COMPLETE / VERIFIED
- 4C3B4 Serialized-component installation, baseline-capture and removal atomic tenant-authority conversion COMPLETE / VERIFIED




Completed and verified work:
`4C3B5 — Aircraft utilisation + serialized life-state/local component-life calculation/monitoring/preview conversion`

4C3B5 context:
- Implementation is COMPLETE / VERIFIED
- Verification marker: `JUPITER_MT4_SLICE_4C3B5_VERIFY_PASS`
- Focused verification: 52/52 database-backed tests PASS and 11/11 DB-free tests PASS
- Tenant-authorized aircraft utilisation, local serialized-component life calculation,
  local `monitorInstallation`, and utilisation propagation preview are verified
- Both-root Aircraft tenant and SerializedComponent custodian enforcement is preserved

MT-4C3B6 is COMPLETE / VERIFIED:

- B6.1 aircraft view/component workflow read conversion is COMPLETE / VERIFIED;
- B6.2 legacy AircraftComponent mutation conversion is COMPLETE / VERIFIED;
- B6.3 aircraft compliance-child operations are COMPLETE / VERIFIED.

MT-4C3B7 is COMPLETE / VERIFIED. Static/AST tenant-isolation enforcement
passed 186/186 tests, including rejection of all 5/5 negative fixtures.

MT-4C3B8 is COMPLETE / VERIFIED. Guarded two-tenant live verification passed
4/4 tests against `jupiter_test`, and B7 static enforcement reconfirmed
186/186 PASS. No remaining B1–B8 isolation gap was identified within the
approved MT-4C3B boundary.

MT-4C3C — Workpack Aggregate Tenant Isolation is COMPLETE / VERIFIED.
Workpack historical tenant authority and authentic `TenantQueryAuthority` now
govern the Workpack, PlanningSession, task, snag, audit, execution, and
component-integration boundaries. Cross-tenant ambiguous TaskCards are neutral
and unavailable. Migrations 591–593 repair standalone-snag and mandatory audit
history nullability and were applied only to `jupiter_test`; production was not
migrated. Verification passed 14/14 DB-free tests and 9/9 guarded
`jupiter_test` tests. The unrelated existing TypeScript cast error in
`aircraft-component-tenant.repository.live.ts` remains outside MT-4C3C.

MT-4C4 — Tenant-Authorized Broad Due Monitoring is COMPLETE / VERIFIED.
All seven `CalendarDueMonitorService` recalculation methods,
`ComponentLimitMonitoringService.monitorAircraft`, the broad component-life
calculation path, and directly affected compliance/scheduled-task recalculation
callers require authentic tenant authority. Tenant-wide enumeration is confined
to one tenant, Aircraft and SerializedComponent installation roots retain
both-root enforcement, and guarded two-tenant monitoring is verified.
Verification passed 20/20 DB-free tests and 49/49 guarded `jupiter_test` tests.
No schema, migration, production, RBAC, RLS, tenant-gate, or scheduler work was
performed. The unrelated stale direct-model inventory suite remains outside
MT-4C4.

MT-4C5 — Tenant-Authorized Operational Dashboard Aggregates is COMPLETE /
VERIFIED. Authenticated `GET /` receives authentic `TenantQueryAuthority`
through route-local `requireValidActiveTenantContext`; the gate is not mounted
globally. Dashboard aggregates enforce Aircraft, Customer, and historical
Workpack `tenant_id`, SerializedComponent `custodian_tenant_id`, and WorkpackSnag
authority through either its owned Workpack root or, for standalone snags, its
owned Aircraft root. Verification passed 196/196 focused DB-free/static tests
and 3/3 guarded two-tenant `jupiter_test` tests. No schema, migration, or
production change occurred. The unrelated existing AircraftComponent tenant
repository cast error remains outside MT-4C5.

Tenant runtime privilege repair is COMPLETE / VERIFIED. Additive migration
`594_grant_tenant_login_provisioning_access.ts` grants `jupiter_app` only the
tenant-root reads required by login (`SELECT` on `tenants` and
`tenant_memberships`) and the `INSERT`/`UPDATE` permissions used by the
tenant-switch attempt ledger. It does not grant runtime creation or mutation of
Tenant or TenantMembership roots. Migration 594 is applied to development
`jupiter_db` and guarded `jupiter_test`; production remains untouched. The
approved provisioning service created the development `JUPITER_DEV` tenant and
active admin membership under PostgreSQL administrator authority, and login
with persisted active tenant context was verified end to end.

MT-4C6B1 — Legacy Component Custody and Immutable History Foundation is
COMPLETE / VERIFIED. Migration 595 adds durable non-null
`aircraft_components.custodian_tenant_id`, deterministic Aircraft-tenant
backfill, custody FK/index/normalized identity enforcement, immutable custody
and Aircraft-tenant-match triggers, and constrained immutable
`aircraft_component_movement_history`. No retrospective movement rows were
fabricated. Migration 596 repairs effective runtime privileges so `jupiter_app`
has `SELECT` and `INSERT`, but not `UPDATE` or `DELETE`, on movement history.
Verification passed 241/241 DB-free/static tests and 5/5 guarded `jupiter_test`
tests. Migrations 595 and 596 are applied to local development `jupiter_db` and
guarded `jupiter_test`; production remains untouched at its last established
migration 581.

MT-4C6B2 — Authoritative Legacy Component Inventory Mutation and Same-Tenant
Reinstall is COMPLETE / VERIFIED. The mounted `/inventory/remove/:componentId`
and `/inventory/install/:componentId` mutations now require authentic tenant
and actor authority and delegate to the canonical AircraftComponent lifecycle.
Removal is `INSTALLED → REMOVED`; reinstall is `REMOVED → INSTALLED` on an
ACTIVE same-tenant Aircraft. Custody and the removal Aircraft link are
preserved, accrued TSN/TSO is carried, optimistic versions advance, and each
state mutation atomically appends its server-timed immutable movement event.
Foreign and nonexistent component/Aircraft identifiers remain neutrally
unavailable. Focused verification passed 35/35 DB-free/static tests and 10/10
guarded `jupiter_test` tests. No schema, migration, production, SerializedComponent,
projection, RBAC/RLS, or global tenant-gate change occurred.

MT-4C6B3 — Tenant-Authorized Fleet Projection Conversion is COMPLETE /
VERIFIED. `GET /projection/fleet-health` and `GET /projection/summary` use a
route-local active-tenant gate and authentic `TenantQueryAuthority` through the
projection service/repository. Database predicates scope Aircraft ownership,
installed component Aircraft/custody agreement, and removed inventory custody.
Both endpoints share truthful NORMAL/CRITICAL/EXPIRED/UNKNOWN calculations and
do not use stale `components`, `SERVICEABLE`, or `vw_component_status` runtime
sources. Focused DB-free verification passed 5/5 tests and the B3 file set
passed `git diff --check`. Repository-wide `git diff --check` noise in
`seeders/040_library_seed.ts` was proven pre-existing, user-owned, and outside
B3. No schema or migration change occurred, and pre-existing working-tree
changes remain preserved.

MT-4C7A — Tenant-Authorized Audit Viewing and Export is COMPLETE / VERIFIED.
`GET /audit` and `GET /audit/export` use a route-local active-tenant gate and
authentic `TenantQueryAuthority` through route, service, and repository. All
eight approved ownership mappings, fail-closed handling for unknown, shared,
platform, missing, malformed, and ambiguous records, and list/export
equivalence are verified. Focused DB-free tests passed 6/6; guarded two-tenant
live tests passed 3/3, covering all mappings, same-tenant visibility,
foreign-tenant invisibility, linked/standalone snag rules, ambiguous TaskCard
denial, and adversarial filters. Residual fixtures from the failed first live-
test attempt were safely removed from guarded `jupiter_test` without changing
unrelated test data; trigger protections were restored, and final verification
left zero residual fixtures. Utilisation immutability triggers and the current
110-entry migration ledger remained enabled and unchanged. The scoped
`git diff --check` passed. Build/typecheck reports only the established
unrelated cast error in `aircraft-component-tenant.repository.live.ts`, with no
MT-4C7A compile error. No schema, migration, RBAC, audit-write, or unrelated
functionality change occurred.

MT-4C7B — Tenant-Authorized Uploaded-File Delivery is COMPLETE / VERIFIED.
Broad unauthenticated `/uploads` static delivery was removed; public static
handling excludes `/uploads/*`, and explicit Aircraft and authenticated shared-
Manufacturer routes preserve existing URL forms while every unapproved upload
area fails closed. Aircraft delivery requires authentication, a valid active
tenant, authentic `TenantQueryAuthority`, exactly one canonical persisted photo
reference, matching Aircraft ownership, and safe physical-file resolution.
Zero, foreign, same-tenant duplicate, cross-tenant duplicate, traversal and
encoded traversal, separator, percent, NUL/control, absolute/drive, escaped
realpath, symlink, non-file, and missing-file cases are denied. Manufacturer
logos remain authenticated shared-master content without invented tenant
ownership. Service Bulletin imports, compliance files, and other unapproved
areas are unavailable over HTTP. Delivery retains inline MIME, content-length,
conditional/range, and `Last-Modified` behavior; Aircraft caching is private/no-
store and Manufacturer caching is private/revalidated. Verification passed 9/9
DB-free tests and 3/3 guarded two-tenant live tests. Guarded `jupiter_test`
identity, database totals, trigger hashes, and the current 110-entry migration
ledger remained unchanged; database and filesystem residue were zero. Root
`/uploads/` remains ignored while `src/modules/uploads/` is trackable. The
scoped diff check passed. Build reports only the established unrelated
AircraftComponent cast error and no MT-4C7B compile error. No schema, migration,
upload-creation, RBAC, Customer Portal, Service Bulletin/compliance architecture,
global tenant-gate, background-job, or RLS change occurred.

MT-4C7C — Customer Portal Tenant-Root Isolation is COMPLETE / VERIFIED.
All five mounted Customer Portal reads now resolve a dedicated branded
`CustomerPortalQueryAuthority` from the current persisted ACTIVE CustomerUser,
ACTIVE Customer, and ACTIVE Tenant before using tenant/root-constrained service
and repository projections. Authority contains only the persisted CustomerUser,
Customer, and Tenant IDs; session `customer_id`, client ownership identifiers,
and staff `TenantQueryAuthority` are not authority. Aircraft requires an
approved current Customer–Aircraft role and matching Customer/Aircraft tenant
roots; Workpacks additionally require their persisted tenant root to match.
Released document metadata uses the same authorized Workpack population with
`released_at IS NOT NULL`, and completed compliance derives through that
authorized chain without treating `workpack_compliance` or shared compliance
metadata as ownership roots. Foreign, missing, inactive, malformed,
tenant-conflicting, and unsupported relationships fail closed.

Initial verification found that malformed session CustomerUser IDs could reach
PostgreSQL UUID casting. A narrow repair added application-level UUID validation
before repository/database access. Fresh verification proved unusable IDs take
the generic unavailable path without lookup, authority creation, SQL error
disclosure, or route/service execution. Focused DB-free tests passed 10/10 and
guarded `jupiter_test` tests passed 3/3, including adversarial cross-tenant links
and conflicting Workpack roots. Rollback left zero residue; the migration ledger
and trigger snapshot were unchanged, and the scoped diff check passed. Legacy
regression results were 212/216, with four established out-of-scope stale
migration/raw-source inventory assertions; Customer Portal assertions passed.
Typecheck reports only the established unrelated AircraftComponent cast error
and no MT-4C7C compile error. No schema, migration, visual, physical-download,
session-model, staff-authority, RBAC, Platform Administrator, global gate,
background-job, RLS, or unrelated functionality change occurred.

MT-4C7D — Tenant-Authorized Serialized Component Reconciliation Report is
COMPLETE / VERIFIED. The mounted report follows authentication, `LIBRARY_EDIT`,
the route-local active-tenant gate, authentic `TenantQueryAuthority`, and the
controller/service/repository boundary; no global active-tenant gate was
introduced. Legacy rows require matching component custody and Aircraft tenant
ownership, and current serialized installations require matching
SerializedComponent custody and Aircraft ownership. Foreign, broken, missing,
or conflicting roots fail closed before reconciliation calculations, so foreign
data cannot influence matching, duplicate/conflict detection, buckets,
exceptions, readiness, registrations/details, or counts. Same-tenant ambiguity
retains `INSTALLATION_CONFLICT`. Summary counts are tenant-local, including
uninstalled tenant-custodied SerializedComponents without fabricated detail
rows. Shared masters remain decorative ownership-neutral data. Existing
buckets, matching, ordering, presentation, output shape, and view remain
compatible; the excluded global migration compatibility loader is not reachable
from the mounted report. Verification passed 6/6 focused DB-free tests, 15/15
direct regressions, and 3/3 guarded two-tenant `jupiter_test` tests. The guarded
live test rolled back with zero residue and unchanged migration ledger, relevant
totals, and trigger state; scoped `git diff --check` passed. Build exposed no
MT-4C7D error; the established unrelated TS2352 error remains in
`aircraft-component-tenant.repository.live.ts`. No schema, migration, custody
repair, view redesign, RBAC, global-gate, RLS, or unrelated functionality change
occurred.

MT-4C8A — Tenant-Authorized Migration Dry-Run and Ledger Tooling is COMPLETE /
VERIFIED. The tenant-local preview, save, and batch-read routes enforce
authentication, `LIBRARY_EDIT`, a route-local valid active-tenant context, and
authentic `TenantQueryAuthority`; save retains CSRF, no global gate or
Platform/System Owner authority was introduced, and suspension denies access
without rewriting evidence. Legacy rows require matching custody and Aircraft
ownership; SerializedComponents and current installations are tenant-scoped
before calculations, with Aircraft ID filter-only. Foreign data cannot affect
matching, conflicts, proposals, readiness, or counts. The mounted workflow uses
the MT-4C7D tenant-authorized reconciliation path, not the global compatibility
loader. Save regenerates the authorized preview and atomically rejects mixed,
foreign, or unverifiable populations. Migration 597 adds immutable, indexed,
UUID `NOT NULL` batch tenant ownership with a restrictive Tenant FK; child rows
inherit ownership through the parent. Reads predicate on batch and tenant IDs,
with neutral handling of foreign, malformed, and nonexistent IDs. Historical
backfill is deterministic-only and refuses ambiguity; both local ledgers were
empty, so no ownership was guessed. Verification passed 8/8 DB-free/static,
21/21 direct regression, 3/3 guarded two-tenant, and 5/5 guarded migration tests.
Exact `jupiter_test` retained migration 597 with zero batch, row, or audit fixture
residue; scoped `git diff --check` passed and no MT-4C8A build/type error exists.
The first DB invocation safely refused without mutation because its quarantine
flag was absent; the explicitly authorized guarded rerun passed. VERIFY changed
no files, production was untouched, and nothing was staged, committed, pushed,
or deployed. The established unrelated TS2352 remains in
`aircraft-component-tenant.repository.live.ts`.

Level 1 — Operational Authority Activation on Tenant-Owned Mounted Routes is
COMPLETE / VERIFIED. Aircraft tenant-owned routes now use the route-local
active-tenant gate before upload, CSRF, validation, and controller processing;
the shared Manufacturer/Model selector remains intentionally ungated. All
Customer routes, all tenant-owned Workpack controllers after existing RBAC, both
Inventory install/remove operations, and exactly nine tenant-owned
SerializedComponent Library routes are gated. Shared Workpack template import
and shared Library selectors remain excluded, while Library reconciliation and
migration tooling retain their independent gates. No global gate was added.
Authentic branded `TenantQueryAuthority` remains the ownership authority, and
missing, malformed, fabricated, stale, suspended, or foreign contexts fail
closed. Aircraft-photo post-upload residue cleanup remains deferred.
Verification passed 8/8 DB-free/static and 14/14 guarded exact-`jupiter_test`
tests. Direct regressions were 55/58; the three failures are confirmed stale
baseline assertions (two expect migration 591 to be absent and one expects
removed direct Aircraft model calls). Database verification rolled back with
zero migration-batch, migration-row, or audit residue, unchanged relevant totals
and triggers, and no filesystem fixture residue. Scoped `git diff --check`
passed; no slice-specific build/type error exists, and the established unrelated
TS2352 remains in `aircraft-component-tenant.repository.live.ts`. VERIFY changed
no files; HEAD remained unchanged and nothing was staged, committed, pushed, or
deployed.

Level 1 — Aircraft Photo Persistence Lifecycle is COMPLETE / VERIFIED. The
mounted `POST /aircraft`, `POST /aircraft/:id`, and `PATCH /aircraft/:id`
sequence remains authentication/RBAC, active-tenant gate, request lifecycle,
Multer, CSRF, controller, then authority-aware service/repository; tenant
validation therefore precedes persistence. Aircraft filenames use
collision-resistant `randomUUID()` naming without changing Manufacturer or
Service Bulletin naming. Tracking trusts only Multer metadata, and idempotent
cleanup is confined to the current request's uncommitted file after canonical
reference, basename, upload-root, containment, regular-file, traversal, symlink,
and alternative-target checks. Create/update commit only after service success;
CSRF, validation, foreign/nonexistent Aircraft, stale-version, and service or
transaction failures remove the new upload. Committed files survive `finish`
and `close`, while premature-close cleanup waits for controller settlement.
Failed replacement preserves the prior database reference and file; successful
replacement retains the old physical file. Historical orphan cleanup and old-
photo deletion remain excluded, shared-reference behavior is unchanged, and C7B
delivery is unchanged. Verification passed 25/25 DB-free, 4/4 guarded exact-
`jupiter_test` plus filesystem, and 21/21 direct regressions (Aircraft authority
4/4, C7B 9/9, Operational Authority 8/8). Guarded work rolled back with relevant
totals/triggers unchanged and zero migration-batch, migration-row, audit, or
filesystem residue. Scoped `git diff --check` passed; no slice-specific build
error exists, and only the established unrelated TS2352 remains in
`aircraft-component-tenant.repository.live.ts`. VERIFY changed no files; HEAD
and staging/commit/push/deploy/migration state were unchanged.

Level 1 Tenant-Local Staff and Role Administration DEFINE is COMPLETE. The only
mounted administration surface is `GET /auth/staff` and `POST
/auth/staff/toggle-role`. Both currently require authenticated global `ADMIN`,
but have no route-local active-tenant gate: the GET enumerates every `users`
row and every shared `rf_role`, while the POST accepts arbitrary user/role IDs
and mutates global `user_roles`. No mounted staff create/view/edit/status,
invitation, role CRUD, permission CRUD, role-permission edit, search, lookup, or
API administration endpoint exists. Users are global login identities;
`tenant_memberships` is the tenant ownership root. Shared/system-locked
`rf_role` and `rf_permission` definitions and global role-permission mappings
remain reference/RBAC definitions. Existing `tenant_membership_roles` supplies
tenant-local append/revoke assignment history and requires no schema change.

The authorized IMPLEMENT boundary is: create an authority-first staff/role
repository and service; convert the staff router to an injected factory; mount
authentication, tenant-local ADMIN/RBAC authorization, then the route-local
active-tenant gate; list only memberships belonging to the authentic active
tenant; expose only active assignable shared roles; and assign/revoke only the
target membership in that same tenant, atomically and with actor audit fields.
Missing, malformed, fabricated, stale, suspended, foreign, conflicting, or
ambiguous membership/role/authority input must fail closed without mutation.
Client tenant IDs are never authority. Active-tenant request RBAC must be
hydrated from unrevoked `tenant_membership_roles`, so role changes are
tenant-local; global `user_roles` must no longer authorize tenant-facing mounted
operations. Keep it only for evidenced legacy compatibility. Do not invent a
Platform/System Owner bypass: no distinct platform-owner principal or mounted
platform staff-administration surface currently exists. Preserve URLs, HTMX
checkbox workflow, CSRF, ADMIN requirement, shared permission definitions and
mappings, login and organisation-selection behavior, and non-administration
RBAC contracts.

Expected IMPLEMENT files are `src/app.ts`, `src/modules/auth/staff.routes.ts`,
`src/modules/auth/auth.config.ts` and/or a narrowly scoped active-tenant RBAC
hydration module, plus new staff/role authority repository/service modules and
focused tests. Existing tenancy context/authority, RBAC middleware, models,
associations, and the view should change only if focused implementation evidence
requires a minimal compatibility adjustment. No migration is required.

Level 1 Tenant-Local Staff and Role Administration is COMPLETE / VERIFIED. The
mounted staff router follows
authentication, active-membership RBAC hydration, tenant-local `ADMIN`, the
route-local valid active-tenant gate, authentic `TenantQueryAuthority`, and an
authority-first service/repository. Listing is rooted in ACTIVE
`tenant_memberships`; assignment and revocation are atomic, target the matching
active-tenant membership, preserve append/revoke history and authenticated actor
evidence, and never mutate `user_roles`. Shared active roles and their permission
mappings remain read-only definitions. Missing, fabricated, malformed,
inactive, and foreign targets fail closed. Independent formal verification
passed 47/47 focused DB-free/RBAC/tenant-context tests, 17/17 direct
authentication regressions, and 3/3 guarded exact-`jupiter_test` two-tenant
tests. Rollback restored row and audit totals, migration ledger,
shared-definition hashes, and enabled-trigger count exactly; no persistent
cross-tenant assignment or fixture residue remained. Scoped diff-check passed.
Build reports only the established unrelated TS2352. No schema, migration,
production, staging, commit, push, or deployment action occurred.

Restrictions:
- No Level-2 implementation beyond the completed L2-1 foundation is authorized
- RLS remains deferred
- No production deployment authorised
- No further migration authorised
- All Level-1 implementation slices are COMPLETE / VERIFIED.
- L1-4 Final Mounted Adversarial Isolation Verification is COMPLETE / VERIFIED.
  The final mounted inventory covered tenant-owned
  Aircraft, Customers and relationships, Workpacks/tasks/snags, compliance,
  inventory/component custody, tenant-owned Library operations, dashboard and
  projections, staff/RBAC, audit, migration tooling, Customer Portal, and
  guarded files/uploads. Shared Library masters and Manufacturer files remain
  intentionally shared; authentication/session/organisation routes and ping,
  offline, reference, and shared-master routes are not tenant-owned operational
  roots. Focused final-composition contracts passed 77/77. Guarded exact
  `jupiter_test` adversarial tests passed 44/44 across 13 files. Rollback
  restored row and audit totals; fixture, role-assignment, and filesystem
  residue were zero; migration ledger, triggers, batches, and shared invariants
  were unchanged. The broader DB-free sweep passed
  640/651; all 11 failures are established stale historical expectations for
  superseded migration/direct-model/raw-query inventories, not application-level
  tenant-isolation defects. Build retains only the established unrelated TS2352.
  Schema and migrations were unchanged and none were applied. No Level-1
  isolation defect was found, and no application implementation changed.
- All Level-1 implementation slices and L1-4 are COMPLETE / VERIFIED.
- Canonical Level-1 programme state:
  `APPLICATION_LEVEL_MULTI_TENANT_ISOLATION_COMPLETE`.
- Shared/reference-master curator authority is the defined Level-2 boundary;
  investigation and DEFINE are complete. No shared-master route conversion is
  authorized or begun.
- L2-1 Platform Authority Foundation is COMPLETE / VERIFIED.

Level 2 — Shared / Reference-Master Curator Authority investigation and DEFINE
is COMPLETE. The evidence-backed inventory, current global authority exposure,
required fail-closed curator model, schema assessment, and implementation slices
are recorded in
[`LEVEL2_SHARED_REFERENCE_MASTER_CURATOR_DEFINE.md`](LEVEL2_SHARED_REFERENCE_MASTER_CURATOR_DEFINE.md).
The Project Owner policy decisions are incorporated and L2-1 Platform Authority
Foundation is COMPLETE / VERIFIED in
[`LEVEL2_PLATFORM_AUTHORITY_FOUNDATION_DEFINE.md`](LEVEL2_PLATFORM_AUTHORITY_FOUNDATION_DEFINE.md).
Repository-only authority issuance, fabricated-authority rejection, complete
tenant/platform and human/service separation, transactional grant/revoke and
stale-authority rejection, multiple-owner support, concurrent last-owner
protection, immutable platform-global audit, and the exact guarded bootstrap
boundary are verified. Bootstrap requires the exact 112-entry authoritative
migration ledger at head 598, all four tables, both capability seeds, enabled
audit immutability, exact active user/database identity, normalized email, and
explicit confirmation. Durable `SYSTEM_OWNER_BOOTSTRAPPED` evidence prevents
replay after revocation, deactivation, or later authority changes. Migration
598 clean UP/DOWN and populated-DOWN refusal passed. Verification passed 32/32
L2-1 DB-free, 5/5 guarded `jupiter_test`, 16/16 Level-1 DB-free regression, and
4/4 guarded Level-1 regression tests; final residue was zero, ledger head 598,
both capability seeds and the enabled audit trigger were preserved, scoped
`git diff --check` passed, and build retained only the established unrelated
TS2352. The real bootstrap was not executed. No shared-master route was
converted, no tenant-lifecycle work began, and no Level-1 boundary was weakened.
L2-2 — Fail-Closed Authority Boundary DEFINE is COMPLETE in
[`LEVEL2_FAIL_CLOSED_AUTHORITY_BOUNDARY_DEFINE.md`](LEVEL2_FAIL_CLOSED_AUTHORITY_BOUNDARY_DEFINE.md).
It records the mounted and direct shared-writer inventory, granular capability
map, exact repository-revalidated authority chain, HUMAN/SERVICE rules,
immutable global audit, pre-bootstrap denial, and safe file-effects boundary.
L2-2A Capability and Operation-Policy Foundation is COMPLETE / VERIFIED.
Additive migration 599 seeds the 15 defined granular system-locked capabilities,
17 total platform capability seeds, without wildcard capabilities or automatic
grants and is applied only to guarded `jupiter_test`. Fixed shared-operation and
allowlisted reference/RBAC registries map every approved operation to exactly
one capability and its HUMAN-only or approved HUMAN-or-SERVICE SB synchronization
rule; every exported and resolved policy entry and nested principal-type
collection is independently runtime-immutable. Repository-issued authority is
transactionally revalidated; missing, fabricated, stale, revoked, inactive,
wrong-type, tenant-derived and legacy-role-shaped authority fails closed,
including unconditionally before real bootstrap. Shared reads, mounted writers,
and Level 1 are unchanged. Formal verification passed 36/36 DB-free L2 tests (12 L2-2A plus 24
L2-1), 2/2 guarded L2 tests, 39/39 Level-1 DB-free regressions, and 13/13 guarded
Level-1 regressions. Migration 599 clean DOWN/reapply passed; final residue was
zero, ledger head 599, 17 capability seeds, no automatic grants, and the enabled
L2-1 audit trigger were preserved. Build retained only the established unrelated
TS2352. The real bootstrap was not executed, no shared-master route or writer was
converted beyond the approved foundation, and the Level-1 and L2-1 boundaries
remain intact. L2-2B Mounted Route-Level HUMAN Platform Gates is COMPLETE /
VERIFIED. Authentication precedes the fixed mounted-route
platform gate on every included HUMAN shared/global mutation route, then
existing route-local RBAC, CSRF/upload middleware, and handlers continue
unchanged. Repository-issued active HUMAN authority and each fixed operation
capability are revalidated at the route boundary; tenant/legacy roles,
authentication alone, invalid authority, wrong capability, SERVICE principals,
and pre-bootstrap requests fail closed. Shared reads and tenant-owned Library
mutations remain unchanged. `POST /library/manufacturers` and `POST
/library/manufacturers/:id/update` are **DEFERRED TO L2-2D — upload-dependent
capability boundary** and unchanged. No L2-2C/D enforcement was implemented.
Formal re-verification passed 35/35 focused L2-2B, 71/71 DB-free L2, 2/2 guarded
L2 `jupiter_test`, 39/39 Level-1 DB-free and 13/13 guarded Level-1 regressions;
the repaired SID, AD-import, SB-import, and model-bound SB mappings require all
applicable fixed capabilities. Residue, ledger
head 599, 17 seeds, no grants, and the enabled audit trigger remained intact.
Build retained only the established unrelated TS2352. Mounted HUMAN route gates
are established; deeper service/repository authority enforcement, transactional
write-boundary revalidation, mutation-plus-platform-audit, and direct-writer
protection remain L2-2C. Upload quarantine/promotion/cleanup, SERVICE-principal
synchronization, and both deferred Manufacturer routes remain L2-2D. Level-1,
L2-1, and L2-2A remain intact, and the real bootstrap remains unexecuted. The
L2-2C is **COMPLETE / VERIFIED**. Every remaining DEFINE-assigned HUMAN shared/global writer now
requires repository-issued HUMAN platform authority with its exact fixed
operation set; capability grants and active principal state are revalidated in
the writer transaction, direct calls fail closed, and successful domain writes
and immutable platform-global audit evidence commit atomically. Missing,
fabricated, stale, revoked, inactive, wrong-type, and operation-mismatched
authority is rejected. The approved L2-2D deferral set is unchanged by L2-2C:
Manufacturer create/update and their two upload routes; Service Bulletin sync
and its scheduled chain; automated maintenance-trigger requirement creation;
and `ComplianceProjectionService.projectAdSources`, `projectSbSources`, and
`projectAdAndSbSources`. No authority-optional path was added. Focused L2-2C
tests passed 5/5, platform-authority DB-free regressions 76/76, relevant writer
and route regressions 70/70, guarded L2 authority tests 3/3, and guarded Level-1
tests 21/21 (13 canonical plus 8 operational-authority). The broad DB-free sweep
remains 640/651 with only the 11 established stale historical inventory
assertions. Guarded transactions rolled back with zero fixture residue and
preserved ledger head 599, 17 capability seeds, and the enabled immutable-audit
trigger. Build retains only the established unrelated TS2352. No migration or
schema change was made and the real bootstrap remains unexecuted. The next gate
is Project Owner authorization for a bounded **L2-2C SB allocation relationship
before/after audit repair**. The previous bounded
repair adds transaction-local audit capture and authoritative row locking for
converted update, deactivate, delete, relationship/allocation, mixed
create/update, and life-limit writers. Successful audit now records locked
before-state and deterministic resulting state; delete after-state is null.
Mutation and audit remain one transaction, including forced audit-failure
rollback. Focused repair/domain tests passed 68/68 plus 35/35 supplemental
writer/life-limit tests; platform DB-free regressions passed 80/80, Level-1
DB-free regressions 39/39, and guarded L2 tests 3/3 with zero residue, ledger
head 599, 17 seeds, no automatic grants, and the audit trigger enabled. Build
retains only the established unrelated TS2352. L2-2D deferrals and the
unexecuted real bootstrap remain unchanged; L2-2D has not begun. Focused
re-verification found that `linkSbModelAllocationToModels` and
`createIncompleteModelFromSbAllocation` mutate `service_bulletin_models` and
the allocation row but capture only the original allocation as before-state and
emit result summaries rather than authoritative resulting allocation and
relationship rows. Re-verification stopped without repair or test execution.
The bounded repair now locks and captures each affected allocation, the
deterministic relevant `service_bulletin_models` relationship set, and
applicable existing model state before mutation. It reloads authoritative
allocation, relationship, and created/reused model state after mutation in the
same transaction for the atomic immutable platform audit. Focused writer tests
passed 74/74, platform-authority regressions passed 81/81, and guarded exact
`jupiter_test` authority tests passed 3/3 with zero residue, ledger head 599,
17 capability seeds, no grants, and the immutable-audit trigger enabled. No
schema/migration or bootstrap change occurred. The next gate is Project Owner
authorization required for focused L2-2C RE-VERIFY.
Focused formal re-verification passed both audit repairs. The two SB allocation
writers capture locked authoritative allocation, deterministic relationship,
and applicable model pre-state, then reload persisted post-state within the
same mutation/audit transaction. Earlier component-model, maintenance,
reference/RBAC, regulatory, SID/import, interactive SB, and life-limit audit
repairs remain verified. Focused writer tests passed 74/74, L2 authority tests
81/81, and guarded exact `jupiter_test` tests 3/3 with zero residue, ledger head
599, 17 capability seeds, no automatic grants, and the audit trigger enabled.
The wider Level-1 selection passed 63/66; its three failures are the established
stale historical inventory assertions and not tenancy or L2-2C defects. Build
retains only the established unrelated TS2352. All L2-2D deferrals and the
unexecuted real bootstrap remain unchanged. The next gate is Project Owner
authorization required for L2-2D according to canonical programme state.
L2-2D File and SERVICE-Principal Authority Boundary is **DEFINE COMPLETE /
READY FOR BOUNDED IMPLEMENT AUTHORIZATION**. Evidence confirms the deferred
inventory comprises Manufacturer create/update and file effects, manual and
scheduled SB synchronization, the dormant maintenance-trigger shared-master
writer, and the dormant Compliance Projection writers. Existing granular
capabilities and fixed operations are sufficient; no new capability or
automatic grant is required. Additive migration 600 is required only for a
durable file-operation journal that closes database/filesystem crash windows.
The maintenance trigger's tenant-specific serial warning must not create a
global master, and the uncalled projection writers receive no invented
authority. The proposed bounded sequence is D1 durable file-operation
foundation, D2 Manufacturer HUMAN file boundary, D3 HUMAN/SERVICE SB sync, and
D4 dormant automated-writer closure, each with its own verification gate. No
implementation, migration, bootstrap, principal, grant, route, upload or
scheduler change occurred. The next gate is Project Owner authorization for
**L2-2D1 — Durable File-Operation Foundation IMPLEMENT**.
L2-2D1 Durable File-Operation Foundation is **COMPLETE / VERIFIED**. Additive migration 600 creates only the constrained durable
`platform_file_operations` journal. The reusable foundation provides fixed
root keys, UUID names, byte-signature/MIME validation, containment and symlink
checks, validation-to-promotion digest revalidation, explicit PROMOTING crash
state, controlled rename, idempotent bounded cleanup, and journal-only recovery
that preserves committed files. Migration 600 passed guarded UP/DOWN/reapply
and populated-DOWN refusal on exact `jupiter_test`. Focused D1/bootstrap tests
passed 33/33; directly relevant upload, Aircraft Photo and L2 regressions passed
130/130; guarded D1 passed 2/2 and guarded L2 authority passed 3/3. Residue is
zero, ledger head is 600, 17 capability seeds and immutable audit trigger are
unchanged, and no grants/bootstrap occurred. Manufacturer and SB flows remain
unconverted; D2 has not begun. The next gate is Project Owner authorization
required for formal focused VERIFY of L2-2D1. Formal focused verification
passed 131/131 DB-free tests and 5/5 guarded exact `jupiter_test` tests.
Migration 600 schema, constraints, recovery index, populated-DOWN refusal,
DOWN, and reapply passed. Journal-bounded recovery, explicit PROMOTING crash
handling, digest revalidation, controlled promotion, idempotent cleanup, and
committed-file preservation were verified with zero database/filesystem
residue. Ledger head 600, 17 capability seeds, no grants, and immutable
platform-audit protection remain intact. Manufacturer and SB business flows
remain unconverted; no bootstrap or production migration occurred. Build
retains only the established unrelated TS2352 and scoped diff check passed. The
next gate is Project Owner authorization required for **L2-2D2 Manufacturer
HUMAN File Boundary IMPLEMENT**.
L2-2D2 Manufacturer HUMAN File Boundary is **COMPLETE / VERIFIED**. Both deferred Manufacturer mutations require repository-issued
active HUMAN platform authority for the master operation; a D1-issued opaque
file commit and `MANUFACTURER_FILE_REPLACE` are additionally required only when
a logo is added or replaced. Files use private quarantine, byte validation,
digest revalidation, UUID promotion, journal-bounded recovery and safe cleanup.
The authoritative prior logo is captured under the locked mutation transaction;
master mutation and immutable before/after platform audit are atomic, failed
work leaves no success audit or durable new file, and a committed prior logo is
removed only after the new database reference is proven. Focused DB-free tests
passed 68/68 and guarded exact `jupiter_test` tests passed 3/3 with zero fixture
residue, ledger head 600, 17 capability seeds and the audit trigger preserved.
Formal focused verification passed 68/68 DB-free and 3/3 guarded exact
`jupiter_test`; residue remained zero, ledger head 600, 17 capability seeds,
zero grants/SERVICE principals/bootstrap evidence, and the enabled immutable
audit trigger were confirmed. Build retains only the established unrelated
TS2352. The next gate is Project Owner authorization required for **L2-2D3
HUMAN/SERVICE SB Synchronization IMPLEMENT**.
L2-2D3 HUMAN/SERVICE SB Synchronization is **COMPLETE / VERIFIED**. Manual synchronization requires repository-issued HUMAN authority;
scheduled execution resolves exact `SB_SYNC_SCHEDULER` SERVICE authority fresh
at startup and every run. Both transactionally revalidate only
`SERVICE_BULLETIN_SYNC_EXECUTE`, acquire a database overlap lock, and atomically
commit deterministic SB/link before/after evidence, sync-run state, mutation and
immutable platform audit. The guarded atomic provisioning operation creates
only that SERVICE principal and grant when invoked by a HUMAN System Owner; it
was not executed because the real bootstrap remains unexecuted. Manual CSV/PDF
input uses private D1 quarantine, validation, UUID ephemeral promotion and
journaled cleanup; client server paths are refused and scheduled sources require
explicit trusted-root containment. Focused tests passed 78/78 and guarded exact
`jupiter_test` tests passed 4/4 with zero test residue, ledger head 600, 17
capabilities and the audit trigger preserved. The next gate is Project Owner
authorization required for **L2-2D4 Dormant-Writer Closure IMPLEMENT**. Lean
formal verification reused the fresh 78/78 focused and 4/4 guarded PASS evidence;
the final read-only exact-`jupiter_test` check confirmed 17 capabilities, zero
grants, no provisioned `SB_SYNC_SCHEDULER`, no bootstrap evidence and zero
pending file journals. Scoped diff check passed; the build result remains only
the established unrelated TS2352.
L2-2D4 Dormant-Writer Closure is **COMPLETE / VERIFIED**.
`MaintenanceTriggerService.evaluateComponentTBO` fails closed before any shared
master write or tenant workpack attachment. The three dormant Compliance
Projection entry points fail closed before transactions, source reads or
`ComplianceItem` writes; legitimate projection reads remain unchanged. No
capability, principal, grant, migration, bootstrap, database state or completed
D1/D2/D3 behavior changed. Focused closure/read tests passed 11/11. No guarded
database test was required because the closed entries execute no database path.
Build retains only the established unrelated TS2352. Minimal formal verification
reused the fresh 11/11 focused evidence and confirmed the four public writer
entries fail closed immediately; no new tests, database checks or build were
required. L2-2E full mounted/direct/cron/file/concurrency adversarial
verification is **COMPLETE / VERIFIED**. The approved
nine DB-free groups passed 78/78 and the three guarded exact-`jupiter_test`
groups passed 4/4. Mounted/direct authority, transactional revocation,
HUMAN/SERVICE separation, scheduler overlap locking, file safety/recovery,
atomic mutation/audit rollback, dormant-writer closure and pre-bootstrap denial
passed. Guarded rollback left zero residue with ledger head 600, 17 capability
seeds, no unintended grants/provisioning and the immutable audit trigger intact.
L2-2 Fail-Closed Authority Boundary is therefore **COMPLETE / VERIFIED**;
Level 2 remains in progress. The next canonical programme item is L2-3 Generic
Reference/RBAC Definitions. The next gate is Project Owner authorization
required for **L2-3 Generic Reference/RBAC Definitions DEFINE / INVESTIGATE**.
The consolidated L2-3 through L2-7 reconciliation DEFINE is complete in
[`LEVEL2_L2_3_TO_L2_7_RECONCILIATION_DEFINE.md`](LEVEL2_L2_3_TO_L2_7_RECONCILIATION_DEFINE.md).
All operative L2-3–L2-7 requirements are already satisfied and verified by
L2-2A–E; no residual implementation exists. Dormant maintenance/projection
authority is superseded by fail-closed closure, while real bootstrap and
SERVICE provisioning remain separate operational actions. The shortest safe
path is L2-8 Final Adversarial Verification followed by separate Level-2
governance closeout. The next gate is Project Owner authorization required for
**L2-8 Final Adversarial Verification**.
The first L2-8 attempt stopped on a stale L2-2C regression contract that still
expected the pre-D4 `evaluateComponentTBO` inventory text. The bounded repair
now asserts the verified `DORMANT_MAINTENANCE_SHARED_WRITER_DISABLED` contract;
the directly affected test passed 4/4. L2-8 stale L2-2C/D4 regression contract
repair is **COMPLETE / READY FOR L2-8 RE-VERIFY**. L2-8 remains not passed. The
next gate is Project Owner authorization required for **L2-8 Final Adversarial
RE-VERIFY**.
The bounded production-import inventory reconciliation is **COMPLETE / READY
FOR L2-8 RE-VERIFY**. Its exact allowlist now includes the 17 verified Library
and Workpack production consumers previously omitted, while preserving
test-support and D4-disabled exclusions, delegated Workpack enforcement,
mandatory assertion/delegation checks, and forbidden fallback/query checks.
The affected test passed 8/8, the blocking Level-1 selection passed 16/16, and
the L2-8 DB-free prerequisite passed 36/36. L2-8 remains not passed. The next
gate remains Project Owner authorization required for **L2-8 Final Adversarial
RE-VERIFY**.
L2-8 Final Level-2 Adversarial Verification is **VERIFY PASS / awaiting
Level-2 governance closeout**. Fresh passing evidence comprises the 16/16
targeted Level-1 selection, 36/36 L2-8 DB-free selection, and 4/4 guarded exact
`jupiter_test` groups. Guarded rollback left zero database/filesystem residue,
ledger head 600, 17 capabilities, no unintended grants/principals/bootstrap,
and the immutable audit trigger intact. Combined authority, revocation,
HUMAN/SERVICE separation, scheduler concurrency, file recovery, audit rollback,
dormant-writer closure and pre-bootstrap denial passed. The next gate is Project
Owner authorization required for **Level-2 GOVERNANCE CLOSEOUT**.
Level 2 — Shared / Reference-Master Curator Authority is **COMPLETE / VERIFIED**.
The platform/shared-master authority boundary is complete and L2-8 final
adversarial verification passed. L2-3 through L2-7 are canonically reconciled
as already satisfied/verified or superseded. The real System Owner bootstrap
and operational `SB_SYNC_SCHEDULER` SERVICE provisioning remain unexecuted and
require separate explicit authorization. No production migration was performed.
At Level-2 closeout no successor programme had been defined or begun; the next
gate was Project Owner authorization to **DEFINE the successor programme level**.

### Level 3 — Tenant Provisioning and Lifecycle Administration

Consolidated DEFINE / INVESTIGATE is **COMPLETE** in
[`LEVEL3_TENANT_PROVISIONING_LIFECYCLE_DEFINE.md`](LEVEL3_TENANT_PROVISIONING_LIFECYCLE_DEFINE.md).
Level 3 reuses the verified Level-1 tenant-isolation and Level-2 platform-
authority foundations. Its exact scope is authoritative HUMAN Platform/System
Owner provisioning, activation, suspension, reinstatement, immutable audit,
race-safe mounted/portal/file/job lockout, rollback/recovery, and unconditional
tenant-deletion protection. Suspension preserves all tenant data, files,
memberships, identity, relationships, and history. Transfer, quotas, archive/
delete, RLS, bootstrap, SERVICE provisioning, and production action are
excluded or deferred. No implementation has begun.

The next gate is Project Owner authorization required for **L3-1 — Lifecycle
Capability, Persistence, and Coordination Foundation IMPLEMENT**.

L3-1 — Lifecycle Capability, Persistence, and Coordination Foundation is
**IMPLEMENT COMPLETE / READY FOR VERIFY**. Additive migration 601 seeds the
four locked HUMAN lifecycle capabilities, enforces the canonical transition
matrix and immutable lifecycle metadata shape, prohibits tenant deletion
unconditionally, and removes `jupiter_app` tenant DELETE privilege. A common
tenant-keyed transaction advisory-lock foundation provides shared tenant-work
and exclusive lifecycle modes. The fixed policy integrates lifecycle operations
with the existing Level-2 repository authority, live revalidation, and atomic
audit executor; no lifecycle command or mounted enforcement was implemented.
Focused tests passed 6/6 plus 4/4 directly affected Level-2 audit tests; guarded
exact-`jupiter_test` tests passed 3/3 with zero fixture residue, populated-DOWN
refusal, and clean migration DOWN/reapply. Migration 601 is applied only to
`jupiter_test`. Build found the established unrelated TS2352 and a local policy
tuple error that was corrected; the one-build limit prevented a second build,
and the corrected focused tests passed 6/6. The next gate is Project Owner
authorization required for **L3-1 formal focused VERIFY**.

L3-1 Lifecycle Capability, Persistence, and Coordination Foundation is
**COMPLETE / VERIFIED**. Fresh formal verification passed 6/6 focused L3-1
DB-free tests, 4/4 directly affected Level-2 authority/audit tests, and 3/3
guarded exact-`jupiter_test` tests. Migration 601 clean DOWN/reapply passed;
ledger head 601, exactly four locked lifecycle capabilities, enabled transition
and deletion triggers, revoked `jupiter_app` tenant DELETE, and zero fixture
residue were confirmed. The single build confirmed the tuple repair and reports
only the established unrelated TS2352 in
`aircraft-component-tenant.repository.live.ts`. No bootstrap, SERVICE
provisioning, production migration, transfer, quota, archive/delete, RLS,
L3-2 command, L3-3 enforcement, or L3-4 work occurred. The next gate is Project
Owner authorization required for **L3-2 Consolidated Authoritative Lifecycle
Commands IMPLEMENT**.

L3-2 `exactOptionalPropertyTypes` and `publicId` route type repairs are
**COMPLETE / READY FOR L3-2 VERIFY**. Optional `correlationId` and `resourceId`
properties are omitted when absent, and the three lifecycle route parameters
use one fail-closed string narrowing helper consistent with Express route
behavior. Focused L3-2 tests passed 5/5. The single build contains no L3-2 error
and reports only the established unrelated TS2352. No lifecycle semantics,
authority, audit, transaction, rollback, revocation, concurrency, database, or
later-slice behavior changed. The next gate is Project Owner authorization
required for **L3-2 formal focused VERIFY**.

L3-2 Consolidated Authoritative Lifecycle Commands is **COMPLETE / VERIFIED**.
Formal verification reused the fresh 5/5 L3-2 DB-free, 1/1 guarded exact-
`jupiter_test`, 6/6 legacy provisioning closure, and build evidence. One missing
focused adversarial check passed 1/1, proving all three lifecycle `publicId`
route calls use the fail-closed string narrowing boundary. Provision,
activation, suspension, and reinstatement retain exact HUMAN capabilities,
repository-issued authority, live transactional revocation checks, exclusive
tenant coordination, atomic transition/before-after audit, rollback, and
deletion denial. Guarded execution left zero fixture residue. No L3-3 mounted
suspension enforcement or later work began. The next gate is Project Owner
authorization required for **L3-3 Suspension Enforcement IMPLEMENT**.

L3-3 Suspension Enforcement is **IMPLEMENT COMPLETE / READY FOR VERIFY**.
Mounted staff and Customer Portal access now acquire the tenant lifecycle shared
lock and revalidate active tenant state while holding it, so suspension wins
safely against stale sessions and concurrent access. Tenant-owned file delivery
inherits the staff gate; tenant ADMIN and portal identities have no bypass.
Reinstatement restores access to the preserved tenant records and files. The
only mounted scheduler remains the Level-2 platform-global SERVICE job; dormant
tenant writers remain fail closed, so no tenant-job mutation was introduced.
Focused tests passed 6/6 plus 31/31 affected regressions; guarded exact-
`jupiter_test` coordination passed 1/1 with no retained advisory lock. The
single build reports only the established unrelated AircraftComponent TS2352.
The next gate is Project Owner authorization required for **L3-3 formal focused
VERIFY**.

L3-3 Suspension Enforcement is **COMPLETE / VERIFIED**. Formal verification
reused the fresh 6/6 adversarial, 31/31 affected staff/portal/file regression,
1/1 guarded exact-`jupiter_test` coordination, and build evidence. One missing
guarded adversarial check passed 1/1, proving an exclusive lifecycle lock for
one tenant does not block shared access for another tenant. Staff/ADMIN, stale
context, Customer Portal, tenant-file, shared/exclusive race, reinstatement,
data-preservation, global SERVICE scheduler, and dormant-writer boundaries are
verified with no fixture or lock residue. The next gate is Project Owner
authorization required for **L3-4 Final Level-3 Adversarial Verification**.

L3-4 Final Level-3 Adversarial Verification is **VERIFY PASS / awaiting Level-3
governance closeout**. Verified L3-1/L3-2/L3-3 evidence was reused. Fresh
guarded exact-`jupiter_test` cross-boundary verification passed 1/1, proving
atomic authorized suspension/reinstatement, immutable before/after audit,
membership and peer-tenant preservation, deletion denial, rollback, and zero
residue. Three selected Level-1/Level-2 regressions passed 3/3 for operational
isolation, repository-issued HUMAN authority/exact operations, and dormant-
writer closure. No broad suite, build, bootstrap, SERVICE provisioning,
production action, or successor work occurred. The next gate is Project Owner
authorization required for **Level-3 GOVERNANCE CLOSEOUT**.

**LEVEL 3 — TENANT PROVISIONING AND LIFECYCLE ADMINISTRATION — COMPLETE /
VERIFIED.** Tenant provisioning, activation, suspension, and reinstatement
boundaries are complete under exclusive Platform HUMAN authority. Suspension
preserves tenant records and files while denying staff/ADMIN, stale-session,
Customer Portal, tenant-file, and applicable tenant activity; reinstatement
restores legitimate access to the existing data. Cross-tenant isolation remains
verified and tenant deletion remains prohibited. Real System Owner bootstrap,
`SB_SYNC_SCHEDULER` SERVICE provisioning, and production migration/action remain
unexecuted. AircraftComponent TS2352 remains OPEN deferred technical debt
requiring separate bounded investigation/repair. Transfer, quotas,
archival/deletion, and PostgreSQL RLS remain deferred. No successor programme
has been defined or begun. The next gate is **Project Owner authorization to
DEFINE the successor programme level**.

### System Owner lifecycle capability contract (Project Owner decision)

The Project Owner decided the **MERGE model**: the Jupiter System Owner (the top
HUMAN platform administrator) must directly provision, establish the initial
Company Administrator for, activate, suspend, and reinstate companies through
the `/platform` administration UI, while lifecycle capabilities remain granular
and independent of `PLATFORM_AUTHORITY_MANAGE`. The guarded initial bootstrap
now grants exactly six capabilities — `PLATFORM_AUTHORITY_MANAGE`,
`PLATFORM_AUDIT_VIEW`, `TENANT_PROVISION`, `TENANT_ACTIVATE`, `TENANT_SUSPEND`,
and `TENANT_REINSTATE` — with no wildcard authority, no tenant-role fallback, no
implicit expansion from `PLATFORM_AUTHORITY_MANAGE`, and self-grant still
forbidden. Lifecycle actions continue to produce immutable platform audit
attributing the actual executing HUMAN principal. The bounded lifecycle-operator
model remains available for future delegated administration but is not required
for normal System Owner lifecycle work. The `/platform` Tenant/Company UI already
gates on the logged-in principal's explicit `TENANT_*` capabilities and required
no change. The bootstrap runbook
(`docs/runbooks/SYSTEM_OWNER_BOOTSTRAP.md`) is updated to the six-capability
contract. Focused tests prove the exact six-capability bootstrap, no wildcard,
granular lifecycle policy, and forbidden self-grant. No schema migration and no
real operational bootstrap were performed.

### Master Plan governance reconciliation

The Project Owner's **JUPITER AMMS Multi-Tenant SaaS Programme — Complete Master
Execution Plan, baseline 9 September 2026** controls programme level meaning.
Master Plan Level 1 application isolation is COMPLETE / VERIFIED. Repository-
local Level 2 shared-master/platform work and repository-local Level 3 tenant
provisioning/lifecycle work are both completed and verified requirements within
Master Plan Level 2; no completed evidence is superseded or requires repetition.

Master Plan Level 2 remains **PARTIAL**, not complete. Remaining requirements
are System Owner operational activation; a Jupiter-specific provider/
organisation hierarchy business-model decision and resulting requirements;
real System Owner bootstrap; `SB_SYNC_SCHEDULER` SERVICE provisioning;
operational SaaS readiness; onboarding/offboarding; backup, restore, incident,
and lockout procedures; monitoring/alerting; production secrets/configuration/
environment separation; and controlled production migration/deployment
readiness. AircraftComponent TS2352 remains OPEN deferred technical debt needing
separate bounded investigation/repair.

Master Plan Level 3 PostgreSQL RLS is **NOT STARTED** and blocked until required
preceding Master Plan Level-2 gates complete. Final Production SaaS Acceptance
is **NOT STARTED**. The earlier successor-programme gate is superseded by this
Project Owner reconciliation. The exact next gate is Project Owner authorization
for **Master Plan Level 2 Remaining Operational SaaS and Provider/Organisation
Requirements DEFINE / INVESTIGATE**. No implementation, bootstrap, SERVICE
provisioning, RLS, production action, or acceptance is authorized by that gate.

Master Plan Level 2 Remaining Operational SaaS and Provider/Organisation
Requirements DEFINE / INVESTIGATE is **COMPLETE** in
[`MASTER_PLAN_LEVEL2_REMAINING_REQUIREMENTS_DEFINE.md`](MASTER_PLAN_LEVEL2_REMAINING_REQUIREMENTS_DEFINE.md).
Verified foundations remain closed. The finite remaining plan is MP2-R1
operating-model decisions/contracts; MP2-R2 guarded platform operations,
conditional provider hierarchy and privacy-safe observability; MP2-R3 runbooks
and environment/release controls; MP2-R4 non-production readiness verification;
MP2-R5 separately authorized controlled production activation; and MP2-R6 final
Master Plan Level-2 verification/closeout. Master Plan Level 2 remains PARTIAL.
The exact next gate is **Project Owner business decisions required for MP2-R1 —
Operating Model Decisions and Fixed Operational Contracts**. No implementation,
bootstrap, SERVICE provisioning, database action, RLS, production activation, or
TS2352 repair is authorized.

MP2-R1 Operating Model Contract investigation/reconciliation is **COMPLETE;
PROJECT OWNER DECISIONS REQUIRED** in
[`MASTER_PLAN_LEVEL2_MP2_R1_OPERATING_MODEL_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R1_OPERATING_MODEL_DEFINE.md).
The current release has independent Companies/Tenants only; no Provider or
parent/subsidiary tier is required, and that implementation branch is closed.
Verified provisioning, first-admin assignment, isolation, lifecycle/lockout,
platform/shared-master authority, tenant-local staff listing/role toggling, and
database safety foundations are removed from the remaining implementation
workload. Gaps remain in identity/invitation and membership lifecycle,
last-company-admin continuity, employee offboarding, privacy-safe observability,
operational runbooks, secrets/environment contracts, and production readiness.
The exact next gate is **Project Owner decisions required for MP2-R1A —
Identity, Admin Continuity, Offboarding and Operations Contract**. No
implementation or operational action is authorized.

MP2-R1A Identity, Admin Continuity and Offboarding DEFINE is **COMPLETE** in
[`MASTER_PLAN_LEVEL2_MP2_R1A_IDENTITY_ADMIN_OFFBOARDING_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R1A_IDENTITY_ADMIN_OFFBOARDING_DEFINE.md).
Existing first-admin provisioning, membership states, same-tenant role
administration, retained role history, and mounted active-membership
revalidation are reused. The exact next gate is **Project Owner authorization
required for MP2-R1A-1 — Consolidated Identity, Membership Administration and
Admin-Recovery Foundation IMPLEMENT**. No implementation or operational action
is presently authorized.

MP2-R1A-1 Consolidated Identity, Membership Administration and Admin-Recovery
Foundation is **IMPLEMENT COMPLETE / READY FOR FORMAL VERIFY**. Additive
migration 602, opaque one-time invitation/acceptance, tenant-membership
disable/reinstate, atomic immutable membership-authority audit, and exact HUMAN
`TENANT_ADMIN_RECOVER` recovery are
implemented. Guarded exact-`jupiter_test` migration UP/DOWN/reapply succeeded;
the separate live adversarial Vitest launch was blocked before execution by the
tool sandbox and remains formal-VERIFY work. The exact next gate is **Project
Owner authorization required for MP2-R1A-1 formal focused VERIFY**.

The first formal VERIFY remains recorded as **FAIL** because migration 602 had
introduced database last-active-ADMIN enforcement that the Project Owner
clarified is deferred. Additive migration 603 removes only its two triggers and
sole-purpose function; 602 remains immutable. Guarded exact-`jupiter_test` 603
UP/DOWN/reapply and focused state checks pass with ledger head 603, no related
object or fixture residue, and zero `TENANT_ADMIN_RECOVER` grants. MP2-R1A-1 is
**ADDITIVE LAST-ADMIN DATABASE-ENFORCEMENT REPAIR COMPLETE / READY FOR FORMAL
RE-VERIFY**. The exact next gate is **Project Owner authorization required for
MP2-R1A-1 formal focused RE-VERIFY**.

MP2-R1A-1 bounded bootstrap reconciliation and stale lifecycle-test repair are
**COMPLETE / READY FOR FORMAL RE-VERIFY**. Bootstrap now validates the exact
repository ledger through head 603 and the exact 22 active, system-locked
canonical capability codes; database identity, active-user UUID/email,
confirmation, one-time refusal, atomic grants, and immutable audit remain
fail-closed. No real bootstrap occurred. The legitimate ADMIN-recovery POST is
included in the exact lifecycle route inventory. Prior VERIFY/RE-VERIFY failures
remain historical evidence. The exact next gate remains **Project Owner
authorization required for MP2-R1A-1 formal focused RE-VERIFY**.

MP2-R1A-1 — Identity, Membership, Administration & Recovery is **COMPLETE /
VERIFIED**. The historical first VERIFY FAIL, migration 603 repair, first
RE-VERIFY FAIL, and bootstrap reconciliation repair remain recorded above.
Fresh formal evidence passed 3/3 guarded exact-`jupiter_test` cross-boundary
tests and 9/9 tenant staff/role tests; current repair evidence 27/27 is reused.
Ledger head is 603, the exact 22-capability set is intact, deferred last-ADMIN
database enforcement remains absent, `TENANT_ADMIN_RECOVER` remains ungranted,
and all guarded fixtures rolled back. The then-next DEFINE / RECONCILE gate for
MP2-R2 is satisfied by the current record below.

Governance current/next wording is reconciled through MP2-R1A-1 completion.
MP2-R2 — Guarded Platform Operations and Privacy-Safe Observability DEFINE /
RECONCILE is **COMPLETE** in
[`MASTER_PLAN_LEVEL2_MP2_R2_GUARDED_PLATFORM_OPERATIONS_OBSERVABILITY_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R2_GUARDED_PLATFORM_OPERATIONS_OBSERVABILITY_DEFINE.md).
Verified authority, bootstrap, lifecycle, recovery, scheduler and file
foundations are reused. Missing work is a mounted HUMAN System Owner surface,
guarded scheduler invocation, bootstrap preflight/entry-point tooling,
privacy-safe structured events, and startup configuration refusal. No
schema/migration is required. Master Plan Level 2 remains PARTIAL; RLS remains
NOT STARTED; no implementation or operational action began. The exact next gate
is **Project Owner authorization required for MP2-R2 focused IMPLEMENT**.

MP2-R2 focused IMPLEMENT is **COMPLETE / READY FOR FORMAL VERIFY**. A mounted
HUMAN System Owner surface now provides capability-authorized platform reads
and delegates principal/grant/revoke/disable and one-purpose scheduler commands
to the existing transactionally revalidated repository. Guarded bootstrap
preflight/package entry points, privacy-safe structured operational events,
non-disclosing health endpoints, production runtime refusal and explicit
production file-root configuration are implemented. Focused tests pass 132/132
DB-free and 1/1 guarded exact-`jupiter_test`, with zero platform/user residue.
The build has no MP2-R2 error and retains only the established unrelated
AircraftComponent TS2352. No schema/migration, real bootstrap, SERVICE
provisioning, production action, RLS or MP2-R3 work occurred. The exact next
gate is **Project Owner authorization required for MP2-R2 formal focused
VERIFY**.

MP2-R2 — Guarded Platform Operations and Privacy-Safe Observability is
**COMPLETE / VERIFIED**. Lean formal verification passed 57/57 selected
DB-free adversarial checks and 1/1 guarded exact-`jupiter_test` transaction;
rollback assertions confirmed zero platform principal, grant, audit, or test
user residue. The verification confirmed HUMAN-only platform administration,
fresh fail-closed authority, exact scheduler SERVICE purpose, migration-603 and
22-capability bootstrap preflight, privacy-safe telemetry and bounded health,
production/test refusal, and preserved tenant/lifecycle separation. The fresh
implementation evidence (132/132 DB-free, 1/1 guarded, scoped diff and build
with only the established unrelated AircraftComponent TS2352) remains valid.
No production code, schema/migration, bootstrap, provisioning, production,
RLS, or MP2-R3 action occurred. The exact next gate is **Project Owner
authorization required for MP2-R3 focused IMPLEMENT**.

MP2-R3A — Core SaaS Operator Runbooks focused IMPLEMENT is **COMPLETE / READY
FOR FORMAL VERIFY**. Five repository-derived runbooks now cover guarded System
Owner bootstrap, `SB_SYNC_SCHEDULER` provisioning, tenant onboarding, tenant
suspension/reinstatement, and staff offboarding/admin recovery. They record the
current null invitation-delivery and disabled-scheduler recovery gaps, and the
deferred last-active-ADMIN precaution, without inventing replacement
mechanisms. No application, schema/migration, bootstrap, SERVICE provisioning,
production, RLS, or MP2-R3B action occurred. The exact next gate is **Project
Owner authorization required for MP2-R3A formal focused VERIFY**.

MP2-R3A formal VERIFY failed solely because the tenant-onboarding runbook
required unsupported membership/role inspection and tenant-context readiness
while the tenant was still `PROVISIONING`. The bounded documentation repair is
**COMPLETE / READY FOR FORMAL RE-VERIFY**: pre-activation checks are now limited
to returned tenant identity/status and platform audit; activation performs the
repository's active-ADMIN check; tenant-context and ADMIN verification occur
only after status `ACTIVE`. The three known MP2-R3A operational gaps remain
open. No application, schema/migration, database, production, or MP2-R3B action
occurred. The exact next gate is **Project Owner authorization required for
MP2-R3A formal focused RE-VERIFY**.

MP2-R3A — Core SaaS Operator Runbooks is **COMPLETE / VERIFIED**. Ultra-lean
formal RE-VERIFY confirmed the repaired onboarding sequence against the mounted
provision, activation, active-tenant, ADMIN staff, and HUMAN platform-authority
boundaries. The original VERIFY failure and bounded repair remain recorded.
The null invitation-delivery gap is assigned to later MP2-R3 invitation
enablement, disabled-scheduler recovery to later MP2-R3 recovery controls, and
mounted membership-authority audit viewing to later MP2-R3 operator evidence
access. No application, schema/migration, database, production, or MP2-R3B
action occurred. The exact next gate is **Project Owner authorization required
for MP2-R3B focused IMPLEMENT**.

MP2-R3B — Backup, Restore, Incident and Emergency Recovery Runbooks focused
IMPLEMENT is **COMPLETE / READY FOR FORMAL VERIFY**. Four repository-derived
runbooks cover consistent database/file/configuration backup sets, isolated
restore rehearsal, bounded incident response, and existing guarded emergency
lockout controls. RPO and RTO remain Project Owner decisions. Missing backup /
restore orchestration, production topology/provider, scheduler-only shutdown,
secret rotation, deployment recovery, and incident tooling are recorded as
operational gaps rather than invented mechanisms. The three MP2-R3A gaps remain
open. No application, schema/migration, database, backup/restore, production, or
MP2-R3C action occurred. The exact next gate is **Project Owner authorization
required for MP2-R3B formal focused VERIFY**.

MP2-R3B — Backup, Restore, Incident and Emergency Recovery Runbooks is
**COMPLETE / VERIFIED**. Lean formal verification confirmed the database and
five-root backup scope, migration/configuration evidence, isolated restore
rehearsal and consistency checks, all nine incident classes, and only existing
guarded emergency controls. Safety prohibitions, data preservation, peer-tenant
isolation, RPO/RTO decisions, all MP2-R3B operational gaps, and the three
MP2-R3A gaps remain explicit and open. No backup, restore, application,
schema/migration, database, production, or MP2-R3C action occurred. The exact
next gate is **Project Owner authorization required for MP2-R3C focused
IMPLEMENT**.

MP2-R3C — Production Configuration, Secrets and Release-Control Runbooks
focused IMPLEMENT is **COMPLETE / READY FOR FORMAL VERIFY**. Environment
separation, production secret categories/contracts, controlled release,
rollback-versus-forward-repair, post-release verification, a current 582–603
filename/SHA-256 inventory, and an open-gap gate register are documented from
repository evidence. No production topology, provider, secret manager,
deployment mechanism, monitoring transport, RPO or RTO was invented. All
MP2-R3A/B gaps remain open and are classified for MP2-R4, MP2-R5 or later
maturity. No application, schema/migration, database, deployment, production,
or MP2-R4 action occurred. The exact next gate is **Project Owner authorization
required for MP2-R3C formal focused VERIFY**.

MP2-R3C Production Configuration, Secrets and Release-Control Runbooks is
**COMPLETE / VERIFIED**. Lean formal verification statically confirmed the
seven runbook/register documents against current configuration guards,
operational scripts and routes, the exact 22-file migration 582-603 inventory
and hashes, release/rollback/post-release controls, and explicit gap
classification. No tests, database/migration action, backup/restore rehearsal,
deployment, production action, application/schema change, RLS, or MP2-R4 work
occurred. RPO/RTO and all recorded operational/infrastructure gaps remain open.
No further MP2-R3 implementation slice is explicitly defined; MP2-R3 is ready
for governance closeout. The exact next gate is **Project Owner authorization
for MP2-R3 governance closeout**; MP2-R4 has not begun.

MP2-R3 Runbooks and Release Controls is **COMPLETE / VERIFIED**. MP2-R3A,
MP2-R3B and MP2-R3C remain individually COMPLETE / VERIFIED, including the
preserved MP2-R3A initial VERIFY failure, bounded repair and RE-VERIFY history.
RPO/RTO, production topology/provider and secret-manager decisions, secret
rotation, monitoring transport/thresholds, invitation delivery, scheduler
principal recovery, mounted membership-authority audit viewing,
backup/restore orchestration, scheduler-only shutdown, production supervision,
deployment/recovery and incident tooling, production acceptance fixtures, real
bootstrap, real SERVICE provisioning, PostgreSQL RLS and AircraftComponent
TS2352 all remain open or deferred under their existing classifications.
Master Plan Level 2 remains PARTIAL. The exact next gate is **Project Owner
authorization for MP2-R4 Pre-Production Operational Readiness Verification**;
MP2-R4 has not begun.

MP2-R4 Pre-Production Operational Readiness Verification DEFINE / readiness
reconciliation is **COMPLETE**. MP2-R4 remains NOT STARTED for implementation
and verification. Canonical requirements, reusable evidence, mandatory fresh
rehearsals, prerequisite decisions/controls, MP2-R5 deferrals and later
maturity work are fixed in
[`MASTER_PLAN_LEVEL2_MP2_R4_PREPRODUCTION_READINESS_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R4_PREPRODUCTION_READINESS_DEFINE.md).
The exact next gate is Project Owner decisions for RPO/RTO, TS2352 disposition,
representative R4 topology/secrets/monitoring/evidence controls and the
invitation/scheduler release posture, followed by separate authorization for
**MP2-R4-1 Decisions and Prerequisite Controls**. No MP2-R4 rehearsal or MP2-R5
work has begun.

MP2-R4-1 Pre-Production Readiness Decisions and Prerequisites is **COMPLETE**.
RPO is 1 hour and RTO is 4 hours as objectives, not guarantees. The bounded
audit-evidence path, existing-identity invitation rehearsal, representative
non-production environment/secrets/observability posture and minimum fixture
contract are fixed. Scheduler-principal recovery and AircraftComponent TS2352
remain separate mandatory repair slices; neither was implemented. The exact
next gate is Project Owner authorization for **MP2-R4-2A Scheduler Principal
Recovery focused IMPLEMENT**. R4 rehearsals, formal VERIFY and MP2-R5 have not
begun.

MP2-R4-2A Scheduler Principal Recovery focused IMPLEMENT is **COMPLETE / READY
FOR VERIFY**. Recovery is exact-principal/exact-capability, HUMAN-only,
transactionally revalidated/locked and immutably audited. Focused evidence is
17/17 DB-free PASS and 1/1 guarded exact-`jupiter_test` PASS with rollback and
zero residue. No schema/migration or real provisioning/recovery occurred. Build
has no R4-2A error; only the pending AircraftComponent TS2352 remains. The
exact next gate is Project Owner authorization for **MP2-R4-2A formal focused
VERIFY**. R4-2B has not begun.

MP2-R4-2A formal VERIFY failed on missing exact-one scheduler-principal
cardinality enforcement. The bounded inconsistent-state fail-closed repair is
**COMPLETE / READY FOR FORMAL RE-VERIFY**: zero matches retain the missing-state
refusal, exactly one retains valid recovery, and multiple matches now refuse
before principal/grant/audit mutation. Focused evidence passed 17/17 DB-free
and 1/1 guarded exact-`jupiter_test`, including duplicate-disabled proof,
rollback and zero residue. No schema/migration changed; build retains only the
separate TS2352. The exact next gate is Project Owner authorization for
**MP2-R4-2A formal focused RE-VERIFY**. R4-2B has not begun.

MP2-R4-2A Scheduler Principal Recovery is **COMPLETE / VERIFIED**. Ultra-lean
formal RE-VERIFY passed the repaired zero/one/multiple-principal boundary by
static inspection and reused the fresh 17/17 DB-free plus 1/1 guarded
exact-`jupiter_test` evidence. The original VERIFY failure and bounded repair
remain preserved. No test, database, application, schema/migration, SERVICE or
production action occurred during RE-VERIFY. The exact next gate is Project
Owner authorization for **MP2-R4-2B AircraftComponent TS2352 bounded repair
focused IMPLEMENT**.

MP2-R4-2B AircraftComponent TS2352 bounded repair focused IMPLEMENT is
**COMPLETE / READY FOR FORMAL VERIFY**. The adapter/model-port update-option
contract now expresses required Sequelize `where` plus transaction and removes
the unsafe option conversion without runtime/query changes. Focused tenant and
mutation tests passed 37/37; `npm run build` is clean, TS2352 is gone, and no
other TypeScript error exists. No schema/migration or database action occurred.
The exact next gate is Project Owner authorization for **MP2-R4-2B formal
focused VERIFY**. R4-3 has not begun.

MP2-R4-2B AircraftComponent TS2352 Bounded Repair is **COMPLETE / VERIFIED**.
Formal focused VERIFY confirmed the type-safe Sequelize `where` plus required
transaction contract, absence of an options type escape, and unchanged runtime
queries, tenant/version predicates and return behavior. Fresh 37/37 tests and
clean-build evidence were reused; no tests, build, application, database or
schema/migration action occurred during VERIFY. The exact next gate is Project
Owner authorization for **MP2-R4-3 controlled non-production Recovery
Rehearsal**.

MP2-R4-3 controlled non-production Recovery Rehearsal PREFLIGHT / DEFINE is
**COMPLETE / READY FOR PROJECT OWNER EXECUTION AUTHORIZATION**. The fixed plan
uses guarded `jupiter_test` as source, separate `jupiter_r4_restore` as the
isolated restore database, and dedicated temporary evidence/restore roots. It
defines production refusal, recovery-set/fixture contracts, RPO/RTO evidence,
acceptance, identity-guarded cleanup and all stop gates. No backup, restore,
database/file mutation, fixture creation or application start occurred. The
exact next gate is target-specific Project Owner authorization for **MP2-R4-3
controlled non-production Recovery Rehearsal execution**. R4-4 has not begun.

The first MP2-R4-3 execution authorization stopped safely before mutation
because its required host/port, roles, content identity and backup-set manifest
were not explicit. Read-only supplemental resolution is **COMPLETE / READY FOR
PROJECT OWNER EXECUTION AUTHORIZATION**. The dedicated preflight now fixes the
localhost endpoint, source/admin/owner/runtime roles, five source and restore
roots, writer-quiescence proof, 749-file dirty-worktree content identity,
582-603 hashes, non-secret restore configuration, backup-set format and STOP
conditions. No database, role, process or file mutation occurred. The exact
next gate is Project Owner authorization for **MP2-R4-3 controlled
non-production Recovery Rehearsal execution using the supplemental manifest
and one instantiated backup-set ID**. Cleanup remains separately gated; R4-4
has not begun.

MP2-R4-3 execution attempt
`MP2-R4-3-20260916T183650Z-978a7c0b9806` is **BLOCKED AT THE PRE-MUTATION
GATE**. Exact endpoint/source/admin identity, content, ledger and migration
hashes matched, but neither approved external test secret authenticated the
required `jupiter_app` restore runtime role. The production-marked `.env`
credential was not used. No fixture, backup, evidence directory, database,
file, process or restore mutation occurred. The exact next gate is Project
Owner authorization after an external non-production `jupiter_app` credential
is safely established. This next-gate wording is historical and is superseded
by the dedicated-role DEFINE below. Cleanup is not applicable; R4-4 has not
begun.

MP2-R4-3 dedicated restore-runtime role investigation is **DEFINE PASS / READY
FOR PROJECT OWNER AUTHORIZATION**. Mounted runtime does not require literal
PostgreSQL login `jupiter_app`; a disposable `jupiter_r4_app` can reproduce the
source runtime ACL on `jupiter_r4_restore` without ownership, migration
authority, membership or access to `jupiter_test`/`jupiter_db`. The exact CRUD
exceptions, two callable governance functions, identity checks, DPAPI secret
lifecycle and separately gated cleanup are fixed in
[`MP2_R4_3_DEDICATED_RESTORE_RUNTIME_ROLE_DEFINE.md`](MP2_R4_3_DEDICATED_RESTORE_RUNTIME_ROLE_DEFINE.md).
No PostgreSQL, credential, database, file or application mutation occurred;
all prior blocked evidence remains historical. The exact next gate is Project
Owner authorization for a new R4-3 execution using this dedicated role and a
new backup-set ID. R4-4 has not begun.

MP2-R4-3 dedicated-role re-execution attempt
`MP2-R4-3-20260916T192859Z-978a7c0b9806` is **BLOCKED AT THE FIXTURE GATE**.
The source identity, content hash and migration ledger matched, but
`jupiter_test` contained no tenant memberships/roles, Customer Portal
identities, platform principals/grants or platform/membership audit evidence,
and all 402 tenant rows were `ACTIVE`. The required two-tenant ACTIVE/SUSPENDED,
System Owner, ADMIN, scheduler SERVICE and immutable-audit fixture set was
therefore absent. No role, credential, database, fixture, backup, evidence
directory, file, process or restore mutation occurred; normal `jupiter_app`
and `jupiter_db` remain untouched. The exact next gate is Project Owner
authorization for bounded creation and later cleanup of the approved
disposable source fixtures before another new R4-3 execution. R4-4 has not
begun.

MP2-R4-3 disposable fixture-set attempt
`MP2-R4-3-FIXTURE-20260916T193141Z` is **BLOCKED BEFORE MUTATION**. The source
has zero platform principals/grants, while every authoritative principal,
scheduler and tenant-lifecycle operation requires an existing repository-
issued HUMAN authority. The only supported first-authority path is the guarded
initial System Owner bootstrap, which the fixture authorization prohibited.
Rollback-only test setup uses direct inserts and cannot be persisted without
bypassing the required authoritative audit chain. No fixture, database,
credential, file or cleanup manifest was created. The exact next gate is
Project Owner authorization for a disposable guarded first-System-Owner path
in exact `jupiter_test`, or an explicitly defined and independently verified
fixture-root provisioning mechanism. R4-3 remains blocked; R4-4 has not begun.

MP2-R4-3 disposable `jupiter_test` guarded System Owner bootstrap is
**COMPLETE / READY FOR DISPOSABLE RECOVERY FIXTURE CREATION AUTHORIZATION**.
Fixture root `MP2-R4-3-FIXTURE-20260916T193141Z` contains one disposable test
user, one HUMAN principal, exactly `PLATFORM_AUTHORITY_MANAGE` and
`PLATFORM_AUDIT_VIEW`, and the immutable canonical bootstrap audit.
Repository-issued authority was proven for both capabilities. All 402 existing
tenants and the 117-entry/head-603 ledger were preserved; no membership,
tenant/scheduler fixture, schema/migration, backup or restore was created. The
exact cleanup identifiers are in
[`MP2_R4_3_FIXTURE_CLEANUP_MANIFEST.md`](MP2_R4_3_FIXTURE_CLEANUP_MANIFEST.md).
The exact next gate is Project Owner authorization for the remaining bounded
disposable recovery fixture set. R4-3 remains incomplete; R4-4 has not begun.

MP2-R4-3 controlled non-production Recovery Rehearsal Section 12 recovery
result is **COMPLETE / PASS**. Phase C C2–C10 completed (invitation reverify,
seven-membership offboard, membership-role and Set-1 operational removal, user
deactivation, temporary authority bridge `99ec0db6-37f6-48b7-95e3-b2b09097c750`
/ `a1690133-2885-4509-8715-74e3b2df6544`, and later-bootstrap terminal
retirement with immutable audit `e99f520e-12fa-4a63-864a-788ce7de77d6`). C11
controlled cleanup COMPLETE / PASS: `jupiter_r4_restore` database and
`jupiter_r4_app` role absent, five restore roots absent, four fixture uploads
absent, and temporary R4-3 fixture/recovery execution code removed. S9-15
final verification PASS: four recovery evidence backup-set directories and the
DPAPI `jupiter_r4_app.credential.clixml` evidence copy retained intact, no
operational R4-3 credential outside the evidence tree, immutable audit history
retained (`platform_global_audit_log` and
`tenant_membership_authority_audit`), `jupiter_test`/`jupiter_db` intact, and
unrelated dirty work preserved with no staging or commit.

MP2-R4-3 Section 13 lean formal VERIFY is **PASS**. Independent read-only
re-verification confirmed the amended end state: temporary recovery code,
`jupiter_r4_restore` database and `jupiter_r4_app` role absent; four evidence
backup-set directories and the DPAPI `jupiter_r4_app.credential.clixml` evidence
copy retained; immutable audit history and `jupiter_test`/`jupiter_db` intact;
unrelated dirty work preserved; no staging or commit. The MP2-R4-3
recovery-control sequence is **COMPLETE** (Sections 12–13). The next Master Plan
gate is the next MP2-R4 pre-production readiness rehearsal, which is not yet
defined and requires separate Project Owner authorization; R4-4 has not begun.

MP2 2B.3 future-extensibility verification (parent/subsidiary single-level
check) is **COMPLETE / VERIFIED — FUTURE EXTENSIBILITY PASS**. Read-only
architectural review found no hard-coded single-level future blocker: the
tenant/membership model is already multi-tenant (`UNIQUE (tenant_id, user_id)`,
not one-user/one-tenant), tenant-local ownership/authority boundaries are
intentional, and `TenantQueryAuthority` remains single-tenant by design. Future
parent/subsidiary support can be introduced additively through explicit
relationship and authority mechanisms, with no implicit cross-tenant visibility
or access. Strict tenant isolation is unchanged; no parent/subsidiary schema,
role, permission, route, service, or UI is introduced. The 2B.3 checklist box
is marked ☒ by governance reconciliation.

MP2 2D.2 first-administrator invitation reconciliation is **COMPLETE / VERIFIED**.
Repository investigation establishes that the first Company Administrator does
not receive an invitation: the System Owner nominates an already-existing ACTIVE
Jupiter identity through `initialUserId`, and provisioning directly creates the
initial ACTIVE ADMIN membership. The 2D.2 checklist is therefore reconciled
against this first-admin contract and marked ☒ as follows:

- ☒ First administrator must already have an ACTIVE Jupiter identity.
- ☒ Invitation/registration mechanism is defined, with the explicit distinction
  that the ordinary staff invitation mechanism is not used for the first
  Company Administrator.
- ☒ Email-verification requirement for the first administrator is defined: no
  additional invitation/email-verification step is required because the System
  Owner nominates an existing ACTIVE Jupiter identity.
- ☒ Initial-invitation expiry is N/A to first-admin provisioning because no
  initial invitation exists.
- ☒ Abandoned initial invitation procedure is N/A for the same reason.
- ☒ Replacement before tenant activation is provided by `TENANT_ADMIN_RECOVER`.
- ☒ Tenant becomes normally usable after authorized PROVISIONING → ACTIVE
  activation with the established ACTIVE ADMIN requirement.

The earlier "optional revoke/abandon gap" classification is withdrawn: "Define
expiry of initial invitation" and "Define abandoned invitation procedure" are
not requirements to implement manual staff-invitation revocation under 2D.2.
No `revokeInvitation()` is implemented, and ordinary staff invitation behaviour
is unchanged by this reconciliation.

MP2 2D.3 grantable tenant-local roles reconciliation is **COMPLETE / VERIFIED**.
The established tenant-local role set is `ADMIN`, `ENGINEER`, `MECHANIC`,
`SUPERVISOR`, `QA`, `PLANNER`, `VIEWER` (all `system_locked`). A tenant ADMIN may
grant/remove these through the existing tenant-local membership-role mechanism
(`toggleRole`); they do not confer platform authority. The 2D.3 grantable-roles
checkbox is marked ☒ by governance reconciliation.

MP2 2D.3 last-company-admin protection is **COMPLETE / VERIFIED**. An ACTIVE
tenant cannot be transitioned from ≥1 ACTIVE ADMIN to zero ACTIVE ADMINs
through normal tenant-local administration: revoking the sole ACTIVE ADMIN role
is denied and disabling the sole ACTIVE ADMIN membership is denied. The guard
executes inside the existing tenant-scoped advisory-locked transaction;
`LAST_ACTIVE_TENANT_ADMIN_REQUIRED` produces controlled HTTP 409 behaviour.
Denied operations cause no membership/role mutation and no mutation audit row;
successful revoke/disable retain the existing `TENANT_ROLE_REVOKED` /
`MEMBERSHIP_DISABLED` audit events. System Owner `TENANT_ADMIN_RECOVER` remains
the exceptional recovery mechanism and is not restricted by this guard.
Migration 602's removed database triggers remain removed and migration 603 is
unchanged. Focused verification: last-admin protection 7/7 PASS; relevant NoDB
regressions 8/8 PASS; relevant DB regressions 6/6 PASS; rollback/snapshot
residue verification PASS; scoped `git diff --check` PASS; no schema/migration
changes. Concurrency evidence: transactional tenant advisory-lock placement was
verified by code inspection; the ≥1 ACTIVE ADMIN invariant was dynamically
tested; a true simultaneous multi-connection race was not dynamically exercised
by the current rollback-based harness and is not claimed to have passed. This
limitation does not block closeout because both protected mutation paths use the
same tenant-scoped transaction advisory lock and perform the last-admin check
after acquiring that lock and before mutation. The 2D.3 last-company-admin
protection checkbox is marked ☒ by governance reconciliation.

MP2 2E.1 offboarding states reconciliation is **COMPLETE / VERIFIED**. The 2E.1
checkbox "Define difference between temporary suspension, customer cancellation,
business closure, regulatory retention, archival, and eventual permitted
deletion if ever allowed" is marked ☒ by governance reconciliation. Governing
distinction: tenant lifecycle status and business offboarding reason are
separate concepts — `SUSPENDED` describes the tenant's system access state,
while customer cancellation or business closure describes why access was
suspended and does not itself require a new lifecycle state. Established
contract:

- Temporary suspension: `SUSPENDED` is the temporary/reversible access
  suspension state; System Owner controls suspension/reinstatement through the
  established platform capabilities; suspension blocks tenant access/execution
  while preserving company data, structure, memberships, files, identifiers,
  history and audit; `TENANT_REINSTATE` restores `ACTIVE`.
- Customer cancellation: no new lifecycle status at this stage; use the existing
  `SUSPENDED` state with the suspension reason recording customer cancellation;
  does not authorize deletion and does not automatically move the tenant to
  `ARCHIVED`.
- Business closure: no new lifecycle status at this stage; use the existing
  `SUSPENDED` state with the suspension reason recording business closure;
  tenant data and structure remain preserved; does not authorize deletion.
- Regulatory retention: no specific retention period is invented; until an
  explicit legally/regulatorily supported retention policy is established,
  tenant records remain preserved, existing immutable audit/history protections
  remain unchanged, and permanent tenant deletion remains prohibited. The
  absence of a defined retention period is recorded as a future
  governance/legal-policy matter, not an implementation defect.
- Archival: `ARCHIVED` remains the existing reserved fail-closed state; entry
  into or restoration from `ARCHIVED` is not implemented; cancelled/closed
  companies are not automatically archived; a future archive policy/transition
  requires separate definition and authorization.
- Eventual deletion: permanent tenant deletion remains prohibited; the existing
  database deletion prohibition and privilege restrictions are preserved; no
  tenant-delete route/service/repository operation/lifecycle command is added;
  no deletion period is defined; any future permanent deletion requires a
  separately authorized policy establishing regulatory/legal retention
  requirements, authority, safeguards, audit and deletion scope.

Existing lifecycle implementation is unchanged: `PROVISIONING → ACTIVE →
SUSPENDED → ACTIVE` with `ARCHIVED` reserved and deletion prohibited at the
database boundary. No `CANCELLED` or `CLOSED` tenant status is introduced.

MP2 2E.2 Phase 1 — Departure Export Authority & Targeting is **IMPLEMENT / VERIFIED**.
Additive migration 604 seeds the granular `TENANT_EXPORT` platform capability
(`system_locked=true`, `is_active=true`, `domain=TENANT_LIFECYCLE`, HUMAN-only
through the existing platform-authority policy machinery; no implicit grant).
The guarded `jupiter_test` migration applied cleanly — ledger head is now 604,
exactly one canonical `TENANT_EXPORT` capability exists, and zero `TENANT_EXPORT`
grants remain. Authoritative tenant targeting binds one exact `public_id`/
`tenantId` identity and revalidates export eligibility (`ACTIVE` and `SUSPENDED`
eligible; `PROVISIONING` denied; `ARCHIVED` remains reserved/unreachable);
targeting performs no tenant mutation. No export route, package, journal,
download/token mechanism, filesystem export root, or archive transition was
introduced. Suspension/reinstatement, tenant deletion prohibition, and ordinary
SUSPENDED-tenant denial are unchanged. Focused verification: Phase-1
authority/targeting 6/6 PASS; guarded migration UP/DOWN/reapply 2/2 PASS;
repaired tenant-lifecycle foundation 7/7 PASS; Level-2 bootstrap/authority
regression 25/25 PASS; NoDB lifecycle-command regression 5/5 PASS; typecheck
clean. The stale `tenant-lifecycle-foundation` assertion was repaired to verify
the original migration-601 four-capability foundation while recognising the
later additive `TENANT_ADMIN_RECOVER` (602) and `TENANT_EXPORT` (604); no
historical migration was modified. The next gate was MP2 2E.2 Phase 2 —
Departure Export Generation, which is now **DEFERRED** (see below).

MP2 2E.2 Phase 2 — Departure Export Generation is **DEFERRED** into
[`APPENDIX_TENANT_DEPARTURE_EXPORT.md`](APPENDIX_TENANT_DEPARTURE_EXPORT.md)
(Appendix — Tenant Departure Export Implementation; status DEFERRED — NOT
CURRENT EXECUTION SCOPE). The Phase 2 DEFINE (authoritative export inventory,
file inventory, package contract, consistency model, proposed journal, authority
chain, audit contract, failure/recovery contract, and implementation slices) is
preserved in the appendix. No Phase 2 implementation (generation route, journal,
package generation, filesystem export root, delivery, or download) is
authorized. The appendix may only resume through explicit Project Owner
authorization. **RETURN TO MAIN PLAN: MP2 2E.2 — Data Retention.**

MP2 2E.2 Item 1 — Maintenance Record Retention is **COMPLETE / DEFINED**.
Jupiter digital maintenance records shall have a configurable retention period,
initially set to 5 years. The retention value must ultimately be held in a
centrally controlled retention-policy table/configuration (not hard-coded
throughout the application); the System Owner/platform authority must be able to
change it when regulatory requirements change, and every policy change must be
auditable. Changing a retention value must not itself delete, purge, or alter
existing records; any future deletion/purge process requires separate explicit
authorization and governance. Where a specific statutory requirement requires
longer retention, the longer requirement must be capable of being represented.
Physical aircraft, engine, and propeller logbooks are outside this Jupiter
digital-retention requirement. The future configurable retention-policy facility
is recorded as an implementation requirement, not a new programme or appendix.

MP2 2E.2 Item 2 — Audit Evidence Retention is **COMPLETE / DEFINED**. Jupiter
audit evidence shall have a configurable minimum retention period, initially set
to 5 years. Audit retention must ultimately use the centrally controlled
retention-policy table/configuration established under Item 1 (not hard-coded
throughout the application); the System Owner/platform authority must be able to
change the retention period when required, and every retention-policy change
must itself be auditable. A longer retention period must be representable where
regulatory, legal, or security requirements require it. Reaching the retention
period must not automatically delete, purge, or alter audit evidence; any future
archival/deletion/purge mechanism requires separate explicit authorization and
governance. Existing immutable/append-only audit protections must not be
weakened. The configurable audit-retention facility is recorded as an
implementation requirement under the existing retention-policy requirement (no
new programme or appendix).

MP2 2E.2 Item 3 — Post-Departure File Accessibility is **COMPLETE / DEFINED**.
When a company/customer leaves Jupiter, ordinary tenant/company users lose
normal access according to the applicable suspension/offboarding state, and the
company's retained digital data and files remain preserved according to Jupiter
retention policy. An appropriately authorized HUMAN System Owner/platform
operator must be able to access retained tenant files when required for
controlled regulatory, legal, support, or approved company-export purposes. This
controlled access must not require reinstating the tenant or restoring ordinary
tenant access, must remain tenant-specific and fail closed against access to
another tenant's information, must be appropriately authorized, and must be
auditable. Existing tenant isolation and suspension protections must not be
weakened. The controlled post-departure access mechanism is recorded as an
implementation requirement under 2E.2 (not another programme or appendix).

MP2 2E.2 Item 4 — Company Departure Export is **COMPLETE / DEFINED**. A
company/customer leaving Jupiter shall be able to receive a controlled export of
its retained tenant data and tenant-owned files. The export is
company/tenant-specific and must not contain another tenant's information;
shared-master/platform information must not be represented as tenant-owned data.
The export requires appropriate authorization, a SUSPENDED/departed tenant does
not need to be reinstated to produce it, and providing an export does not delete
the retained Jupiter records. Detailed generation and delivery implementation
remains DEFERRED in APPENDIX_TENANT_DEPARTURE_EXPORT.md.

MP2 2E.2 Item 5 — Export Format and Scope is **COMPLETE / DEFINED**. A company
departure export shall contain: the company's retained tenant-owned operational
data; its tenant-owned uploaded files; machine-readable structured data; a
human-readable index/manifest explaining the export; and sufficient stable
reference/descriptive information from shared-master records to make exported
tenant records understandable, without exporting the shared-master catalogue as
tenant-owned data. The export shall exclude: other tenants' data; platform
principals/capability grants and platform-security information; passwords,
session information, authentication secrets and tokens; and unrelated
shared-master/platform-global data. The final archive/container technology
(ZIP, tar.gz, etc.) is an implementation detail and remains deferred to
APPENDIX_TENANT_DEPARTURE_EXPORT.md. Providing the export does not transfer
ownership of Jupiter platform/shared-master structures and does not delete the
retained Jupiter records.

MP2 2E.2 Item 6 — Export Authorization is **COMPLETE / DEFINED**. A company
departure export may be authorized only by an appropriately authorized HUMAN
System Owner/platform operator holding the `TENANT_EXPORT` capability.
`TENANT_EXPORT` is the explicit authority for whole-tenant departure export and
requires a HUMAN principal; tenant ADMIN or other tenant-local roles do not
confer it, and `AUDIT_EXPORT`, `PLATFORM_AUDIT_VIEW`, or other unrelated
capabilities do not confer it. SERVICE principals may not independently
authorize a company departure export. Authority must be current and revalidated
fail-closed when the operation is eventually implemented, and authorization must
be auditable and tenant-specific (not general access to other tenants). The
verified Phase 1 `TENANT_EXPORT` authority foundation remains unchanged.

MP2 2E.2 Item 7 — Secure Delivery Procedure is **COMPLETE / DEFINED**. A company
departure export must be delivered through a controlled, secure and auditable
process. The export must not be placed in a publicly accessible location; release
requires valid HUMAN `TENANT_EXPORT` authority; the intended recipient/company
must be identified before release; access must be limited to the specific
authorized export package; any download credential/link/token must be temporary
and revocable; the delivery mechanism must prevent access to another tenant's
export; package integrity must be verifiable before delivery;
authorization/release and successful access/download must be auditable;
expired/revoked access must fail closed; temporary delivery material must be
securely cleaned up according to the applicable retention/delivery policy; and
delivery must not reinstate a SUSPENDED/departed tenant or restore ordinary
tenant access. Exact token lifetime, package availability period, and technical
delivery mechanism are implementation details deferred to
APPENDIX_TENANT_DEPARTURE_EXPORT.md.

The controlling 2E.2 checklist remains open; the appendix does not mark any box
complete:

1. ☒ Define how long tenant maintenance records must remain — COMPLETE / DEFINED
   (configurable, default 5 years; policy facility is a future implementation
   requirement).
2. ☒ Define how long audit evidence remains — COMPLETE / DEFINED (configurable
   minimum, default 5 years; uses the Item 1 retention-policy facility).
3. ☒ Define how files remain accessible to authorized operators after customer
   departure — COMPLETE / DEFINED (controlled post-departure access mechanism
   is a future implementation requirement).
4. ☒ Define whether the company gets an export — COMPLETE / DEFINED (controlled
   tenant-specific export; generation/delivery DEFERRED in the appendix).
5. ☒ Define export format/scope — COMPLETE / DEFINED (contents and exclusions
   defined; archive technology DEFERRED in the appendix).
6. ☒ Define who may authorize export — COMPLETE / DEFINED (HUMAN `TENANT_EXPORT`
   only; Phase 1 authority foundation unchanged).
7. ☒ Define secure delivery procedure — COMPLETE / DEFINED (controlled, secure,
   auditable delivery; exact token lifetime/period/mechanism DEFERRED in the
   appendix).

MP2 2E.2 DATA RETENTION — DEFINITION REQUIREMENTS COMPLETE. All seven
definition items are now marked ☒. The completed definitions are distinct from
the deferred implementation requirements: the configurable retention-policy
facility (Items 1–2), the controlled post-departure access mechanism (Item 3),
and the departure-export generation and secure delivery (Items 4–7, deferred in
APPENDIX_TENANT_DEPARTURE_EXPORT.md) remain NOT IMPLEMENTED; the departure-export
functionality itself is not implemented.

MP2 2E.3 Destructive Deletion is **COMPLETE / VERIFIED**. Tenant deletion is
prohibited: migration 601 provides database-level protection through
`tr_tenants_delete_prohibited` and removal of `DELETE` privilege from
`jupiter_app`; no `TENANT_DELETE` capability or lifecycle operation exists; no
mounted application/platform tenant-delete route exists; no tenant-delete
repository/service operation exists; tenant foreign keys provide no tenant-root
destructive cascade; `SUSPENDED` remains non-destructive; `ARCHIVED` remains
reserved/unreachable; the test-only `DELETE FROM tenants` occurrence is fixture
teardown, not an operational deletion path. No tenant deletion is to be
introduced until separately authorized under an appropriate future
legal/operational retention/deletion policy.

MP2 2F.1 Pre-bootstrap reconciliation is **COMPLETE** (documentation repair).
The guarded bootstrap runbook `SYSTEM_OWNER_BOOTSTRAP.md` stale references were
corrected: migration ledger head 603 → 604 and canonical capability count 22 →
23, matching the current repository state (migration 604, 23 capabilities). The
existing implementation provides the required pre-bootstrap checks for: active
user; exact UUID; normalized email; migration ledger; platform authority
structures; existing System Owner/bootstrap detection; and confirmation-token
validation. Deferred until a real production environment exists: nomination/
confirmation of the actual real System Owner, confirmation of the actual
production database, and confirmation of the production backup. Jupiter
currently has no production environment. No bootstrap execution, System Owner
creation, database, code, schema, or migration change occurred.

MP2 2F.2 Bootstrap Runbook is **COMPLETE / VERIFIED**. The existing runbook
`SYSTEM_OWNER_BOOTSTRAP.md` and the verified bootstrap/preflight implementation
satisfy all seven requirements: operator instructions; preflight checks;
refusal conditions; exact successful-result checks; audit verification; recovery
procedure; and duplicate-bootstrap refusal check. No bootstrap execution, System
Owner creation, database, code, schema, migration, or runbook change occurred.

MP2 2F.3 Non-Production Rehearsal is **COMPLETE / VERIFIED**. All seven 2F.3
requirements passed against a completely fresh `jupiter_test` created through the
canonical migration chain (010 through 604). The rehearsal executed against
exactly the approved non-production `jupiter_test`; the correct HUMAN principal
was created; the required `PLATFORM_AUTHORITY_MANAGE` and `PLATFORM_AUDIT_VIEW`
grants were created; one immutable `SYSTEM_OWNER_BOOTSTRAPPED` audit was created;
tenant roles/memberships remained unrelated; a second preflight was refused with
`SYSTEM_OWNER_BOOTSTRAP_ALREADY_COMPLETED`; and no other tenant/user was affected.
The original `jupiter_test` was restored byte-identical (counts and SHA-256
digests matched pre-state), with no temporary database residue (`jupiter_test_orig`
and the scratch database removed) and all R4-3 evidence intact. A verified
custom-format backup and SHA-256 sidecar were retained. The migration chain
remained immutable (583/584 unmodified). No application code, schema, migration,
or governance change occurred; no staging or commit; unrelated dirty work
preserved.

MP2 2F.4 Production Execution is **DEFERRED**. Jupiter currently has no production
environment/deployment. Production System Owner bootstrap requires a future real
production environment and separate explicit Project Owner authorization. No
production bootstrap executed; no System Owner created; no production database
invented or designated; no database, code, schema, or migration change occurred.

MP2 2G.2 Remaining Operational Setup is **COMPLETE**. All eleven operational
definitions are complete: scheduler identity, execution environment, credential
storage, credential rotation, start/stop, failure handling, retry policy, timeout
policy, overlapping-run handling, alerting, and audit expectations. The scheduler
runbook now defines start/stop (persistent stop via `SB_SYNC_CRON_ENABLED=false`
plus application restart; immediate containment via existing graceful shutdown),
a no-automatic-retry policy, and a `SB_SYNC_RUN_TIMEOUT_MINUTES` timeout contract
(positive, strictly less than `SB_SYNC_INTERVAL_MINUTES`). Deferred to future
production/deployment work: actual production host/topology; production
secret-manager/injection mechanism; production credential-rotation mechanism;
external escalation contacts; alert transport/thresholds; the actual production
timeout value; and implementation/enforcement of the timeout control. None of
those production matters has been implemented or selected.

MP2 2G.4 Production Service Activation is **DEFERRED UNTIL PRODUCTION**. All
eight checklist boxes remain unticked: separate authorization; provision the
real production service principal; configure the scheduler; perform a manual
controlled first run; verify audit; verify file lifecycle; verify no
duplicate/overlapping execution; and enable the operational schedule. Each
requires a real production environment/deployment, separate Project Owner
authorization, and execution against the real production `SB_SYNC_SCHEDULER`
SERVICE identity and scheduler. Jupiter currently has no production
environment or deployment; no production SERVICE principal was provisioned, no
scheduler was configured or run, and no production activation was simulated or
executed. With 2G.1, 2G.2, and 2G.3 complete and 2G.4 deferred to production,
Section 2G is complete for the current development stage.

MP2 2H.1 Backup Policy is **COMPLETE**. All thirteen checklist requirements are
covered: the six data-scope items (identify data requiring backup, PostgreSQL
database, tenant files/uploads, shared-master files, application configuration,
and migration/version metadata) and the seven newly defined policy items
(backup frequency, retention, encryption, storage, off-site copy, ownership,
and automatic backup verification). Policy now fixed: RPO 1 hour / RTO 4
hours; retention of 30 daily / 12 monthly / 5 annual recovery points, distinct
from business/maintenance-record retention; encryption at rest and in transit
with protected key management; storage physically/logically separate from live
storage; at least one independently stored off-site copy; a Project
Owner-approved operational owner plus a separately authorized
infrastructure/database custodian; and automatic completion/artifact/
integrity verification with periodic isolated restore testing. The manual
backup/restore mechanism (custom-format dump, SHA-256 sidecar, `pg_restore
--list`, five-file-root capture, isolated restore) is proven by MP2-R4-3.
Production infrastructure remains deferred: provider, storage topology/path,
off-site location, encryption algorithm/key-management product, named
personnel, schedule, and automation/orchestration are selected before
production activation. No backup was executed; no code, schema, or migration
change occurred.

MP2 2H.2 Recovery Objectives is **COMPLETE**. All four checklist items are
covered: RPO = 1 hour and RTO = 4 hours (unchanged); Jupiter criticality is
defined as an operationally critical aviation maintenance management system
whose loss of availability, integrity, or recoverability materially disrupts
maintenance execution, maintenance-record availability, compliance and
traceability, and planning and operational continuity — the basis for the
established RPO/RTO; and recovery priority is defined as PostgreSQL database
first, then tenant/shared-master files and uploads, then application
configuration/migration/release identity, then application services last,
prioritizing coherent system state over fast process restart. No recovery was
executed; no code, schema, or migration change occurred.

MP2 2H.4 Recovery Rehearsal is **COMPLETE / VERIFIED**. A bounded evidence-repair
rehearsal restored the retained R4-3 recovery set
`MP2-R4-3-20260917T182108Z-978a7c0b9806` (117-entry/head-603 historical state) into a
disposable isolated `jupiter_2h4_restore` database under a disposable non-superuser
`jupiter_2h4_app` role (no migrations re-run; migrations 583/584 database-identity
gates do not apply to restore). All seven previously-missing execution checks PASS:
application startup and `/health/live`/`/health/ready` (200, scheduler disabled);
historical migration ledger/order/hash (117 entries, head 603, exact order, hashes
match the R4-3 582-603 contract); tenant isolation (Tenant A ACTIVE vs Tenant B
SUSPENDED, distinct `tenant_id`, no cross-tenant); file reconciliation (tenant fixture
files SHA-256 and size match the fixture manifest); System Owner authority (exactly
`PLATFORM_AUTHORITY_MANAGE` + `PLATFORM_AUDIT_VIEW`) and scheduler SERVICE authority
(exactly `SERVICE_BULLETIN_SYNC_EXECUTE`) with no unexpected active authority; Tenant B
remains `SUSPENDED` with data preserved and access denied; and measured recovery
elapsed 171.5 s (well under RTO 4 h). Retained RPO capture-age 23.4 s is consistent
with RPO 1 h but does not prove the production recovery-point schedule. The disposable
database, role, file roots, and temporary tooling were removed; `jupiter_test` (head
604), `jupiter_db`, and the retained R4-3 evidence remain unchanged. Durable evidence
is retained under `jupiter-2h4-evidence`. No application/schema/migration change; no
staging or commit.

MP2 2J.3 Alert Rules is **COMPLETE**. The Project Owner-approved alert policy is
recorded: CRITICAL alerts immediately; ERROR after 3 occurrences of the same
condition within 15 minutes; WARN after 5 occurrences within 30 minutes; INFO does
not alert; security/tenant-isolation conditions are CRITICAL and bypass thresholds.
WARN means abnormal/degraded operation without demonstrated loss of tenant
isolation, authority integrity, or data integrity; CRITICAL requires immediate
containment (suspected/confirmed cross-tenant exposure, compromised System
Owner/platform authority, serious data-integrity/corruption). CRITICAL alerts
notify the System Owner immediately; WARN/ERROR alerts notify the System Owner and
escalate to CRITICAL if unresolved for 30 minutes. Initial destination is a
System-Owner-controlled channel (exact production transport selected during
production setup). CRITICAL alerts operate out-of-hours; non-escalated WARN/ERROR
may wait until normal hours. Recovery generates a recovery notification (CRITICAL
recovery does not itself restore access). Alert owner remains the Jupiter System
Owner; severity levels and deduplication unchanged; operational log/alert retention
90 days (audit evidence separately 5 years). No alert transport, monitoring
platform, notification service, schema, or migration implemented. No staging or
commit.

MP2 2J.4 Verification is **COMPLETE / VERIFIED**. Focused tests close the
previously-missing execution evidence. (A) Tenant-context failure + alert:
`src/modules/observability/2j4-alert-verification.test.ts` exercises the authentic
`resolveTenantContext` rejection (SUSPENDED_TENANT) and asserts `TENANT_CONTEXT_REFUSED`
(WARN/DENIED) is emitted with a privacy-safe HMAC `tenantAlias` and no tenant payload,
email, credential, SQL, or stack leakage. (B) Scheduler failure + alert: the same file
exercises `startCronJob`'s scheduled run against an unresolvable SERVICE authority and
asserts `SCHEDULER_RUN_FAILED` (ERROR/FAILED) is emitted with no leakage and no partial
shared-master mutation. (C) Response procedure:
`src/modules/tenancy/2j4-response-procedure.database.test.ts` exercises the real tenant
lifecycle ACTIVE → `TENANT_SUSPEND` → SUSPENDED (revalidation returns `SUSPENDED_TENANT`,
access denied) → `TENANT_REINSTATE` → ACTIVE (revalidation returns `VALID_ACTIVE_TENANT`,
access restored) with `TENANT_SUSPEND`/`TENANT_REINSTATE` immutable audit and zero
residue via rollback. Existing items 3 (no tenant-data leakage) and 4 (scheduler failure
generation) reuse prior execution evidence. No schema/migration change; no production
infrastructure; no staging or commit.

MP2 2K.3 Secret-Management Decisions is **COMPLETE**. Project Owner decisions
recorded: the production secret-management product/provider and injection mechanism
are deferred to production infrastructure selection (explicitly not plaintext
`.env`), and must satisfy protected storage, controlled injection, environment
separation, least-privilege custodian access, no Git/log storage, and controlled
rotation; the rotation/expiry policy is fixed — database credentials, `SESSION_SECRET`,
and `TENANT_SWITCH_TOKEN_SECRET` rotate every 90 days plus immediately on suspected
compromise (with session/token-invalidation consequences), future provider
credentials follow provider expiry plus compromise rotation, `PLATFORM_OWNER_CONFIRMATION`
is transient (no rotation/expiry), and the SB scheduler SERVICE principal/capability is
authority state (no secret rotation); and a category-specific rotation procedure
(authorize, provision, validate, coordinate restart/re-auth, revoke old, verify,
preserve privacy-safe evidence, emergency compromise prioritizes containment) is
defined in `PRODUCTION_SECRETS.md`. No secret manager installed, no credentials
generated/rotated, no code/config/schema/migration change, no staging or commit.

MP2 2L.2 Compatibility Analysis is **COMPLETE**. Bounded repair: the readiness gate
in `src/modules/observability/health.routes.ts` now expects the canonical head
`604_seed_tenant_export_capability.ts` (was stale at 603); focused tests cover head
604 → ready, stale/incorrect head → not_ready, and unchanged non-disclosure.
Deployment compatibility model: an old application against a migrated 582–604 DB
keeps reads/auth compatible but old writers are unsafe (NOT NULL tenant-ownership
columns and immutability triggers in migrations 590/595); the new application must
not run against the old schema — database migration precedes application startup
(database-first, forward-only; `down()` is refused once data exists); complete
application/writer shutdown (HTTP + background) and SB-scheduler stop are required
during this migration class; a maintenance window/downtime is mandatory but its
duration is production-dependent; existing sessions are preserved and `SESSION_SECRET`
is not rotated merely for this deployment. No migration/schema/database change; no
staging or commit.

MP2-R4 item 21 — Exercise monitoring — **COMPLETE / VERIFIED**. A focused monitoring
rehearsal (`src/modules/observability/2j4-item21-monitoring-rehearsal.test.ts`) defines a
representative non-production alert receiver (a local in-memory collector of the
operational-event JSON stream; no production transport), records a bounded observation
window, and delivers three representative events through the existing observability
mechanism: `TENANT_CONTEXT_REFUSED` (WARN/DENIED, HMAC `tenantAlias`), `SCHEDULER_RUN_FAILED`
(ERROR/FAILED, safe `errorCode`), and `APPLICATION_FAILURE` (raw exception text dropped).
Verified: events reach the receiver; severity/identity preserved; privacy-safe redaction
intact (no tenant id, credential, token, SQL, or stack); observation window recorded. No
production infrastructure, external monitoring vendor, schema, or migration; no staging or
commit.

MP2-R4 item 24 — Rehearse release procedure — **COMPLETE / VERIFIED**. A bounded integrated
release rehearsal (evidence `jupiter-item24-release-evidence`) cloned `jupiter_db` (the only
existing pre-604 data-bearing state, head **597**: 1 tenant `JUPITER_DEV` ACTIVE, 1 membership,
9 users, 2 audit) into disposable `jupiter_r24_release` and rehearsed one coherent sequence:
preflight + writer/scheduler quiescence (0 connections, scheduler disabled) → ordered
migrations **598–604** via the guarded runner → candidate application start against the
migrated DB (`jupiter_app`, head 604) → `/health/live` 200 ok + `/health/ready` 200 ready →
focused tenant-isolation smoke (tenant/membership linkage intact, 0 cross-tenant switch
attempts) → controlled reopen. The rollback/forward-repair tabletop exercised all seven
decision branches (migration/startup/isolation failure → CLOSED; forward-repair vs rollback;
restore/rollback separate authorization; reopen authority) without any destructive rollback
or restore. Cleanup: clone dropped, `jupiter_db` unchanged (head 597) and `jupiter_test`
unchanged (head 604). No production target, no staging or commit; unrelated dirty work
preserved.

MP2-R4 item 27 — Independent VERIFY — **PASS**. Read-only reconciliation confirmed
items 1–26 are supported by exercised/verified evidence with no contradictions, no
blocking cross-tenant/authority gaps, no residue, and no accidental production reliance.
Non-blocking findings flagged for closeout: stale MASTER_EXECUTION_PLAN.md and DEFINE
header, and absent 2L.3 closeout. Deferred production-specific work correctly scoped to
MP2-R5.

MP2-R4 item 28 — Governance closeout — **COMPLETE**. MASTER_EXECUTION_PLAN.md and the
DEFINE header reconciled; the earlier "R4-4 and later R4 rehearsals remain pending"
statement is superseded. 2L.3 reconciliation: no literal "2L.3 Release Plan" checklist
item exists in the governance records; the release procedure is supported by
PRODUCTION_RELEASE.md, the completed 2L.2 compatibility analysis and the MP2-R4 item-24
integrated release rehearsal (recorded here honestly; no historical completion fabricated).

MP2-R4 Pre-Production Operational Readiness Verification is **COMPLETE / VERIFIED**.
Items 1–26 complete and evidence-supported; item 27 Independent VERIFY PASS; item 28
closeout. Zero unintended residue verified; no production environment used.
Production-specific operational/infrastructure matters remain deferred to MP2-R5 (real
System Owner bootstrap and SERVICE activation, hosting/topology/provider, secret-manager
product/integration, production monitoring transport, production backup operation,
deployment orchestration). MP2-R5 has not begun.

## Paused approved work

### Component Management Unified Workspace

Plan:

[`../JUPITER_COMPONENT_MANAGEMENT_UNIFIED_WORKSPACE_PHASED_TASK_PLAN.md`](../JUPITER_COMPONENT_MANAGEMENT_UNIFIED_WORKSPACE_PHASED_TASK_PLAN.md)

Status:

- Phase 1 — approved
- Phase 2 — approved
- Phase 3 — approved
- Implementation — `PAUSED`
- No implementation slice is currently authorized

Component Management remains paused while the Jupiter SaaS / Multi-Tenant
Foundation is prioritized.

## Deferred work

- CI and release workflow hardening
- Component lifecycle-intake initialization
- Component install/baseline/remove permission hardening
- Other programme work not explicitly activated by the Project Owner

## Context rule

For ordinary work, read only the active plan and evidence required for the
authorized phase or slice.

Do not load historical governance, historical `docs/ChatGPT/ver*` directories,
unrelated feature plans, or unrelated application domains by default.
