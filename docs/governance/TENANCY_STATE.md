# Jupiter Tenancy Programme State

**Document ID:** JUPITER-TENANCY-STATE

**Revision:** 1.86

**Status:** Canonical current-state handover; evidence only

**Reviewed:** 2026-09-15

This compact Multi-Tenant SaaS handover records current evidence but does not
authorize work. [`ACTIVE_WORK.md`](ACTIVE_WORK.md) remains the sole work-status
and authorization registry, subject to an explicit current Project Owner
instruction.

## Repository and programme position

- Repository: `C:\GMO\Projects\jupiter`
- Branch: `main`
- HEAD: `bad68aa8976c83e3d26cec1c2f1aceaaebfa6597`
- Master Plan Level 1 — application-level multi-tenant isolation: COMPLETE / VERIFIED
- Master Plan Level 2 — platform governance and operational SaaS readiness: PARTIAL
- All Level-1 implementation slices and L1-4 Final Mounted Adversarial Isolation Verification are COMPLETE / VERIFIED
- Level-2 Shared / Reference-Master Curator Authority: DEFINE COMPLETE
- L2-1 Platform Authority Foundation: COMPLETE / VERIFIED; migration 598 applied only to guarded `jupiter_test`; real bootstrap not executed
- L2-2 Fail-Closed Authority Boundary: COMPLETE / VERIFIED
- L2-2A Capability and Operation-Policy Foundation: COMPLETE / VERIFIED; migration 599 applied only to guarded `jupiter_test`; no real bootstrap executed
- L2-2B Mounted Route-Level HUMAN Platform Gates: COMPLETE / VERIFIED; Manufacturer create/update upload routes deferred to L2-2D
- L2-2C Authoritative Writer and Audit Boundary: COMPLETE / VERIFIED; both immutable before/after audit repairs verified; approved automated/file writers remain deferred to L2-2D
- L2-2D File and SERVICE-Principal Authority Boundary: DEFINE COMPLETE
- L2-2D1 Durable File-Operation Foundation: COMPLETE / VERIFIED; migration 600 applied only to guarded `jupiter_test`
- L2-2D2 Manufacturer HUMAN File Boundary: COMPLETE / VERIFIED
- L2-2D3 HUMAN/SERVICE SB Synchronization: COMPLETE / VERIFIED; guarded provisioning path implemented but not executed
- L2-2D4 Dormant-Writer Closure: COMPLETE / VERIFIED
- L2-2E full mounted/direct/cron/file/concurrency adversarial verification: COMPLETE / VERIFIED
- L2-3 through L2-7 reconciliation DEFINE: COMPLETE; no residual implementation
- Level 2 — Shared / Reference-Master Curator Authority: COMPLETE / VERIFIED
- Repository-local Level 3 — Tenant Provisioning and Lifecycle Administration: COMPLETE / VERIFIED; mapped to Master Plan Level 2
- L3-1 Lifecycle Capability, Persistence, and Coordination Foundation: COMPLETE / VERIFIED
- L3-2 Consolidated Authoritative Lifecycle Commands: COMPLETE / VERIFIED
- L3-3 Suspension Enforcement: COMPLETE / VERIFIED
- L3-4 Final Level-3 Adversarial Verification: VERIFY PASS
- Master Plan Level 3 — PostgreSQL RLS: NOT STARTED; blocked by remaining Level-2 gates
- Final Production SaaS Acceptance: NOT STARTED
- Remaining Master Plan Level-2 requirements DEFINE / INVESTIGATE: COMPLETE
- MP2-R1 Operating Model Contract: DEFINE / RECONCILIATION COMPLETE; decisions remain
- Next defined gate: Project Owner decisions required for MP2-R1A — Identity, Admin Continuity, Offboarding and Operations Contract
- Repository migration head: 601

Completed MT work: MT-4A, MT-4B, MT-4C3A, MT-4C3B, MT-4C3C, MT-4C4, MT-4C5,
MT-4C6B1, MT-4C6B2, MT-4C6B3, MT-4C7A, MT-4C7B, MT-4C7C, MT-4C7D, MT-4C8A, the tenant runtime privilege repair through migration 594, and the
stored tenant-context test repair.

## Active architecture decisions

- Authentic `TenantQueryAuthority` is issued only from a revalidated active
  tenant context; structural substitutes are invalid.
- Aircraft and Customer use `tenant_id`; SerializedComponent uses
  `custodian_tenant_id`; PlanningSession and historical Workpack ownership use
  `tenant_id`.
- Serialized installations require both Aircraft tenant and component custodian
  roots.
- Workpack children derive authority from the historical Workpack root;
  standalone snags derive it from Aircraft. Cross-tenant ambiguous TaskCards
  are unavailable.
- `resolveTenantContext` is intentionally mounted. The enforcement gate is
  route-local across the verified tenant-owned mounted operations; no global
  active-tenant gate is mounted.
- Legacy `aircraft_components.custodian_tenant_id` is approved as durable
  current custody. Installed Aircraft and custody tenants must match; removal
  preserves custody and the retained Aircraft link.
- Cross-tenant legacy custody transfer is deferred. Aircraft ownership changes
  must not rewrite custody.
- `aircraft_component_movement_history` is immutable event-time evidence, never
  current custody authority. Existing state receives no fabricated history.
- MT-4C6B3 preserves both mounted projection GET endpoints behind a route-local
  active-tenant gate and an authority-first projection service/repository.
  Aircraft use `tenant_id`; installed legacy components require both the owned
  Aircraft root and matching custody; removed inventory uses
  `custodian_tenant_id`. Fleet-health and summary predicates/classifications
  must match and preserve truthful `UNKNOWN` outcomes. Stale `components`,
  `SERVICEABLE`, and runtime `vw_component_status` use are excluded.
- MT-4C7A keeps `/audit` and `/audit/export` behind a route-local active-tenant
  gate and authentic authority through route/service/repository. Visibility is
  derived only from the eight approved operational roots and fails closed for
  unknown, shared, platform, missing, malformed, conflicting, or ambiguous
  ownership; audit payload values are not ownership authority.
- MT-4C7B removes broad `/uploads` static delivery. Aircraft photos require
  authenticated active-tenant authority, exactly one persisted canonical
  reference, matching Aircraft ownership, and safe physical-file resolution.
  Manufacturer logos remain authenticated shared-master content. Unapproved
  upload areas and unsafe, missing, orphaned, foreign, or ambiguous references
  fail closed; existing Aircraft and Manufacturer URL forms remain compatible.
- MT-4C7C gives all five mounted Customer Portal reads a dedicated branded
  `CustomerPortalQueryAuthority`, derived only from persisted ACTIVE
  CustomerUser, Customer, and Tenant roots. Aircraft, Workpack, released
  document metadata, and completed compliance projections enforce the approved
  relationship and matching tenant-root chain. Session `customer_id`, client
  ownership identifiers, and staff authority are never portal authority.
- MT-4C7D keeps the mounted serialized-component reconciliation report behind
  authentication, `LIBRARY_EDIT`, a route-local active-tenant gate, and authentic
  `TenantQueryAuthority` through controller/service/repository. Legacy rows
  require matching custody and Aircraft ownership; current serialized
  installations require matching SerializedComponent custody and Aircraft
  ownership. Foreign, broken, missing, or conflicting roots fail closed before
  calculations. Shared masters decorate authorized rows and are not ownership
  roots. Same-tenant ambiguity retains `INSTALLATION_CONFLICT`; the excluded
  global migration compatibility loader is not reachable from the mounted report.

## Verification and migration evidence

- Tenant-context/login DB-free/static baseline: 135/135 PASS.
- MT-4C5: 196/196 DB-free/static and 3/3 guarded two-tenant `jupiter_test` PASS.
- MT-4C6B1 preflight found zero unresolved custody rows, invalid statuses, or
  duplicate tenant/model/normalized-serial identities in local development and
  test data; neither noncanonical `components` nor `inventory_movements`
  existed.
- MT-4C6B1: 241/241 DB-free/static and 5/5 guarded `jupiter_test` PASS.
- MT-4C6B2: 35/35 focused DB-free/static and 10/10 guarded `jupiter_test` PASS.
- MT-4C6B3: IMPLEMENT complete and VERIFY PASS. Focused DB-free tests passed
  5/5 and the B3 file set passed `git diff --check`. Repository-wide whitespace
  findings in `seeders/040_library_seed.ts` were proven pre-existing and out of
  scope. No schema or migration change occurred.
- MT-4C7A: IMPLEMENT complete and VERIFY PASS. Focused DB-free tests passed 6/6
  and guarded two-tenant live tests passed 3/3, covering all eight mappings,
  same/foreign visibility, linked/standalone snags, ambiguous TaskCard denial,
  adversarial filters, and list/export equivalence. Residual first-attempt
  fixtures were safely removed without changing unrelated test data; final
  verification left zero residual fixtures. Utilisation immutability triggers
  and the current 110-entry migration ledger remained enabled and unchanged.
  The scoped diff check passed. Build/typecheck exposed only the established
  unrelated AircraftComponent repository cast error and no MT-4C7A compile
  error. No schema, migration, RBAC, audit-write, or unrelated functionality
  change occurred.
- MT-4C7B: IMPLEMENT complete and VERIFY PASS. DB-free tests passed 9/9 and
  guarded two-tenant live tests passed 3/3. Traversal/encoding, containment,
  symlink, non-file, missing-file, unique-reference, tenant ownership, shared-
  logo, and non-public-directory behavior were verified. `jupiter_test`
  identity, database totals, trigger hashes, and the current 110-entry migration
  ledger were unchanged; database/filesystem residue was zero. Root `/uploads/`
  remains ignored while `src/modules/uploads/` is trackable. The scoped diff
  check passed. Build exposed only the established unrelated AircraftComponent
  cast error and no MT-4C7B compile error. No schema, migration, upload-creation,
  RBAC, Customer Portal, Service Bulletin/compliance architecture, global gate,
  background-job, or RLS change occurred.
- MT-4C7C: IMPLEMENT complete and VERIFY PASS after a narrow malformed-session-ID
  repair added UUID validation before repository/database access. Missing,
  empty, non-string, malformed, and unusable IDs fail through the generic
  unavailable path without lookup, cast-error disclosure, authority creation,
  or route/service execution. DB-free tests passed 10/10 and guarded
  `jupiter_test` tests passed 3/3; cross-tenant Customer–Aircraft linkage and
  conflicting Workpack roots were denied across the five portal projections.
  Transaction rollback left zero residue, with migration ledger and trigger
  snapshot unchanged; the scoped diff check passed. Legacy regression was
  212/216 with four established out-of-scope stale inventory assertions and all
  portal assertions passing. Typecheck exposed only the established unrelated
  AircraftComponent cast error and no MT-4C7C compile error. No schema,
  migration, portal visual, physical-download, session-model, staff-authority,
  RBAC, Platform Administrator, global-gate, background-job, RLS, or unrelated
  functionality change occurred.
- MT-4C7D: COMPLETE / VERIFIED. Foreign data cannot influence matching,
  duplicate/conflict detection, buckets, exceptions, readiness,
  registrations/details, or counts. Summary counts are tenant-local; uninstalled
  tenant-custodied SerializedComponents count without fabricated installation or
  detail rows. Existing buckets, matching, ordering, presentation, output shape,
  and view remain compatible. Verification passed 6/6 focused DB-free tests,
  15/15 direct regressions, and 3/3 guarded two-tenant `jupiter_test` tests. The
  guarded live test rolled back with zero residue and unchanged migration ledger,
  relevant totals, and trigger state; scoped `git diff --check` passed. Build had
  no MT-4C7D error; the established unrelated TS2352 error remains in
  `aircraft-component-tenant.repository.live.ts`. No schema, migration, custody
  repair, view redesign, RBAC, global-gate, RLS, or unrelated functionality
  change occurred.
- MT-4C8A: COMPLETE / VERIFIED. The tenant-local migration preview, save, and
  batch-read routes require authentication, `LIBRARY_EDIT`, a route-local active-
  tenant gate, and authentic `TenantQueryAuthority`; save retains CSRF. Legacy
  custody/Aircraft ownership and SerializedComponent/current-installation roots
  are scoped before calculations, Aircraft ID is filter-only, and foreign data
  cannot influence matching, conflicts, proposals, readiness, or counts. The
  mounted workflow uses MT-4C7D reconciliation and cannot reach the global
  compatibility loader. Save regenerates authority-derived evidence and rejects
  mixed, foreign, or unverifiable rows atomically. Migration 597 supplies the
  immutable indexed UUID `NOT NULL` Tenant-FK batch owner; rows inherit through
  their parent, and retrieval predicates on batch plus tenant with neutral
  unavailable behavior. Backfill is deterministic-only; local ledgers were
  empty, so ownership was not guessed. Suspension denies runtime access while
  preserving evidence. Verification passed 8/8 static, 21/21 regressions, 3/3
  guarded two-tenant, and 5/5 guarded migration tests; exact `jupiter_test`
  retained migration 597 with zero batch/row/audit residue. Scoped diff-check
  passed, no MT-4C8A build error exists, and the unrelated established TS2352
  remains. The first guarded invocation safely refused without mutation because
  its quarantine flag was absent; the explicitly authorized rerun passed.
  VERIFY changed no files; production and staging/commit/push/deploy state were
  untouched. No global gate or Platform/System Owner authority was introduced.
- Level 1 — Operational Authority Activation on Tenant-Owned Mounted Routes:
  COMPLETE / VERIFIED. Aircraft tenant-owned mounted routes are gated before
  upload/CSRF/validation, with the shared Manufacturer/Model selector excluded;
  all Customer routes, tenant-owned Workpack controllers after RBAC, Inventory
  install/remove, and exactly nine tenant-owned SerializedComponent Library
  routes are gated. Shared Workpack template import and Library selectors remain
  excluded; reconciliation and migration tooling retain independent gates. No
  global gate was introduced. Authentic branded `TenantQueryAuthority` remains
  authoritative, and missing, malformed, fabricated, stale, suspended, and
  foreign contexts fail closed. Aircraft-photo post-upload cleanup remains
  deferred. Verification passed 8/8 DB-free/static and 14/14 guarded exact-
  `jupiter_test`; regressions were 55/58, with two stale migration-591 absence
  assertions and one stale removed-direct-Aircraft-call assertion. Verification
  rolled back with zero batch/row/audit or filesystem residue and unchanged
  relevant totals/triggers. Scoped diff-check passed; no slice-specific build
  error exists, while the unrelated established TS2352 remains. VERIFY changed
  no files; HEAD and staging/commit/push/deploy state were unchanged.
- Level 1 — Aircraft Photo Persistence Lifecycle: COMPLETE / VERIFIED. The three
  Aircraft create/update routes retain authentication/RBAC, tenant gate,
  lifecycle, Multer, CSRF, controller, and authority-aware persistence ordering.
  Aircraft filenames use collision-resistant `randomUUID()` naming; other upload
  naming is unchanged. Server-trusted Multer metadata and canonical root,
  basename, containment, regular-file, traversal, symlink, and alternative-target
  checks restrict idempotent cleanup to the request's uncommitted file. Commit
  follows service success; CSRF, validation, foreign/nonexistent, stale, and
  service/transaction failures clean the new upload. Committed files survive
  `finish`/`close`, and controller settlement closes the premature-close race.
  Failed replacement preserves the prior reference/file; successful replacement
  retains the old file. Historical orphan/old-photo deletion remains excluded;
  shared references and C7B delivery are unchanged. Verification passed 25/25
  DB-free, 4/4 guarded exact-`jupiter_test` plus filesystem, and 21/21 direct
  regressions (4/4 Aircraft authority, 9/9 C7B, 8/8 Operational Authority).
  Guarded work rolled back with unchanged relevant totals/triggers and zero
  batch/row/audit/filesystem residue. Scoped diff-check passed; no slice build
  error exists, and the established unrelated TS2352 remains. VERIFY changed no
  files; HEAD and staging/commit/push/deploy/migration state were unchanged.
- Migrations 595 and 596 applied through the guarded runner to local
  `jupiter_db` and `jupiter_test`. Migration 596 narrows effective movement
  history privileges after existing default table grants.

## Schema and database boundaries

- Migration 595 adds non-null legacy custody, deterministic Aircraft-tenant
  backfill, FK/index/normalized identity enforcement, custody and tenant-match
  triggers, and immutable movement history.
- Migration 596 leaves `jupiter_app` and `jupiter_test` movement-history
  `SELECT` and `INSERT` only, never `UPDATE` or `DELETE`.
- Migration 597 adds immutable tenant ownership to migration batches; rows
  inherit ownership through their mandatory parent.
- Development `jupiter_db`: local development data, migrated through 597.
- Guarded `jupiter_test`: test-only database, migrated through 597.
- Production `jupiter_db`: last established at migration 581 and untouched by
  MT-4. No production migration or deployment is authorized.
- No RLS, tenant-scoped RBAC, or global operational tenant gate is complete.

## Protected worktree and blockers

The worktree is extensively dirty and contains pre-existing/user-owned source,
test, governance, migration, backup, and untracked work. Treat every existing
change as protected unless provenance and authority prove otherwise. Never
clean, restore, reset, broadly stage, or absorb it.

- Other report/export and mounted tenant-sensitive surfaces, remaining
  attachment/file/cache boundaries, tenant RBAC, Platform/System Owner
  authority, wider tenant-gate activation, and RLS remain incomplete.
- The unrelated pre-existing TypeScript cast error in
  `aircraft-component-tenant.repository.live.ts` remains outside C6B1.

## Immediate next action and exclusions

Tenant-Local Staff and Role Administration is COMPLETE / VERIFIED. Both mounted
routes use active-membership RBAC before tenant-local
`ADMIN`, then the route-local active-tenant gate and authentic authority. Staff
queries are membership-rooted; role toggles atomically append/revoke
`tenant_membership_roles` with actor evidence and do not mutate `user_roles`.
Shared RBAC definitions remain unchanged. Independent formal verification passed
47/47 focused DB-free/RBAC/tenant-context tests, 17/17 direct authentication
regressions, and 3/3 guarded exact-`jupiter_test` tests. The transaction rolled
back with zero residue and unchanged migration ledger, shared-definition hashes,
audit total, and enabled-trigger count. Build retains only the unrelated known
TS2352; scoped diff-check passed. No schema or migration changed. All Level-1
implementation slices and L1-4 Final Mounted Adversarial Isolation Verification
are COMPLETE / VERIFIED. The
final mounted inventory reconciled tenant-owned operational routes, Customer
Portal, staff/RBAC, audit, reconciliation, migration tooling, files, projections,
dashboard, Workpack and background calculation paths against authentic tenant
authority and persisted ownership roots. Intentionally shared Library masters
and Manufacturer files remain shared and are not tenant-owned roots. Focused
final-composition tests passed 77/77; guarded exact-`jupiter_test` database and
filesystem tests passed 44/44 across 13 files. Rollback restored row and audit
totals; fixture, role-assignment, and filesystem residue were zero; migration
ledger, triggers, batches, and shared invariants were unchanged. The broad
DB-free sweep passed 640/651; its 11 failures are established stale historical
migration/direct-model/raw-query inventory assertions, not application-level
tenant-isolation defects. Build retains only the known unrelated TS2352. Schema
and migrations were unchanged and none were applied. No Level-1 defect or
verification-time implementation change occurred. The canonical Level-1
programme state is `APPLICATION_LEVEL_MULTI_TENANT_ISOLATION_COMPLETE`.
Shared/reference-master curator authority remains a Level-2 boundary. Its
investigation and DEFINE are complete in
[`LEVEL2_SHARED_REFERENCE_MASTER_CURATOR_DEFINE.md`](LEVEL2_SHARED_REFERENCE_MASTER_CURATOR_DEFINE.md);
the L2-1 foundation is COMPLETE / VERIFIED in
[`LEVEL2_PLATFORM_AUTHORITY_FOUNDATION_DEFINE.md`](LEVEL2_PLATFORM_AUTHORITY_FOUNDATION_DEFINE.md).
Repository-only authority issuance, fabricated-authority rejection,
tenant/platform and human/service separation, transactional revalidation,
grant/revoke, stale-authority rejection, multiple-owner support, concurrent
last-owner protection, immutable global audit, and the complete guarded
bootstrap boundary are verified. The exact 112-entry ledger at head 598, four
tables, two capability seeds, enabled audit trigger, durable one-time bootstrap
evidence, clean UP/DOWN and populated-DOWN refusal passed. Verification passed
32/32 L2-1 DB-free, 5/5 guarded `jupiter_test`, 16/16 Level-1 DB-free, and 4/4
guarded Level-1 regression tests. Final residue was zero; scoped diff-check
passed; build retained only the established unrelated TS2352. The real
bootstrap was not executed, no shared-master route was converted, no tenant
lifecycle work began, and Level 1 remains unchanged. L2-2 Fail-Closed Authority
Boundary DEFINE is complete in
[`LEVEL2_FAIL_CLOSED_AUTHORITY_BOUNDARY_DEFINE.md`](LEVEL2_FAIL_CLOSED_AUTHORITY_BOUNDARY_DEFINE.md).
It preserves shared reads and Level 1 while defining granular repository-
revalidated authority, immutable global audit, service-principal enforcement,
safe file effects, and fail-closed pre-bootstrap behavior. No implementation or
bootstrap occurred. L2-2A Capability and Operation-Policy Foundation is
COMPLETE / VERIFIED. Migration 599 adds 15 granular locked capabilities, 17
total platform capability seeds, with no wildcard capability or automatic
grants; fixed shared-operation and allowlisted reference/RBAC registries map
each operation to exactly one capability and its HUMAN-only or approved
HUMAN-or-SERVICE SB synchronization rule. Repository-issued authority is
transactionally revalidated and fails closed for missing, fabricated, stale,
revoked, inactive, wrong-type, tenant-derived, and legacy-role-shaped authority,
including unconditionally before bootstrap. Every exported and resolved policy
entry and nested principal-type collection is independently runtime-immutable.
Shared reads and mounted shared writers remain unchanged. Formal verification
passed 36/36 DB-free L2 tests (12 L2-2A plus 24 L2-1), 2/2 guarded L2, 39/39
Level-1 DB-free regressions and 13/13 guarded Level-1 regressions; migration 599
clean DOWN/reapply passed with zero residue, ledger head 599, 17 total capability
seeds, no automatic grants, and the enabled audit trigger preserved. Build
retained only the established unrelated TS2352. The real bootstrap was not
executed, no shared-master route or writer conversion beyond the approved
foundation occurred, and Level-1 and L2-1 remain intact. L2-2B Mounted
Route-Level HUMAN Platform Gates is COMPLETE / VERIFIED. The
fixed mounted-route gate follows authentication and precedes existing
route-local RBAC, CSRF/upload middleware, and handlers for every included HUMAN
shared/global mutation route. It resolves repository-issued active HUMAN
authority and revalidates each fixed operation capability at the route boundary;
tenant/legacy roles, authentication alone, invalid authority, wrong capability,
SERVICE principals, and pre-bootstrap requests fail closed. Shared reads and
tenant-owned Library mutations remain unchanged. `POST
/library/manufacturers` and `POST /library/manufacturers/:id/update` are
**DEFERRED TO L2-2D — upload-dependent capability boundary** and unchanged. No
L2-2C/D enforcement was implemented. Formal re-verification passed 35/35 focused
L2-2B, 71/71 DB-free L2, 2/2 guarded L2 `jupiter_test`, 39/39 Level-1 DB-free,
and 13/13 guarded Level-1 regressions. The repaired SID, AD-import, SB-import,
and model-bound SB mappings require every applicable fixed capability. Residue,
ledger head 599, 17 seeds, no grants, and the
enabled audit trigger remained intact. Build retained only the established
unrelated TS2352. Mounted HUMAN route gates are established. Deeper
service/repository authority enforcement, transactional write-boundary
revalidation, mutation-plus-platform-audit, and direct-writer protection remain
L2-2C. Upload quarantine/promotion/cleanup, SERVICE-principal synchronization,
and both deferred Manufacturer routes remain L2-2D. Level-1, L2-1, and L2-2A
remain intact, and the real bootstrap remains unexecuted. The exact next gate is
Project Owner authorization for a bounded L2-2C SB allocation relationship
before/after audit repair. L2-2C implementation now closes direct-writer bypass for every
remaining DEFINE-assigned HUMAN shared/global writer through repository-issued
HUMAN authority, exact fixed operations, transactional live capability
revalidation, and atomic immutable platform-global audit. Invalid, stale,
revoked, inactive, missing, wrong-type, and operation-mismatched authority fails
closed. Manufacturer create/update and upload routes, Service Bulletin sync and
its scheduled chain, automated maintenance-trigger creation, and the three
`ComplianceProjectionService` projection writers are explicitly deferred to
L2-2D; no optional compatibility authority exists. Verification during
implementation passed 5/5 focused L2-2C, 76/76 platform DB-free, 70/70 relevant
writer/route, 3/3 guarded L2, and 21/21 guarded Level-1 tests. The 640/651 broad
DB-free result contains only the 11 established stale historical assertions.
Rollback left zero fixture residue with ledger head 599, 17 capability seeds,
and the immutable-audit trigger preserved. No schema/migration change or real
bootstrap occurred. The bounded repair now captures authoritative pre-state
under transaction-local row locks for affected update, deactivate, delete,
relationship/allocation, mixed create/update, and life-limit writers, with
deterministic after-state and canonical null delete after-state. Forced audit
failure rolls back the protected mutation. Focused repair/domain tests passed
68/68 plus 35/35 supplemental tests; platform DB-free regressions passed 80/80,
Level-1 DB-free 39/39, and guarded L2 3/3 with zero residue, ledger head 599, 17
seeds, no grants, and the enabled audit trigger preserved. Build retains only
the established unrelated TS2352. Focused re-verification found that
`linkSbModelAllocationToModels` and `createIncompleteModelFromSbAllocation`
mutate `service_bulletin_models` and their allocation row while capturing only
the original allocation as before-state and emitting summaries instead of the
authoritative resulting allocation and relationship rows. Re-verification
stopped without repair or test execution. The bounded repair now captures the
locked allocation, deterministic relevant relationship set, and applicable
pre-existing model state before mutation, then reloads authoritative allocation,
relationship, and created/reused model state for immutable audit in the same
transaction. Focused writer tests passed 74/74, platform-authority regressions
81/81, and guarded exact `jupiter_test` authority tests 3/3 with zero residue,
ledger head 599, 17 seeds, no grants, and the audit trigger enabled. No schema,
migration, or bootstrap change occurred. The next gate is Project Owner
authorization required for focused L2-2C RE-VERIFY. L2-2D is not authorized or begun.
Focused formal re-verification passed: authoritative locked pre-state and
persisted post-state were verified for the SB allocation, relationship, and
created/reused model paths, together with the earlier repaired writer families,
atomic mutation/audit rollback, HUMAN authority, transactional revalidation,
and direct-writer protection. Focused writer tests passed 74/74, L2 authority
tests 81/81, and guarded exact `jupiter_test` tests 3/3 with zero residue,
ledger head 599, 17 seeds, no grants, and the audit trigger enabled. The wider
Level-1 selection passed 63/66 with only three established stale historical
inventory assertions. L2-2C is COMPLETE / VERIFIED. All L2-2D deferrals remain
unchanged, the real bootstrap remains unexecuted, and L2-2D has not begun.
L2-2D DEFINE is complete. The exact deferred inventory is Manufacturer
master/file mutation, manual and scheduled SB synchronization, the dormant
maintenance-trigger global writer, and the dormant Compliance Projection
writers. Existing capabilities suffice. Migration 600 is required only for a
durable file-operation journal; no new capability, principal or grant is
defined. Maintenance must not create tenant-specific warnings as shared
masters, and uncalled projection writers receive no fabricated authority. No
implementation has begun. The next gate is Project Owner authorization for
L2-2D1 — Durable File-Operation Foundation IMPLEMENT. Formal focused D1
verification passed 131/131 DB-free and 5/5 guarded exact `jupiter_test` tests.
Migration 600 DOWN/reapply and populated-DOWN refusal, bounded recovery, crash
state, validation, promotion, cleanup, committed-file preservation, and zero
residue were verified. Ledger head 600, 17 seeds, no grants, and audit
protection remain intact. L2-2D1 is COMPLETE / VERIFIED. The next gate is
Project Owner authorization required for L2-2D2 Manufacturer HUMAN File
Boundary IMPLEMENT; D2 has not begun.
L2-2D1 implementation is complete and ready for VERIFY. Migration 600 adds only
the constrained durable file-operation journal; reusable quarantine,
content-validation, promotion, cleanup and bounded recovery mechanics are now
implemented without mounting or converting a business flow. Guarded migration
UP/DOWN/reapply and populated-DOWN refusal passed. Focused tests passed 33/33,
direct upload/Aircraft Photo/L2 regressions 130/130, guarded D1 2/2 and guarded
L2 authority 3/3. Exact `jupiter_test` retains zero fixture residue, ledger head
600, 17 capability seeds, no grants and the immutable audit trigger. Real
bootstrap remains unexecuted; Manufacturer/SB conversion and D2 have not begun.
The next gate is Project Owner authorization required for formal focused VERIFY
of L2-2D1.
L2-2D2 Manufacturer HUMAN File Boundary is COMPLETE / VERIFIED. The two Manufacturer create/update routes and writers require
active repository-issued HUMAN authority; logo add/replace additionally
requires `MANUFACTURER_FILE_REPLACE` and an opaque D1 file commit. No-logo
create and no-replacement update retain master-only semantics. The D1 journal
records the authoritative locked prior logo, failed mutations/audits compensate
the new file, and successful replacement preserves URL compatibility while
deleting an obsolete prior file only when unreferenced. Focused tests passed
68/68; guarded exact `jupiter_test` tests passed 3/3 with zero residue, ledger
head 600, 17 capability seeds, zero grants/SERVICE principals/bootstrap
evidence, and the immutable audit trigger preserved. The next gate is Project
Owner authorization required for L2-2D3 HUMAN/SERVICE SB Synchronization
IMPLEMENT.
L2-2D3 HUMAN/SERVICE SB Synchronization is COMPLETE / VERIFIED. Manual HUMAN and scheduled exact `SB_SYNC_SCHEDULER` SERVICE execution
share fresh repository authority, transactional revalidation, database overlap
locking, deterministic before/after evidence and atomic sync-run/mutation/audit
state. Manual CSV/PDF input uses the private D1 ephemeral lifecycle; client
paths are refused and scheduled sources require trusted-root containment. The
atomic provisioning operation grants only `SERVICE_BULLETIN_SYNC_EXECUTE`; it
and the real bootstrap were not executed. Focused tests passed 78/78 and guarded
exact `jupiter_test` tests passed 4/4 with zero test residue, ledger head 600,
17 capabilities and the audit trigger preserved. Lean formal verification
reused that fresh passing evidence; exact `jupiter_test` retained zero grants,
no provisioned scheduler/bootstrap evidence and zero pending file journals.
The next gate is Project Owner authorization required for L2-2D4 Dormant-Writer
Closure IMPLEMENT.
L2-2D4 Dormant-Writer Closure is COMPLETE / VERIFIED. The
Maintenance Trigger shared-master writer and all three dormant Compliance
Projection writers fail closed before database work. Legitimate projection
reads remain unchanged; no capability, principal, grant, migration, bootstrap
or completed D-slice behavior changed. Focused tests passed 11/11 and no guarded
DB execution was required. Minimal formal verification reused that fresh focused
evidence and confirmed all four entries fail closed immediately. The next gate
is Project Owner authorization required for L2-2E full mounted/direct/cron/file/
concurrency adversarial verification. L2-2E then passed: the approved nine
DB-free groups passed 78/78 and the three guarded exact `jupiter_test` groups
passed 4/4. Mounted/direct authority, transactional revocation, HUMAN/SERVICE
separation, scheduler overlap locking, D1 file safety/recovery, atomic
mutation/audit rollback, dormant-writer closure and pre-bootstrap denial were
verified. Guarded rollback left zero residue with ledger head 600, 17
capabilities, no unintended grants/provisioning, and the immutable audit trigger
intact. L2-2E and the L2-2 Fail-Closed Authority Boundary are COMPLETE /
VERIFIED. Level 2 remains in progress; the next canonical programme item is
L2-3 Generic Reference/RBAC Definitions. The next gate is Project Owner
authorization required for L2-3 Generic Reference/RBAC Definitions DEFINE /
INVESTIGATE.
The consolidated L2-3 through L2-7 reconciliation DEFINE finds all operative
requirements already satisfied and verified by L2-2A–E, with no residual
implementation. Dormant maintenance/projection authority is superseded by
fail-closed closure; real bootstrap and SERVICE provisioning remain separate
operational actions. The next gate is Project Owner authorization required for
L2-8 Final Adversarial Verification, followed on PASS by separate Level-2
governance closeout.
The first L2-8 attempt stopped because an L2-2C regression still expected the
pre-D4 Maintenance Trigger inventory text. The bounded repair now asserts the
verified D4 fail-closed marker and passed its directly affected 4/4 tests. L2-8
remains not passed. The next gate is Project Owner authorization required for
L2-8 Final Adversarial RE-VERIFY.
The production-import allowlist reconciliation added exactly the 17 verified
Library/Workpack consumers omitted by the stale contract while retaining
test-support and D4-disabled exclusions, delegated enforcement, mandatory
assertion/delegation, and unsafe fallback/query checks. The affected test passed
8/8, the blocking Level-1 selection passed 16/16, and the L2-8 DB-free
prerequisite passed 36/36. The repair is complete and ready for L2-8 re-VERIFY;
L2-8 itself remains not passed.
L2-8 Final Level-2 Adversarial Verification passed. It reused the fresh 16/16
targeted Level-1 and 36/36 L2-8 DB-free evidence; the three guarded exact
`jupiter_test` groups passed 4/4. Rollback left zero database/filesystem residue,
ledger head 600, 17 capabilities, no unintended grants/principals/bootstrap,
and the immutable audit trigger intact. Authority, revocation, HUMAN/SERVICE
separation, scheduler concurrency, file recovery, audit rollback,
dormant-writer closure and pre-bootstrap denial passed. L2-8 is awaiting
Level-2 governance closeout. The next gate is Project Owner authorization
required for Level-2 GOVERNANCE CLOSEOUT.
Level 2 — Shared / Reference-Master Curator Authority is COMPLETE / VERIFIED.
The platform/shared-master authority boundary is complete, L2-8 final
adversarial verification passed, and L2-3 through L2-7 remain reconciled as
already satisfied/verified or superseded. The real System Owner bootstrap and
operational `SB_SYNC_SCHEDULER` SERVICE provisioning remain unexecuted and
separately authorized. No production migration was performed. At Level-2
closeout no successor programme had been defined or begun; the next gate was
Project Owner authorization to DEFINE the successor programme level.

Level 3 — Tenant Provisioning and Lifecycle Administration DEFINE is complete
in
[`LEVEL3_TENANT_PROVISIONING_LIFECYCLE_DEFINE.md`](LEVEL3_TENANT_PROVISIONING_LIFECYCLE_DEFINE.md).
It consolidates the shortest safe path into L3-1 capability/persistence/locking
foundation, L3-2 authoritative provisioning and lifecycle commands, L3-3
complete suspension enforcement, and L3-4 final adversarial verification.
Existing tenant states, active-context and Customer Portal revalidation,
tenant-authorized routes/files, repository-issued HUMAN platform authority,
transaction-time capability revalidation, and immutable global audit are
reused. Suspension preserves tenant data and denies tenant staff/ADMIN, portal,
file, and tenant-job access while other tenants remain unaffected. Transfer,
quotas, archive/delete, RLS, real bootstrap, SERVICE provisioning, and
production action are excluded or deferred. No implementation, database action,
bootstrap, or provisioning occurred. The next gate is Project Owner
authorization required for **L3-1 — Lifecycle Capability, Persistence, and
Coordination Foundation IMPLEMENT**.

L3-1 Lifecycle Capability, Persistence, and Coordination Foundation is
IMPLEMENT COMPLETE / READY FOR VERIFY. Migration 601 is applied only to guarded
`jupiter_test`; it adds four locked HUMAN lifecycle capabilities, canonical
transition and metadata enforcement, unconditional tenant-delete denial, and
removes `jupiter_app` tenant DELETE privilege. Shared tenant-work and exclusive
lifecycle transaction advisory locks use one tenant-keyed namespace. Lifecycle
operations now resolve through the Level-2 authority/revalidation/audit policy
foundation. Focused tests passed 6/6 and directly affected Level-2 audit tests
passed 4/4; guarded exact-`jupiter_test` tests passed 3/3 with zero fixture
residue, guarded DOWN refusal, and clean DOWN/reapply. No command, route,
suspension enforcement, bootstrap, SERVICE provisioning, production action, or
later Level-3 slice began. The next gate is Project Owner authorization required
for **L3-1 formal focused VERIFY**.

L3-1 Lifecycle Capability, Persistence, and Coordination Foundation is COMPLETE
/ VERIFIED. Fresh verification passed 6/6 focused DB-free, 4/4 directly affected
Level-2 authority/audit, and 3/3 guarded exact-`jupiter_test` tests. Migration
601 clean DOWN/reapply passed and remains applied only to `jupiter_test`; ledger
head 601, four locked lifecycle capabilities, transition/delete triggers,
revoked `jupiter_app` tenant DELETE, and zero fixture residue were confirmed.
The single build has no L3-1 error and retains only the established unrelated
TS2352. No bootstrap, SERVICE provisioning, production migration, transfer,
quota, archive/delete, RLS, or later Level-3 work occurred. The next gate is
Project Owner authorization required for **L3-2 Consolidated Authoritative
Lifecycle Commands IMPLEMENT**.

L3-2 `exactOptionalPropertyTypes` and `publicId` route type repairs are COMPLETE
/ READY FOR L3-2 VERIFY. Missing optional fields are omitted and all three route
parameters use a fail-closed string narrowing helper. Focused tests passed 5/5;
the single build has no L3-2 error and retains only the established unrelated
TS2352. Runtime lifecycle semantics and guarded database state were unchanged.
The next gate is Project Owner authorization required for **L3-2 formal focused
VERIFY**.

L3-2 Consolidated Authoritative Lifecycle Commands is COMPLETE / VERIFIED.
Formal verification reused fresh 5/5 DB-free, 1/1 guarded exact-`jupiter_test`,
6/6 legacy provisioning closure, and build evidence; the missing `publicId`
fail-closed adversarial check passed 1/1. Exact HUMAN capabilities, fabricated/
stale/revoked denial, exclusive tenant coordination, atomic transition and
immutable before/after platform audit, rollback, provisioning-bypass closure,
and tenant deletion denial are verified with zero guarded fixture residue. No
L3-3 implementation began. The next gate is Project Owner authorization
required for **L3-3 Suspension Enforcement IMPLEMENT**.

L3-3 Suspension Enforcement is IMPLEMENT COMPLETE / READY FOR VERIFY. Mounted
staff and Customer Portal access now share lifecycle coordination with the
exclusive L3-2 commands and revalidate active tenant state under that lock,
closing stale-session and suspend/access races. Tenant-owned file delivery
inherits the staff gate; ADMIN and portal identities cannot bypass it. Tenant
data and files remain unchanged, and reinstatement restores legitimate access.
No mounted tenant scheduler exists: the active scheduler remains the verified
platform-global Level-2 SERVICE job, while dormant tenant writers remain fail
closed. Focused tests passed 6/6 plus 31/31 affected regressions; guarded exact-
`jupiter_test` coordination passed 1/1 with no retained advisory lock. The
single build reports only the established unrelated AircraftComponent TS2352.
The next gate is Project Owner authorization required for **L3-3 formal focused
VERIFY**.

L3-3 Suspension Enforcement is COMPLETE / VERIFIED. Formal verification reused
the fresh 6/6 adversarial, 31/31 affected boundary, 1/1 guarded coordination,
and build evidence. One missing guarded exact-`jupiter_test` adversarial check
passed 1/1: an exclusive lifecycle lock for one tenant leaves another tenant's
shared access unaffected. Suspension denial, ADMIN/stale-session/portal/file
closure, race safety, reinstatement, data preservation, scheduler exclusions,
and inherited Level-1/Level-2/L3 protections are verified with no fixture or
lock residue. The next gate is Project Owner authorization required for **L3-4
Final Level-3 Adversarial Verification**.

L3-4 Final Level-3 Adversarial Verification is VERIFY PASS / awaiting Level-3
governance closeout. Verified L3-1/L3-2/L3-3 evidence was reused. Fresh guarded
exact-`jupiter_test` cross-boundary verification passed 1/1 with atomic
suspend/reinstate audit, preserved membership and peer tenant, deletion denial,
rollback, and zero residue. Three selected Level-1/Level-2 regressions passed
3/3 for tenant-isolated repositories, authentic HUMAN platform authority and
exact operations, and dormant-writer closure. Migration 601, its four locked
HUMAN capabilities, shared/exclusive coordination, mounted suspension gates,
global SERVICE separation, and the absence of unintended grants/bootstrap/
production actions remain established. The next gate is Project Owner
authorization required for **Level-3 GOVERNANCE CLOSEOUT**.

LEVEL 3 — TENANT PROVISIONING AND LIFECYCLE ADMINISTRATION — COMPLETE /
VERIFIED. Provisioning, activation, suspension, and reinstatement are complete
under Platform HUMAN lifecycle authority; tenant and legacy roles cannot
substitute. Suspension preserves tenant records/files while denying staff,
ADMIN, stale-session, Customer Portal, tenant-file, and applicable tenant
activity. Reinstatement restores legitimate access to the same data, cross-
tenant isolation remains verified, and tenant deletion remains prohibited.
Real System Owner bootstrap, `SB_SYNC_SCHEDULER` SERVICE provisioning, and
production migration/action remain unexecuted. AircraftComponent TS2352 remains
OPEN deferred technical debt requiring separate bounded investigation/repair.
Transfer, quotas, archival/deletion, and PostgreSQL RLS remain deferred. No
successor programme has been defined or begun. The next gate is Project Owner
authorization to **DEFINE the successor programme level**.

Master Plan governance reconciliation: the Project Owner's Complete Master
Execution Plan baseline 9 September 2026 controls programme level meaning.
Completed repository-local Level 2 platform/shared-master authority and
repository-local Level 3 tenant provisioning/lifecycle are preserved as
COMPLETE / VERIFIED Master Plan Level-2 requirements. They do not establish
Master Plan Level-2 completion and do not constitute Master Plan Level 3.

Master Plan Level 2 is PARTIAL. Remaining requirements are System Owner
operational activation; the Jupiter provider/organisation hierarchy business-
model decision and resulting requirements; real System Owner bootstrap;
`SB_SYNC_SCHEDULER` SERVICE provisioning; operational SaaS readiness;
onboarding/offboarding; backup/restore/incident/lockout procedures;
monitoring/alerting; production secrets/configuration/environment separation;
and controlled production migration/deployment readiness. No QA-MAN or
SAFETY-MAN provider semantics are assumed. AircraftComponent TS2352 remains OPEN
deferred technical debt requiring separate bounded investigation/repair.

Master Plan Level 3 PostgreSQL RLS is NOT STARTED and blocked until required
preceding Level-2 gates complete. Final Production SaaS Acceptance is NOT
STARTED. The prior successor-programme gate is superseded by this Project Owner
reconciliation. The exact next gate is Project Owner authorization for **Master
Plan Level 2 Remaining Operational SaaS and Provider/Organisation Requirements
DEFINE / INVESTIGATE**. It authorizes definition only, not implementation,
bootstrap, SERVICE provisioning, RLS, production action, or acceptance.

Remaining Master Plan Level-2 requirements DEFINE / INVESTIGATE is COMPLETE in
[`MASTER_PLAN_LEVEL2_REMAINING_REQUIREMENTS_DEFINE.md`](MASTER_PLAN_LEVEL2_REMAINING_REQUIREMENTS_DEFINE.md).
Existing guarded bootstrap and scheduler provisioning foundations are verified
but unexecuted; operator capability administration, a guarded scheduler-
provisioning entry point, privacy-safe observability, operational runbooks,
environment/release controls, rehearsals, and production activation remain.
Provider hierarchy is conditional on a Jupiter-specific Project Owner business
decision; current evidence establishes independent Organisations and multi-
tenant user memberships, not a Provider ownership tier. The exact next gate is
**Project Owner business decisions required for MP2-R1 — Operating Model
Decisions and Fixed Operational Contracts**. Master Plan Level 2 remains
PARTIAL; RLS and final Production SaaS Acceptance remain NOT STARTED.

MP2-R1 is reconciled in
[`MASTER_PLAN_LEVEL2_MP2_R1_OPERATING_MODEL_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R1_OPERATING_MODEL_DEFINE.md).
The fixed release model is System Owner → independent Company/Tenant → Company
Administrator → Company Users. No Provider or parent/subsidiary tier is
required; future hierarchy remains deferred behind explicit permission-based
sharing design. Existing tenant provisioning, atomic first-admin assignment,
isolation, suspension/reinstatement, platform/shared-master authority, tenant-
local role toggling, and core database safety remain verified and must not be
rebuilt. The exact next gate is **Project Owner decisions required for MP2-R1A
— Identity, Admin Continuity, Offboarding and Operations Contract**.

Until separately authorized: no later tenancy slice, custody transfer,
additional schema/migration, production action, RBAC/RLS, wider gate activation,
staging, commit, push, reset, restore, clean, or deployment.

MP2-R1A Identity, Admin Continuity and Offboarding DEFINE is complete in
[`MASTER_PLAN_LEVEL2_MP2_R1A_IDENTITY_ADMIN_OFFBOARDING_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R1A_IDENTITY_ADMIN_OFFBOARDING_DEFINE.md).
First-admin assignment, membership lifecycle states, retained role history,
same-tenant ADMIN role administration, and request-time disabled-membership
rejection are reusable. Missing work is invitation/acceptance, membership
disable/reinstate commands, immutable
membership-authority audit, and exact HUMAN System Owner ADMIN recovery. The
exact next gate is Project Owner authorization for **MP2-R1A-1 Consolidated
Identity, Membership Administration and Admin-Recovery Foundation IMPLEMENT**.

MP2-R1A-1 is **IMPLEMENT COMPLETE / READY FOR FORMAL VERIFY**. Migration 602 is
reapplied only to guarded `jupiter_test`; no capability grant, bootstrap,
SERVICE provisioning, or production action occurred. Focused DB-free checks
pass. The separately launched guarded adversarial DB test was blocked before
startup by the tool sandbox, so that evidence remains for the exact next gate:
**Project Owner authorization required for MP2-R1A-1 formal focused VERIFY**.

MP2-R1A-1 formal VERIFY is historically **FAIL**: migration 602 incorrectly
activated database last-active-ADMIN enforcement. The Project Owner clarified
that guarantee is deferred. Additive migration 603, applied only to guarded
`jupiter_test`, removes exactly the two enforcement triggers and sole-purpose
function while preserving 602 invitation, membership, audit, capability,
recovery, privilege, and isolation structures. Guarded 603 UP/DOWN/reapply and
focused checks pass; ledger head is 603 with no enforcement-object/fixture
residue or `TENANT_ADMIN_RECOVER` grant. Current state is **BOUNDED REPAIR
COMPLETE / READY FOR FORMAL RE-VERIFY**. The exact next gate is Project Owner
authorization for **MP2-R1A-1 formal focused RE-VERIFY**.

The bounded MP2-R1A-1 bootstrap reconciliation is complete. Guarded bootstrap
now requires the exact canonical migration ledger through 603 and exact set of
22 active, system-locked capabilities. Focused DB-free bootstrap/authority tests
pass 21/21, lifecycle commands pass 5/5, and guarded exact-`jupiter_test`
bootstrap passes 1/1 inside rollback with zero principal/grant/audit residue.
Deferred last-ADMIN database objects remain absent and `TENANT_ADMIN_RECOVER`
remains ungranted. The prior RE-VERIFY FAIL is preserved. Current state is
**BOUNDED REPAIR COMPLETE / READY FOR FORMAL RE-VERIFY**; the exact next gate is
Project Owner authorization for **MP2-R1A-1 formal focused RE-VERIFY**.

MP2-R1A-1 — Identity, Membership, Administration & Recovery is **COMPLETE /
VERIFIED** after formal focused re-verification. Historical failed attempts and
both bounded repairs remain preserved. Invitation, tenant-local membership and
role administration, disable/reinstate, exact HUMAN recovery, immutable audit,
atomic rollback, stale/revoked denial, and peer-tenant preservation pass.
Migration 603 remains ledger head; 602 is unchanged; deferred last-ADMIN
database objects remain absent; all 22 canonical capabilities remain intact;
`TENANT_ADMIN_RECOVER` has no unintended grant; guarded residue is zero. The
then-next DEFINE / RECONCILE gate for MP2-R2 is satisfied by the current record
below.

Governance reconciliation and MP2-R2 DEFINE / RECONCILE are COMPLETE. The
current record preserves MP2-R1A-1 COMPLETE / VERIFIED, its historical failures
and repairs, migration head 603, the exact 22-capability set, deferred
last-ADMIN enforcement, Master Plan Level 2 PARTIAL, and RLS NOT STARTED.
MP2-R2 reuses existing authority, bootstrap, lifecycle, recovery, scheduler and
file foundations. It defines no migration; its missing boundary is mounted
HUMAN System Owner operations, privacy-safe structured observability,
configuration refusal, and guarded operational entry points. No implementation
or operational action began. The exact next gate is Project Owner authorization
for **MP2-R2 focused IMPLEMENT**.

MP2-R2 focused IMPLEMENT is COMPLETE / READY FOR FORMAL VERIFY. The bounded
HUMAN platform administration/read surface, fixed scheduler provisioning
command, bootstrap preflight/package commands, structured privacy-safe events,
non-disclosing health, startup refusal and configured production file roots are
implemented without schema change. Focused verification passed 132/132 DB-free
and 1/1 guarded exact-`jupiter_test`; rollback left zero platform principal,
grant, audit or user residue. The build has no MP2-R2 error and retains only
the established unrelated AircraftComponent TS2352. No real bootstrap, SERVICE
provisioning, production action, RLS or MP2-R3 work occurred. The exact next
gate is Project Owner authorization for **MP2-R2 formal focused VERIFY**.

MP2-R2 — Guarded Platform Operations and Privacy-Safe Observability is
COMPLETE / VERIFIED. Lean formal verification passed 57/57 selected DB-free
checks and 1/1 guarded exact-`jupiter_test`; transaction rollback left zero
platform principal, grant, audit, or test-user residue. HUMAN/SERVICE
separation, fresh fail-closed platform authority, exact scheduler purpose,
migration-603/exact-22-capability bootstrap preflight, privacy-safe
telemetry/health, production configuration refusal, and tenant/lifecycle
isolation remained intact. No real bootstrap, SERVICE provisioning,
schema/migration, production, RLS, or MP2-R3 action occurred. The exact next
gate is Project Owner authorization for **MP2-R3 focused IMPLEMENT**.

MP2-R3A — Core SaaS Operator Runbooks focused IMPLEMENT is COMPLETE / READY FOR
FORMAL VERIFY. Five operator runbooks document only existing guarded bootstrap,
scheduler provisioning, tenant lifecycle, and membership/recovery mechanisms.
The null staff-invitation delivery, absent disabled-scheduler recovery, and
deferred last-active-ADMIN enforcement are explicit operational stops or
precautions. No application, database/schema/migration, real bootstrap, SERVICE
provisioning, production, RLS, or MP2-R3B action occurred. The exact next gate
is Project Owner authorization for **MP2-R3A formal focused VERIFY**.

MP2-R3A formal VERIFY failed only on the unsupported pre-activation onboarding
verification sequence. The bounded runbook repair is COMPLETE / READY FOR
FORMAL RE-VERIFY. The corrected sequence verifies only returned tenant
identity/status and platform audit while `PROVISIONING`, relies on the guarded
activation command's active-ADMIN check, and defers tenant-context/ADMIN access
verification until the tenant is `ACTIVE`. Null invitation delivery, disabled
scheduler recovery, and mounted membership-audit viewing remain open. The exact
next gate is Project Owner authorization for **MP2-R3A formal focused
RE-VERIFY**.

MP2-R3A — Core SaaS Operator Runbooks is COMPLETE / VERIFIED. Formal RE-VERIFY
passed the repaired onboarding boundary: only returned tenant identity/status
and platform audit are checked while `PROVISIONING`; guarded activation requires
an active ADMIN; tenant-context and `/auth/staff` ADMIN verification occur only
after `ACTIVE`. The original VERIFY failure and repair remain recorded. Null
invitation delivery, disabled-scheduler recovery, and mounted membership-audit
viewing remain open for subsequent MP2-R3 enablement, recovery-control, and
operator-evidence work respectively. The exact next gate is Project Owner
authorization for **MP2-R3B focused IMPLEMENT**.

MP2-R3B — Backup, Restore, Incident and Emergency Recovery Runbooks focused
IMPLEMENT is COMPLETE / READY FOR FORMAL VERIFY. The documentation preserves
database/file consistency, lifecycle and authority state, immutable evidence,
tenant isolation, non-production restore rehearsal, and repository-supported
lockout controls. RPO/RTO and production topology/provider remain unresolved;
unsupported orchestration, scheduler-only shutdown, secret/deployment recovery,
and incident tooling are explicit gaps. The three MP2-R3A gaps remain open. No
application, schema/migration, database, real backup/restore, production, RLS,
or MP2-R3C action occurred. The exact next gate is Project Owner authorization
for **MP2-R3B formal focused VERIFY**.

MP2-R3B — Backup, Restore, Incident and Emergency Recovery Runbooks is COMPLETE
/ VERIFIED. Static formal verification confirmed repository-supported storage,
migration-evidence, authority, lifecycle, audit and shutdown mechanisms; the
controlled non-production restore requirement; and the documented safety and
isolation boundaries. RPO/RTO, all MP2-R3B operational gaps and all three
MP2-R3A gaps remain unresolved/open. No operational, application, database,
schema/migration, production, RLS, or MP2-R3C action occurred. The exact next
gate is Project Owner authorization for **MP2-R3C focused IMPLEMENT**.

MP2-R3C — Production Configuration, Secrets and Release-Control Runbooks
focused IMPLEMENT is COMPLETE / READY FOR FORMAL VERIFY. Six operational
documents plus the open-gap register cover environment separation, secret
categories, controlled release, rollback/forward repair, post-release checks,
and the current repository 582–603 migration inventory. RPO/RTO and all
production/infrastructure choices remain unresolved; existing MP2-R3A/B gaps
remain open and gate-classified. No application, migration/schema, database,
deployment, production, RLS, or MP2-R4 action occurred. The exact next gate is
Project Owner authorization for **MP2-R3C formal focused VERIFY**.

MP2-R3C Production Configuration, Secrets and Release-Control Runbooks is
COMPLETE / VERIFIED. Static formal verification confirmed the seven documents,
all current command/route/configuration anchors, the exact 22-file migration
582-603 inventory and hashes, and explicit production gap classification. No
tests or operational actions were performed. RPO/RTO and all MP2-R3A/B/C gaps
remain unresolved/open. No further MP2-R3 implementation slice is explicitly
defined, so MP2-R3 is ready for governance closeout. The exact next gate is
Project Owner authorization for **MP2-R3 governance closeout**; MP2-R4 has not
begun.

MP2-R3 Runbooks and Release Controls is COMPLETE / VERIFIED. MP2-R3A/B/C remain
individually COMPLETE / VERIFIED and their full implementation, failure,
repair and verification history is preserved. All recorded RPO/RTO,
production/infrastructure, operational-tooling, real bootstrap/provisioning,
RLS and TS2352 decisions or gaps remain open/deferred without reclassification.
Master Plan Level 2 remains PARTIAL. The exact next gate is Project Owner
authorization for **MP2-R4 Pre-Production Operational Readiness Verification**;
MP2-R4 has not begun.

MP2-R4 DEFINE / readiness reconciliation is COMPLETE. MP2-R4 remains NOT
STARTED for implementation and verification. RPO/RTO, TS2352 disposition,
representative non-production topology/process/storage, secret
injection/rotation, monitoring acceptance, audit evidence and
invitation/scheduler release posture require Project Owner decisions before R4
can pass. The exact next gate is those decisions followed by separate
authorization for **MP2-R4-1 Decisions and Prerequisite Controls**. Production,
MP2-R5 and RLS remain untouched/unstarted.

MP2-R4-1 Decisions and Prerequisites is COMPLETE. RPO=1 hour and RTO=4 hours
are objectives, not guarantees. The R4 environment, fixtures, bounded audit
evidence, existing-identity invitation limitation, non-production secret and
local observability posture are fixed. Scheduler-principal recovery and
AircraftComponent TS2352 remain separate required repairs. The exact next gate
is Project Owner authorization for **MP2-R4-2A Scheduler Principal Recovery
focused IMPLEMENT**. No repair, rehearsal, production, MP2-R5 or RLS action
occurred.

MP2-R4-2A Scheduler Principal Recovery focused IMPLEMENT is COMPLETE / READY
FOR VERIFY. The mounted HUMAN-only recovery reuses the exact disabled scheduler
principal, restores only its exact capability and audits atomically. Focused
evidence passed 17/17 DB-free and 1/1 guarded exact-`jupiter_test` with rollback
and zero residue. No migration/schema or real SERVICE action occurred; TS2352
remains the separate R4-2B blocker. The exact next gate is Project Owner
authorization for **MP2-R4-2A formal focused VERIFY**. R4-2B has not begun.

MP2-R4-2A formal VERIFY failed on failure to prove exactly one matching
scheduler principal. The bounded fail-closed repair is COMPLETE / READY FOR
FORMAL RE-VERIFY. Multiple disabled matches now refuse before mutation; guarded
evidence passed with duplicate-state counts unchanged, outer rollback and zero
residue. No schema/migration, real SERVICE or production action occurred;
TS2352 remains separate. The exact next gate is Project Owner authorization for
**MP2-R4-2A formal focused RE-VERIFY**. R4-2B has not begun.

MP2-R4-2A Scheduler Principal Recovery is COMPLETE / VERIFIED. Formal
RE-VERIFY confirmed exact-one cardinality before selection/mutation and reused
the passing repair evidence. The original VERIFY failure and bounded repair are
preserved. No fresh test/database/application/schema/migration/SERVICE action
occurred. TS2352 remains pending. The exact next gate is Project Owner
authorization for **MP2-R4-2B AircraftComponent TS2352 bounded repair focused
IMPLEMENT**.

MP2-R4-2B AircraftComponent TS2352 bounded repair focused IMPLEMENT is COMPLETE
/ READY FOR FORMAL VERIFY. Only the compile-time adapter/model-port
update-option contract changed; runtime queries and tenant behavior are
unchanged. Focused tests passed 37/37 and the normal build is clean with TS2352
removed and no other error. No schema/migration/database action occurred. The
exact next gate is Project Owner authorization for **MP2-R4-2B formal focused
VERIFY**. R4-3 has not begun.

MP2-R4-2B AircraftComponent TS2352 Bounded Repair is COMPLETE / VERIFIED.
Focused formal verification confirmed the corrected compile-time boundary and
unchanged tenant/runtime semantics, reusing 37/37 focused tests and the clean
build. The historical TS2352 deferral remains preserved. No fresh test,
database, schema/migration or application action occurred. The exact next gate
is Project Owner authorization for **MP2-R4-3 controlled non-production
Recovery Rehearsal**.

MP2-R4-3 Recovery Rehearsal PREFLIGHT / DEFINE is COMPLETE / READY FOR PROJECT
OWNER EXECUTION AUTHORIZATION. The isolated source/restore identities, five
file roots, backup set, fixtures, safety gates, acceptance checks, RPO/RTO
measurement and cleanup plan are canonical in the dedicated preflight record.
No backup/restore/database/file/fixture/application action occurred. The exact
next gate is target-specific Project Owner authorization for **MP2-R4-3
controlled non-production Recovery Rehearsal execution**. R4-4 has not begun.

Section 5.2 Final Acceptance Tenants reconciliation. The R4-3 preflight record's
"fixture creation pending" wording is stale: the R4-3 cleanup manifest
(`MP2_R4_3_FIXTURE_CLEANUP_MANIFEST.md`) and live `jupiter_test` state prove the
historical recovery fixture (`MP2-R4-3-FIXTURE-20260916T193141Z`) was created and
then consumed/offboarded (tenants suspended, principals/grants disabled/revoked).
That historical set is NOT the Section 5.2 acceptance fixture and remains
untouched. Section 5.2 established a NEW independent disposable acceptance
fixture (`SEC52-FIXTURE-...`, manifest `MP2_SECTION52_FIXTURE_CLEANUP_MANIFEST.md`)
through the canonical bootstrap/platform-authority and tenant-lifecycle
mechanisms: disposable System Owner, bounded lifecycle operator, Tenant A
(`ACTIVE`), Tenant B (`SUSPENDED`), A/B ADMINS, A/B normal staff, and A/B Customer
Portal identities. The scheduler SERVICE was not provisioned for this fixture
because the historical R4-3 `SB_SYNC_SCHEDULER` principal occupies the exact
service code. During fixture creation a pre-existing RLS defect was repaired:
token-based staff-invitation acceptance (`StaffMembershipAdministrationRepository.accept`)
attempted the invitation lookup through FORCE-RLS tables before establishing
`jupiter.tenant_id`; the repair carries the tenant id in the acceptance material
and binds it to the invitation token before any protected mutation, preserving
fail-closed cross-tenant behavior (see `staff-invitation-acceptance-rls.database.test.ts`).
The Section 5.2 fixture is retained for subsequent final acceptance testing.

## Fresh-session handover

Read repository-root `/AGENTS.md`, then `ACTIVE_WORK.md`, then this handover;
reconfirm repository/branch/HEAD, staged and dirty state, and the current
Project Owner instruction. Load `SESSION_BOOT.md` or other canonical governance
only when the task or a discrepancy requires it. If this state conflicts with
`ACTIVE_WORK.md`, live evidence, or current owner authority, stop and report;
never infer implementation authority from this document.
