# Master Plan Level 3 — 4.1 PostgreSQL RLS Ownership Architecture DEFINE

**Document ID:** JUPITER-L3-4.1-RLS-OWNERSHIP-DEFINE

**Revision:** 1.0

**Status:** Canonical DEFINE / ARCHITECTURE COMPLETE

**Reviewed:** 2026-09-23

## 1. Objective and status

This document is the authoritative tenant-ownership architecture for the
eventual PostgreSQL Row-Level Security (RLS) layer. It records the complete
ownership inventory and the nine-point classification checklist for Master Plan
Level 3, section 4.1.

RLS is **defence-in-depth** underneath the already-verified application-level
isolation model. It does not replace or relax existing application boundaries,
and no ownership semantic is changed here merely to simplify RLS.

This document is DEFINE only. It does not authorize RLS implementation,
migration creation, database mutation, or any schema change.

## 2. Audit-domain architecture

Jupiter distinguishes three audit/logging domains. Only the first is
tenant-scoped.

### 2.1 Tenant operational audit — `audit_log`

Audit evidence concerning tenant-owned operational data belongs to that
tenant's security boundary. `audit_log` SHALL receive PostgreSQL RLS
defence-in-depth whose tenant ownership mirrors the existing canonical MT-4C7A
ownership mappings (`src/modules/audit/audit-tenant.repository.live.ts`). The
eight allowlisted sources are:

1. `aircraft`
2. `customers`
3. `workpacks`
4. `task_cards`
5. `workpack_snags`
6. `aircraft_compliance`
7. `utilisation_events`
8. `customer_aircraft_links`

Unknown, missing, broken, foreign, conflicting, or ambiguous ownership fails
closed (`ELSE FALSE`). No `tenant_id` is added to `audit_log` merely to simplify
RLS; ownership is derived from the referenced row through the eight mappings.

### 2.2 Platform / System Owner audit — `platform_global_audit_log`

Platform administration is not tenant-owned. This includes System Owner/platform
authority operations, platform capability administration, tenant lifecycle
administration, SERVICE-principal administration, and similar platform actions.
`platform_global_audit_log` remains **outside** tenant RLS and is protected only
through System Owner/platform authority.

### 2.3 Operational / system / traffic logging

Application, request, error, health, scheduler, performance, security, and
traffic-style logs are platform operational evidence, not tenant operational
audit records. They are not classified as tenant-owned merely because an event
mentions a tenant. Their access and control belong to platform operational
security and remain outside tenant RLS.

## 3. Authoritative ownership inventory

### 3.1 Direct `tenant_id` ownership (roots)

| Table | Field | Semantics | Immutable |
|---|---|---|---|
| `aircraft` | `tenant_id` | current ownership | until transfer authority |
| `customers` | `tenant_id` | tenant-local record / creation tenant | yes |
| `planning_sessions` | `tenant_id` | immutable creation tenant | yes |
| `workpacks` | `tenant_id` | immutable **historical** attribution | yes |

### 3.2 Custody-root ownership

| Table | Field | Semantics | Immutable |
|---|---|---|---|
| `serialized_components` | `custodian_tenant_id` | current custody | until custody transfer |
| `aircraft_components` (legacy) | `custodian_tenant_id` | durable current custody | yes |

### 3.3 Aircraft-parent derived ownership

Ownership derived through `aircraft_id -> aircraft.tenant_id`.

| Table | Root path | Notes |
|---|---|---|
| `task_cards` | `aircraft_id` (NOT NULL); canonical audit authority resolves via `workpack_tasks -> workpacks` | cross-tenant ambiguity fails closed |
| `utilisation_events` | `aircraft_id` | immutable |
| `aircraft_sb_compliance` | `aircraft_id` | also references shared SB master |
| `aircraft_compliance` | `aircraft_id` | tenant-owned operational compliance state |
| `task_templates` (AIRCRAFT scope only) | `aircraft_id` | see 3.7 |
| `compliance_assignments` (AIRCRAFT scope only) | `aircraft_id` | see 3.7 |
| `workpack_snags` (standalone leg) | `aircraft_id` | see 3.6 |

### 3.4 Workpack-parent derived ownership

Ownership derived through `workpacks.tenant_id` (historical).

| Table | Root path |
|---|---|
| `workpack_tasks` | `workpack_id -> workpacks.tenant_id` |
| `workpack_executions` | `workpack_id -> workpacks.tenant_id` |
| `workpack_measurements` | `execution_id -> workpack_executions -> workpacks` |
| `workpack_signatures` | `execution_id -> workpack_executions -> workpacks` |
| `workpack_sources` | `execution_id -> workpack_executions -> workpacks` |
| `workpack_audit_log` | `workpack_id -> workpacks.tenant_id` |
| `workpack_snag_audit_log` | `snag_id -> workpack_snags` (then workpack or aircraft) |
| `task_cards` | via `workpack_tasks -> workpacks` (canonical audit mapping) |
| `workpack_snags` (linked leg) | `workpack_id -> workpacks.tenant_id` AND `aircraft_id` |

### 3.5 Customer-parent derived ownership

Ownership derived through `customers.tenant_id`.

| Table | Root path |
|---|---|
| `customer_users` | `customer_id -> customers.tenant_id` |

### 3.6 Dual-root ownership (both legs must match, mismatch fails closed)

| Table | Leg A | Leg B |
|---|---|---|
| `customer_aircraft_links` | `customer_id -> customers.tenant_id` | `aircraft_id -> aircraft.tenant_id` |
| `aircraft_component_installations` | `aircraft_id -> aircraft.tenant_id` | `serialized_component_id -> serialized_components.custodian_tenant_id` |
| `workpack_snags` (linked) | `workpack_id -> workpacks.tenant_id` | `aircraft_id -> aircraft.tenant_id` |

For `workpack_snags`, a standalone snag (`workpack_id IS NULL`) derives only
through `aircraft_id -> aircraft.tenant_id`.

### 3.7 Mixed / polymorphic ownership

| Table | Shared-master scope | Tenant-derived scope |
|---|---|---|
| `task_templates` | `GLOBAL`, `MODEL`, `MPI` | `AIRCRAFT` (via `aircraft_id`) |
| `compliance_assignments` | `MODEL` (via `model_id`) | `AIRCRAFT` (via `aircraft_id`) |

`task_templates.scope='MPI'` is dormant but its existing semantics are
shared/global; it is not redesigned as part of RLS.

`compliance_items` is entirely shared-master (a 1:1 projection of AD/SB
sources; no tenant reference).

### 3.8 Serialized/custody derived ownership

| Table | Root path |
|---|---|
| `serialized_component_life_states` | `serialized_component_id -> serialized_components.custodian_tenant_id` |
| `serialized_component_maintenance_events` | `serialized_component_id -> serialized_components.custodian_tenant_id` |

### 3.9 Immutable / audit / event ownership

| Table | Ownership | RLS treatment |
|---|---|---|
| `audit_log` | polymorphic (`table_name`/`row_id`), derived via eight MT-4C7A mappings | tenant RLS (mirror MT-4C7A, fail closed) |
| `aircraft_component_movement_history` | direct `tenant_id` (event-time evidence, never current custody) | tenant RLS via direct `tenant_id` |
| `utilisation_events` | via `aircraft_id` | tenant RLS |
| `workpack_audit_log`, `workpack_snag_audit_log` | via workpack/snag | tenant RLS |
| `platform_global_audit_log` | platform (not tenant) | outside tenant RLS |

### 3.10 Migration ledger ownership

| Table | Root path |
|---|---|
| `migration_batches` | direct `tenant_id` (immutable) |
| `migration_batch_rows` | `batch_id -> migration_batches.tenant_id` |
| `migration_created_targets` | `batch_id` / `batch_row_id -> migration_batches.tenant_id` |

## 4. Shared-master / platform tables (outside tenant RLS)

Shared reference / master (curated, cross-tenant):

`manufacturers`, `manufacturer_source_names`, `component_models`,
`asset_types` (`rf_asset_type`), `aircraft_categories` (`rf_aircraft_category`),
`airworthiness_directives`, `service_bulletins`, `service_bulletin_models`,
`supplemental_inspection_documents`, `cessna_sids`, `model_sids`,
`sid_model_applicability`, `sb_model_applicability_allocations`,
`ad_applicability_allocations`, `ad_relationships`, `ad_service_bulletin_references`,
`maintenance_requirements`, `maintenance_templates`, `maintenance_template_items`,
`component_life_limits`, `component_life_limit_proposals`,
`component_life_limit_publications`, `component_life_limit_governance_history`,
`service_bulletin_sync_runs`, `rf_workpack_status`, `rf_workpack_type`,
`rf_component_categories` (if retained), `compliance_items`.

Platform identity / authority / RBAC:

`users`, `roles` (`rf_role`), `permissions`, `user_roles`, `role_permissions`,
`tenants`, `platform_principals`, `platform_capabilities`,
`platform_capability_grants`, `platform_global_audit_log`.

> **4.5 refinement**: `tenant_memberships`, `tenant_membership_roles`, and
> `tenant_membership_authority_audit` are reclassified as **tenant-protected**
> (see §9), not platform.

## 5. Nine-point checklist reconciliation

1. **Inventory every tenant-owned table** — PASS. Full inventory in §3.
2. **Direct `tenant_id` ownership** — PASS. `aircraft`, `customers`,
   `planning_sessions`, `workpacks`, `migration_batches`,
   `aircraft_component_movement_history`.
3. **Custody-root ownership** — PASS. `serialized_components`,
   `aircraft_components` (`custodian_tenant_id`).
4. **Aircraft-parent ownership** — PASS. `task_cards`, `utilisation_events`,
   `aircraft_sb_compliance`, `aircraft_compliance`, AIRCRAFT-scoped
   `task_templates`/`compliance_assignments`, standalone `workpack_snags`.
5. **Workpack-parent ownership** — PASS. `workpack_tasks`, `workpack_executions`,
   `workpack_measurements`, `workpack_signatures`, `workpack_sources`,
   `workpack_audit_log`, `workpack_snag_audit_log`, linked `workpack_snags`,
   `task_cards` (canonical audit mapping).
6. **Customer-parent ownership** — PASS. `customer_users`,
   `customer_aircraft_links` (customer leg).
7. **Indirect ownership** — PASS. Serialized life-state/maintenance-event chains,
   execution->measurement/signature/source chains, migration ledger chains.
8. **Immutable/audit/event ownership** — PASS. `audit_log` (via eight mappings),
   `workpack_audit_log`, `workpack_snag_audit_log`, `utilisation_events`,
   `aircraft_component_movement_history`; `platform_global_audit_log` is platform.
9. **Shared-master tables outside tenant RLS** — PASS. Full list in §4.

## 6. RLS classification summary

- **Direct single-column predicate**: `aircraft`, `customers`, `planning_sessions`,
  `workpacks`, `serialized_components`, `aircraft_components`,
  `aircraft_component_movement_history`, `migration_batches`.
- **Aircraft-derived EXISTS**: `utilisation_events`, `aircraft_sb_compliance`,
  `aircraft_compliance`, AIRCRAFT-scoped `task_templates`/`compliance_assignments`.
- **Workpack-derived EXISTS**: `workpack_tasks`, `workpack_executions`,
  `workpack_measurements`, `workpack_signatures`, `workpack_sources`,
  `workpack_audit_log`, `workpack_snag_audit_log`.
- **Customer-derived EXISTS**: `customer_users`.
- **Custody-derived EXISTS**: `serialized_component_life_states`,
  `serialized_component_maintenance_events`.
- **Dual-root AND (both legs)**: `customer_aircraft_links`,
  `aircraft_component_installations`, linked `workpack_snags`.
- **Polymorphic branch**: `task_templates`, `compliance_assignments`.
- **Mirrored MT-4C7A mapping (fail closed)**: `audit_log`.
- **Excluded (no tenant RLS)**: all shared-master/platform tables in §4.

## 7. Preserved semantics (non-goals)

- `workpacks.tenant_id` remains the authoritative immutable historical tenant;
  Workpack RLS and child ownership follow that root, not future Aircraft
  ownership after transfer.
- `compliance_items` is not redesigned; it stays shared-master.
- Dormant `task_templates.scope='MPI'` and the dormant compliance-projection
  writers are not redesigned as part of RLS.
- Shared-master data is never reclassified as tenant-owned.
- Platform authority remains distinct from tenant authority.

## 8. Next gate

Section 4.1 RLS DEFINE / ARCHITECTURE is COMPLETE. RLS implementation is NOT
authorized by this document. The next gate is Project Owner authorization for a
separate IMPLEMENT slice, which must not begin automatically.

## 9. 4.5 refinement (2026-09-23)

Discovered during the 4.5 RLS rollout inventory; these classifications are now
canonical and supersede any earlier omission.

### 9.1 Newly classified tenant-owned tables

| Table | Classification | Root |
|---|---|---|
| `staff_invitations` | **Direct `tenant_id`** | `tenant_id -> tenants.id` (migration 602) |
| `aircraft_sid_status` | **Aircraft child** | `aircraft_id -> aircraft.tenant_id` (plus `sid_id` shared-master link) |
| `workpack_compliance` | **Workpack child** | `workpack_id -> workpacks.tenant_id` |
| `workpack_requirements` | **Workpack child** | `workpack_id -> workpacks.tenant_id` |

### 9.2 Membership tables reclassified tenant-protected

`tenant_memberships`, `tenant_membership_roles`, and
`tenant_membership_authority_audit` are **tenant-protected** data and SHALL be
covered by tenant RLS according to their canonical `tenant_id` semantics.
Platform/System Owner administration does not make these tables shared/platform
data and must not create a general runtime RLS bypass. Removed from §4.

### 9.3 Dedicated tenant-data ownership role

A dedicated `NOLOGIN` ownership role `jupiter_tenant_owner` is established
(migration 605) for tenant-protected operational tables subject to RLS. Required
properties (all verified): `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`,
`NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS`, `NOINHERIT`, no memberships, no
grant option to runtime identities, and `jupiter_app`/`jupiter_test` cannot
`SET ROLE` to it. It is narrowly scoped and must not become a general platform,
shared-master, migration, maintenance, or governance authority.
`jupiter_governance_owner` remains unchanged (component-life-limit governance
only).

### 9.4 TaskCard hybrid predicate (defence-in-depth semantics)

`task_cards` RLS uses a **hybrid predicate** (migration 609): a valid Workpack
root for the active tenant AND the TaskCard's `aircraft_id` resolving to an
Aircraft owned by the active tenant:

```text
EXISTS(workpack_tasks -> workpacks.tenant_id = active tenant)
AND
EXISTS(task_cards.aircraft_id -> aircraft.tenant_id = active tenant)
```

Rationale: RLS cannot express the MT-4C7A "ambiguous → unavailable to both"
rule, because a policy subquery on `workpack_tasks` is itself tenant-filtered. A
`BYPASSRLS`/superuser resolver was rejected. The hybrid predicate closes the
actual cross-tenant visibility hole (a corrupted Tenant-A TaskCard linked to a
Tenant-B workpack is still hidden from Tenant B) with no bypass role and no
recursion. This is **deliberately weaker** than the application boundary: at the
RLS layer a corrupted TaskCard remains visible to its own Aircraft tenant,
whereas the application-level MT-4C7A boundary still denies it to both tenants.
The difference is defence-in-depth, not a weakening of the application rule.

### 9.5 Polymorphic audit_log tenant RLS (event-time provenance)

`audit_log` RLS (migration 610) mirrors the canonical MT-4C7A ownership mapping
(`audit-tenant.repository.live.ts`) as a `CASE table_name` predicate. Each of the
eight supported roots resolves the row's tenant only through approved tenant
roots; the `ELSE FALSE` branch fails closed for unknown/unsupported table names,
and the `EXISTS` subqueries fail closed for deleted/unresolvable `row_id`s.

The single deliberate deviation is the `task_cards` branch. MT-4C7A expresses
"conflicting/ambiguous → deny to both" via `NOT EXISTS (foreign workpack)`, but
that subquery on `workpack_tasks` is itself tenant-filtered (nested RLS) and can
never see a foreign workpack, so it is ineffective and cannot be expressed
without a `BYPASSRLS`/`SECURITY DEFINER` resolver. It is replaced with the
aircraft-tenancy consistency check already established for `task_cards` by
migration 609, so the audit_log boundary never exceeds the task_cards boundary
it documents: an ambiguous TaskCard's audit row is visible to its Aircraft
tenant but not to the foreign workpack tenant. This is defence-in-depth, not a
weakening of the application rule (the application-level MT-4C7A boundary still
denies the ambiguous row to both tenants).

`utilisation_events` is immutable (BEFORE UPDATE/DELETE trigger) and is verified
via a rolled-back transaction; `platform_global_audit_log` and platform
operational evidence remain outside tenant RLS (no `*_tenant_rls` policy, no
`relrowsecurity`).

### 9.6 Mixed tables + staff invitations (migration 611)

`task_templates` and `compliance_assignments` are **mixed**: a shared-master scope
alongside a tenant-derived scope. `staff_invitations` is direct `tenant_id`.

- `task_templates`: `AIRCRAFT` scope is tenant-owned via `aircraft_id ->
  aircraft.tenant_id`; `MODEL`/`GLOBAL`/`MPI` are shared-master.
- `compliance_assignments`: `AIRCRAFT` is tenant-owned via `aircraft_id`;
  `MODEL` (via `model_id`) is shared-master.

**USING (read)** — shared rows are visible to all tenants (`TRUE`); `AIRCRAFT`
rows are visible only to the owning tenant (`EXISTS aircraft.tenant_id = ctx`);
unknown scope/type fails closed.

**WITH CHECK (write)** — `AIRCRAFT` rows are writable only by the owning tenant;
shared rows are writable only with **no tenant context** (the platform/System
Owner boundary per 4.2 §4.8: `NULLIF(current_setting('jupiter.tenant_id', true),
'') IS NULL`). This also blocks a tenant from converting an `AIRCRAFT` row to a
shared scope (scope-transition escape). Shared rows are never tenant-mutable via
RLS; their mutation remains governed by application-level platform authority
(`library.service`, `standard-task-import`).

`staff_invitations` uses direct `tenant_id = ctx` (fail-closed with no context).
The `membership_id -> tenant_memberships` FK requires `SELECT ON
tenant_memberships` granted to `jupiter_tenant_owner` (no other new grants).

### 9.7 Membership tables + platform-authorized tenant context (RESOLVED)

`tenant_memberships`, `tenant_membership_roles`, and
`tenant_membership_authority_audit` are now tenant-RLS protected (migration 613),
together with the migration-ledger children `migration_batch_rows` and
`migration_created_targets` (migration 612).

The platform-authority boundary is resolved by a **platform-authorized
transaction-local tenant context**: after platform authority is validated
(existing `executeAuthoritativePlatformMutation`/`…PgPlatformMutation`
revalidation) and the authoritative target tenant UUID is established
(generated internally during provisioning, or resolved from the database under a
platform capability during recovery), the transaction installs
`SELECT set_config('jupiter.tenant_id', :targetTenantId, true)` before the
membership mutations. RLS then confines that transaction to the target tenant —
the same fail-closed `tenant_id = ctx` predicate used by ordinary tenant routes.
This is **not** tenant impersonation and **not** an RLS bypass: the tenant UUID
never originates from untrusted request input, the context is transaction-local
(`is_local=true`, cleared on COMMIT/ROLLBACK), and there is no `BYPASSRLS`,
`SET ROLE`, `SECURITY DEFINER`, or superuser path.

`assertAuthoritativeTargetTenant` (in `authoritative-platform-mutation.ts`)
enforces a syntactically valid UUID before any platform context install. Normal
tenant membership administration (`staff-membership-administration.ts`) installs
`authority.tenantId` from the authentic `TenantQueryAuthority` only.
