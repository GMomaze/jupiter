# L2-2 — Fail-Closed Authority Boundary DEFINE

**Document ID:** JUPITER-L2-2-FAIL-CLOSED-AUTHORITY-DEFINE
**Revision:** 1.0
**Status:** DEFINE COMPLETE / READY FOR IMPLEMENT
**Reviewed:** 2026-09-12

## 1. Boundary

This DEFINE follows mounted composition, shared mutation routes, controllers,
services/importers, direct model/SQL writers, upload middleware, and the SB cron.
L2-1 and Level 1 remain complete. No real System Owner exists. Tenant-owned
operations, shared-read redesign, tenant lifecycle, provider hierarchy, and RLS
are excluded.

## 2. Mounted/runtime mutation inventory

| Surface | Entry and current authority | Writer/effects | Audit |
|---|---|---|---|
| Generic reference | Authenticated `POST /reference/:tableName/gap-create` and `DELETE /reference/:tableName/:id`; CASL from passport `user_roles`, global `ADMIN` manage-all | `BaseReferenceService` interpolates client table names into INSERT/UPDATE SQL; declared allowlist is unused | None |
| Asset types | `POST /library/asset-types`; legacy `LIBRARY_EDIT`/`ADMIN` | `LibraryService` → shared `rf_asset_type` | None |
| Manufacturers/files | `POST /library/manufacturers`, `POST /library/manufacturers/:id/update`; legacy `LIBRARY_EDIT`/`ADMIN`; upload before CSRF | Library service; `uploads/manufacturers`; failure/replacement residue risk | None |
| Models/requirements | model create/update/import; requirement create/update/delete; legacy `LIBRARY_EDIT`/`ADMIN` | Library service/importer → component models, source names, associations, maintenance requirements | No immutable global audit |
| AD catalogue/applicability | create/import, refresh, accept/ignore/restore, model/Manufacturer linking and assignment; legacy global Library/specialist permissions with `ADMIN` bypass | Controllers/services/importers → AD, relationship, allocation, applicability and compliance-catalogue records | Fragmented/non-platform |
| SB catalogue/applicability | Library create/import/recheck/expand/link/ignore/incomplete-model/model-attach; legacy `LIBRARY_EDIT`/`ADMIN` | Library controllers/importers → SB/model/allocation records and sometimes models | No uniform immutable audit |
| SID catalogue | create, model CSV import and assignment; legacy `LIBRARY_EDIT`/`ADMIN` | Library service → SID/model applicability | None |
| Tasks/templates | task import map/preview/commit and model assignment; legacy `LIBRARY_EDIT`/`ADMIN` | Import controller/Library service → task templates and assignments | None |
| Life-limit governance | propose/replace/withdraw, approve/reject, activate; global specialist permissions and `ADMIN` bypass | Domain service writes proposals, publications, limits and history; service permission lookup uses `user_roles` | Domain history, not platform audit |
| SB create | Authenticated-only `POST /service-bulletins` | `ServiceBulletinService.create` directly creates/updates SB and model link | None |
| Manual SB sync/files | Authenticated-only `POST /sb/sync`; upload before CSRF | `syncAll('MANUAL')`, sync runs, SB upserts/links, files in `uploads/service-bulletin-imports`, submitted paths | Sync status only |
| Scheduled SB sync | `server.ts` environment/timer invokes `syncAll('CRON')` without a principal | Same global writers | Sync status only |
| Direct writers | Public Library/SB/import methods, compatibility controllers, `compliance-projection.service`, and `maintenance-trigger.service` | Direct Sequelize/pool writes bypass mounted authority | Inconsistent/none |

Tenant-owned `/library/serialized-components/*` and serialized migration tooling
retain `TenantQueryAuthority`; they must not receive platform gates. Aircraft
compliance mutations remain tenant-owned although they consume shared masters.
Import previews that create/read files are effects and require import authority.

## 3. Proven weaknesses

Legacy global roles can let a tenant user change cross-tenant masters. SB create
and sync are authentication-only. Generic reference identifiers are client-
selected and the policy allowlist is unenforced. Services take data/IDs rather
than authentic platform authority, so direct callers and cron bypass routes.
Several multipart paths create files before authority/CSRF. Mutations lack one
atomic immutable actor/capability/reason/source/before-after audit contract.

## 4. Shared-read compatibility

Authenticated shared reads, selectors, Manufacturer/model detail, tenant
calculations consuming masters, and reference-checked Manufacturer-logo delivery
remain unchanged and require no platform authority. Hidden controls are UX only;
server authorization remains authoritative.

## 5. Granular capabilities

Seed system-locked capabilities without a wildcard:

- `REFERENCE_DATA_CREATE`, `REFERENCE_DATA_UPDATE`, `REFERENCE_DATA_DEACTIVATE`;
- `RBAC_DEFINITION_MANAGE` (HUMAN System Owner only);
- `MANUFACTURER_MASTER_MANAGE`, `MANUFACTURER_FILE_REPLACE`;
- `COMPONENT_MODEL_MASTER_MANAGE`, `MAINTENANCE_MASTER_MANAGE`;
- `REGULATORY_MASTER_MANAGE`, `REGULATORY_RELATIONSHIP_MANAGE`;
- `SHARED_MASTER_IMPORT`, `SERVICE_BULLETIN_SYNC_EXECUTE`;
- `LIFE_LIMIT_PROPOSE`, `LIFE_LIMIT_APPROVE`, `LIFE_LIMIT_ACTIVATE`.

Fixed ordinary references map by operation. RBAC definitions never use ordinary
reference authority. Bulk commits additionally require import; logo replacement
requires Manufacturer and file authority; regulatory links use relationship
authority; manual/cron sync uses sync authority; life-limit separation remains.

## 6. Exact fail-closed chain

Human order: authenticate → resolve repository-issued HUMAN platform authority
→ operation-policy capability → CSRF → validate/quarantine → controller →
authority-required service → repository transaction → capability revalidation
→ locked read → mutation plus platform audit → commit → file promotion/cleanup.
Missing, fabricated, malformed, inactive, wrong-type, revoked, or stale authority
returns neutral 403 without database/file effects. Unknown operations deny.
Tenant context, roles, session/body claims, and caller-built objects are never
platform authority.

## 7. Repository/service enforcement

Create an explicit operation registry mapping fixed operations and allowlisted
reference tables to capabilities. Eliminate dynamic unvalidated table SQL.
Every public shared writer requires `PlatformAuthority` plus reason,
correlation, and source. Controllers/importers cannot write models directly.
The repository revalidates in the mutation transaction and atomically appends
platform audit. Reads stay authority-free.

## 8. Human/service rules

Interactive work requires HUMAN principals. SERVICE principals are limited to
registered background/import adapters and explicitly granted capabilities.
They cannot use human sessions, manage authority/RBAC, replace Manufacturer
files, or perform life-limit decisions without later explicit authorization.

## 9. Background jobs

Cron resolves an exact configured active SERVICE principal and revalidates
`SERVICE_BULLETIN_SYNC_EXECUTE` per run/write transaction. Missing configuration,
principal, grant, overlap, revocation, or stale authority causes zero writes.
Environment flags are scheduling configuration, not authority. Manual runs use
a HUMAN principal and the same writer/audit contract.

## 10. Audit

Each successful mutation records principal identity/type/code, exact capability,
operation, resource IDs, correlation/import/sync-run ID, reason, provenance,
before/after, outcome, and timestamp in immutable platform-global audit. Bulk
work has a parent correlation and deterministic IDs/counts. Domain histories
remain evidence but do not replace platform audit; tenant audit stays separate.

## 11. Upload/filesystem safety

Authority and CSRF precede durable creation. If multipart parsing must receive
first, use bounded quarantine, containment, collision-resistant names, type/size
validation, traversal/symlink rejection, and cleanup on every denial/error/
rollback. Never accept arbitrary server paths. Promote only after DB commit and
define replacement retention/retirement and compensation. Delivery is unchanged.

## 12. Pre-bootstrap behavior

Before the separately authorized real bootstrap, no HUMAN or SERVICE resolves.
Every converted global mutation fails closed with no fallback to `ADMIN`,
`LIBRARY_EDIT`, specialist permissions, `user_roles`, authentication, tenant
authority, environment, or database ordering. Shared reads continue. L2-2 does
not execute bootstrap.

## 13. Expected implementation files

Additive capability migration `599`; platform capability constants, operation
policy, middleware/wiring, repository audit port; relevant Library, Reference,
SB route/controller/service/importer files; SB scheduler/service-principal
adapter; upload lifecycle middleware; focused tests. Exact files are confirmed
per sub-slice; tenant-owned Library paths and shared reads change only if needed
to preserve their boundary.

## 14. Schema/migration

Migration 599 is required only for capability seeds. Existing L2-1 principal,
grant and audit tables suffice. UP refuses inconsistent foundation state and
creates no grants. DOWN refuses capability grant/audit dependencies and never
removes L2-1 evidence. No ownership/provider/RLS schema is required.

## 15. DB-free verification

Prove inventory and middleware-order completeness, operation/table allowlists,
shared-read compatibility, no legacy fallback, authority authenticity and
required service signatures, transactional revalidation/audit, HUMAN/SERVICE
rules, cron denial, CSRF-before-effects, quarantine cleanup, direct-writer
prohibition, and negative fixtures for omitted/unknown paths.

## 16. Guarded `jupiter_test` verification

With isolated rollback fixtures prove identity/ledger, seeds/no grants,
authorized domain mutations, every unauthorized authority state, concurrent
revoke versus mutation, atomic audit, import rollback, service-principal cron,
pre-bootstrap denial, filesystem cleanup, zero residue, and unchanged ledger/
triggers. Do not execute real bootstrap.

## 17. Regressions

Re-run shared reads/selectors, logo delivery, tenant-owned serialized Library
and migration paths, Aircraft compliance/due calculations, Workpack template
consumption, tenant staff/RBAC, Level-1 mounted isolation, auth/session/
organisation, and life-limit separation/history.

## 18. Exclusions

No real bootstrap, tenant lifecycle, provider hierarchy, RLS, shared-read
redesign, tenant ownership for masters, wildcard curator, automatic grants,
production action, later business-policy redesign, or Level-1 change.

## 19. Bounded IMPLEMENT sequence

1. **L2-2A Capability and Operation-Policy Foundation:** migration 599,
   constants, explicit registries, resolver middleware, pre-bootstrap contracts.
2. **L2-2B Mounted Human Mutation Boundary:** ordered platform gates on every
   inventoried shared mutation, preserving reads and tenant-owned routes.
3. **L2-2C Authoritative Writer and Audit Boundary:** authority-required
   services/repositories/importers, no direct bypass, transactional audit.
4. **L2-2D Service Principal and File-Effects Boundary:** SB cron and safe
   upload/import quarantine, promotion, cleanup.
5. **L2-2E Full Guarded Verification:** adversarial route/direct/import/cron/
   concurrency/filesystem and Level-1 regression verification.

Each sub-slice requires separate IMPLEMENT and VERIFY authority; one does not
authorize the next. Later L2-3–L2-7 policy slices cannot weaken this boundary.

## 20. Next gate

Project Owner authorization required for **L2-2A — Capability and
Operation-Policy Foundation IMPLEMENT**. Nothing is implemented or begun.
