# Level 2 — Shared / Reference-Master Curator Authority DEFINE

**Document ID:** JUPITER-L2-SHARED-MASTER-CURATOR-DEFINE

**Revision:** 1.0

**Status:** DEFINE COMPLETE / awaiting implementation authorization

**Reviewed:** 2026-09-11

## Boundary and evidence

This definition is based on the mounted application composition and current
models, routes, middleware, services, repositories, importers, file middleware,
RBAC mappings, and background Service Bulletin synchronization. No database was
queried or mutated. Level 1 remains complete and unchanged.

Shared/reference-master data has no tenant ownership root and is intentionally
consumed across tenants. Tenant-owned Aircraft, Customers, Workpacks,
PlanningSessions, SerializedComponents, legacy component custody, staff
memberships/assignments, tenant audit projections, and their owned children are
outside this Level-2 definition.

## Current shared inventory

1. Reference and RBAC definitions: `rf_role`, `rf_permission`,
   `rf_role_permissions`, task/workpack states and types, component conditions
   and types, sign-off roles, Aircraft categories, and `rf_asset_type`.
2. Manufacturer/model masters: `manufacturers`, `manufacturer_source_names`,
   `component_models`, and model/asset/manufacturer associations and maintenance
   requirements.
3. Regulatory/technical masters: Airworthiness Directives, Service Bulletins,
   Supplemental Inspection Documents, compliance catalogue records, their
   relationship/applicability/allocation tables, sync-run records, and shared
   Manufacturer logo/document references.
4. Maintenance masters: task templates, maintenance templates/items, and their
   model assignments.
5. Governed component-life masters: life limits, proposals, publications, and
   immutable governance history. This subsystem already has propose/approve/
   activate separation and actor history, but its service-side permission query
   uses global `user_roles`.

## Current mounted authority and paths

- `/library/*` is authenticated. Shared reads range from authentication-only
  Manufacturer/model selectors and detail pages to `LIBRARY_EDIT`-gated lists.
  Shared create/update/import/assignment paths use `LIBRARY_EDIT`; life-limit
  paths use their three specialist permissions. These routes do not hydrate
  active-tenant RBAC and therefore consume passport-loaded global `user_roles`.
  `ADMIN` bypasses every permission middleware check.
- Mounted `/library` writers include asset type, Manufacturer and logo create/
  replace, model create/update/import, maintenance requirement create/update/
  delete, AD/SB/SID create/import, relationship/allocation review and model
  assignment, standard-task import/assignment, and life-limit governance.
- `/service-bulletins` allows every authenticated staff identity to list and
  create shared Service Bulletins. `/sb/sync` allows every authenticated staff
  identity to upload import files and globally upsert Service Bulletins/model
  links. Neither mounted writer has a curator permission.
- `/reference/:tableName` allows authenticated reads and exposes create and
  deactivate handlers using a client-selected table name interpolated into SQL.
  The declared `ReferenceGovernance` allowlist/policy is not enforced. Current
  deserialization supplies role objects while the CASL helper tests for string
  roles, so route behavior is inconsistent and not a trustworthy authority
  boundary. A service update method and edit UI exist, but no matching mounted
  PATCH/edit routes were found.
- Manufacturer files are written under `uploads/manufacturers` and delivered
  to any authenticated user only when referenced by a Manufacturer row. Upload
  occurs before CSRF validation; failure/replacement cleanup and old-file
  retirement are not governed. Service Bulletin import files are written under
  `uploads/service-bulletin-imports`, are not HTTP-delivered, and likewise enter
  the filesystem before CSRF validation.
- When enabled, the server-started Service Bulletin cron calls the same global
  sync service without a human principal. Direct service methods generally take
  data/IDs rather than an authenticated authority object, so alternate callers
  are not fail-closed at the service/repository boundary.

## Global influence and security findings

A tenant-local user who also retains legacy global `ADMIN` or `LIBRARY_EDIT`
can alter globally shared masters and thereby affect other tenants' selectors,
model identity, maintenance requirements, AD/SB/SID applicability, due-status
inputs, task/template choices, compliance projections, and displayed/delivered
Manufacturer content. Authenticated-only Service Bulletin creation/sync is a
direct global mutation path. Several shared POST/import/commit paths lack
route-local CSRF protection. IDs and bulk files can reshape global
relationships. Most writers lack uniform actor, reason, before/after, source,
and correlation evidence. Dynamic reference table selection is not fail-closed.

## Required curator authority model

1. Platform/System Owner is the grant/revoke and emergency-control authority;
   it is not an ordinary tenant administrator and no such mounted principal is
   currently proven. Curator is a narrower global operational authority granted
   explicitly by the Platform/System Owner.
2. Tenant memberships and tenant-local `ADMIN` must never confer global write
   authority. Ordinary tenant staff receive shared read access only where their
   tenant-local role needs it. Shared reads remain ownership-neutral and must
   not disclose protected import files, credentials, audit evidence, or admin
   controls.
3. Use granular global capabilities (view; create/update/deactivate; relationship
   curation; bulk import; file replace; sync execution; life-limit governance),
   least privilege, separation of duties for safety-significant activation, and
   explicit service-issued, non-client-constructible curator authority.
4. Routes must order authentication, platform-authority resolution, capability,
   CSRF, validation/upload staging, service/repository authorization, mutation,
   immutable audit, then commit. Missing, malformed, inactive, revoked, stale,
   fabricated, or tenant-derived authority fails closed with neutral errors.
5. Every global mutation records actor/service principal, capability, reason,
   source, correlation/import batch, affected IDs, before/after, timestamp, and
   outcome. Background sync uses a separately configured service principal and
   the same repository/audit boundary; disabled or absent authority performs no
   writes.
6. File writes use quarantine/staging, content validation, collision-resistant
   names, canonical containment, atomic database/file commit semantics, cleanup
   on all failures, deliberate replacement retention/retirement, and existing
   authenticated reference-checked delivery.

## Schema and migration assessment

Schema/migration work appears necessary. The current system has shared role and
permission definitions plus legacy global `user_roles`, but no proven distinct,
auditable Platform/System Owner or curator grant lifecycle. A Level-2 design
must choose either a dedicated platform-authority assignment/history model or a
formally constrained migration of global `user_roles`; required capability
definitions, service-principal identity, immutable global-mutation audit, and
import/file provenance may also need additive persistence. No schema choice or
migration is authorized by this DEFINE.

## Proposed implementation and verification slices

1. **L2-1 — Platform authority foundation:** inventory live legacy global role
   assignments under separately guarded authority; approve System Owner/curator
   persistence, capability taxonomy, grant lifecycle, and migration/backfill.
2. **L2-2 — Fail-closed authority boundary:** implement platform authority
   resolver/value object and route/service/repository enforcement; remove tenant
   and legacy-global `ADMIN` bypass from shared writes.
3. **L2-3 — Generic reference/RBAC definitions:** replace dynamic table access
   with an explicit registry; enforce per-table operations, system locks, CSRF,
   validation, and immutable audit. Keep RBAC-definition administration reserved
   to System Owner unless separately approved.
4. **L2-4 — Manufacturer/model/maintenance masters:** convert CRUD, assignments,
   imports, source-name normalization, and Manufacturer file lifecycle.
5. **L2-5 — Regulatory masters:** convert AD, SB, SID, applicability,
   relationship, allocation, compliance-catalogue, and bulk-import writers.
6. **L2-6 — Sync/service principals:** authorize manual and scheduled SB sync,
   constrain filesystem/source inputs, and audit deterministic global upserts.
7. **L2-7 — Task/template and life-limit governance:** convert template writers;
   preserve and strengthen life-limit separation of duties under platform
   authority.
8. **L2-8 — Final adversarial verification:** prove tenant administrators cannot
   write global masters; curator reads/writes only approved domains; revocation,
   stale/fabricated authority, direct IDs, imports, service calls, cron, audit,
   rollback, files, and all Level-1 isolation regressions pass before closeout.

## Project Owner decisions

The Project Owner subsequently required independently persisted platform
authority, granular capabilities, System Owner-controlled grants/revocation,
explicit service principals, durable global audit, shared-read compatibility,
no implicit tenant/legacy-role authority, no mandatory ordinary dual control,
and staged non-destructive shared-file handling. The implementation-ready L2-1
definition is recorded in
[`LEVEL2_PLATFORM_AUTHORITY_FOUNDATION_DEFINE.md`](LEVEL2_PLATFORM_AUTHORITY_FOUNDATION_DEFINE.md).

Next gate: Project Owner authorization for **L2-1 Platform Authority Foundation
IMPLEMENT**, including migration 598 and the exact environment-specific bootstrap
scope. No Level-2 implementation is authorized.
