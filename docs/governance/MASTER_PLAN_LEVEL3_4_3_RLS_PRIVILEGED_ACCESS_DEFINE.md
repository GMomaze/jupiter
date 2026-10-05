# Master Plan Level 3 — 4.3 RLS Privileged / Bypass Access DEFINE

**Document ID:** JUPITER-L3-4.3-RLS-PRIVILEGED-ACCESS-DEFINE

**Revision:** 1.0

**Status:** Canonical DEFINE / INVESTIGATE COMPLETE

**Reviewed:** 2026-09-23

## 1. Objective

Define the privileged/bypass access model for PostgreSQL RLS so that RLS stays a
meaningful defence-in-depth boundary. Migration, maintenance, System Owner, and
SERVICE access are separated from the normal runtime role; no universal bypass is
introduced; and legitimate privileged access is audited. This is DEFINE only.

## 2. Actual database identities and privileges (evidence)

### 2.1 Runtime roles

- `jupiter_app` (production `jupiter_db`), `jupiter_test` (guarded test),
  `jupiter_r4_app` (disposable restore), `jupiter_2h4_app` (disposable rehearsal).
- `src/server.ts:30-41` rejects a superuser at startup
  (`SELECT usesuper FROM pg_user WHERE usename = current_user` → `process.exit`).
- `MP2_R4_3_DEDICATED_RESTORE_RUNTIME_ROLE_DEFINE.md:43-59` records the exact
  runtime ACL: `SELECT, INSERT, UPDATE, DELETE` on 78 ordinary tables; restricted
  on history tables (`aircraft_component_movement_history`: SELECT/INSERT only),
  `tenants` (SELECT/INSERT/UPDATE, no DELETE), `vw_component_status` (SELECT),
  and no transition-gate access.
- `MP2_R4_3...:86-88` requires the runtime role to be **non-superuser, `LOGIN`,
  `NO CREATEDB`, `NO CREATEROLE`, `NO REPLICATION`, `NO BYPASSRLS`, `NOINHERIT`**.

### 2.2 Table ownership — the key RLS fact

Schema dumps show **every table is `OWNER TO jupiter_app`**
(`ALTER TABLE public.<t> OWNER TO jupiter_app`). In PostgreSQL the table owner
is **exempt from RLS by default**. Therefore RLS would be ineffective for the
runtime role unless ownership is separated or `FORCE ROW LEVEL SECURITY` is
applied (§3.5).

### 2.3 Migration identity

`sequelize-migration-config.cjs` requires `DB_MIGRATION_USER` to be **exactly
`postgres`** ("immutable migration lineage"). Migrations therefore run as the
`postgres` superuser today.

### 2.4 Admin and ownership roles

- `adminPool` uses `DB_ADMIN_USER` / `DB_ADMIN_PASSWORD` (separate admin
  credentials) for governance-repair and controlled admin work.
- `jupiter_governance_owner` is a `NOLOGIN` ownership role (`NOSUPERUSER`,
  `NOCREATEDB`, `NOCREATEROLE`, `NO BYPASSRLS`, `NOINHERIT`); app/test roles
  cannot `SET ROLE` to it. This is the established pattern for separating
  ownership from runtime identity.
- `postgres` superuser is used only for restore/database-creation, not runtime.

### 2.5 Platform / SERVICE / System Owner identity

Platform and SERVICE authority is derived from authenticated application
identities and persisted `platform_principals` / `platform_capability_grants`,
not from the PostgreSQL login name. `SB_SYNC_SCHEDULER` resolves a SERVICE
principal and performs shared-master work with no tenant context (4.2). System
Owner platform operations touch only platform tables — not tenant-owned rows.

### 2.6 Audit domains (from 4.1)

1. Tenant operational audit — `audit_log`.
2. Platform / System Owner audit — `platform_global_audit_log` (immutable).
3. Operational / system / traffic logging — `emitOperationalEvent`.

## 3. Six-point reconciliation

### 3.1 Migration bypass

Current state: migrations run as `postgres` superuser (enforced by
`sequelize-migration-config.cjs`), which inherently bypasses RLS. Normal runtime
(`jupiter_app`) never inherits this identity.

Proposed: keep a **dedicated migration identity** separate from runtime. A
superuser is **not strictly required**; the minimum is a role able to perform DDL
and own the schema objects (e.g., a `NOLOGIN`/`LOGIN` schema-owner role). The
repository's chosen canonical identity is `postgres`; whatever identity runs
migrations must (a) be distinct from the runtime role, (b) never be used by the
application, and (c) be invoked only through the guarded, separately authorized
migration procedure (`DATABASE_AND_MIGRATION_SAFETY.md`). Runtime must not be a
member of, or able to `SET ROLE` to, the migration identity.

### 3.2 Maintenance bypass

Current state: `adminPool` (`DB_ADMIN_USER`) and `postgres` provide controlled
admin/restore access; no maintenance path runs inside the normal runtime role.

Proposed: legitimate cross-tenant maintenance/recovery (consistency checks,
reconciliation, restore verification) uses the **separate admin/maintenance
role** (`adminPool` / `DB_ADMIN_USER`), never `jupiter_app`. This access is not
an ordinary application path: it is reached only through explicitly authorized,
read-only-preferred operations, and is not mounted as a route.

### 3.3 System Owner database visibility

Current state: System Owner platform authority does **not** grant unrestricted
tenant-data visibility. Verified System Owner operations touch only platform
tables. The one legitimate cross-tenant read today is the **tenant/company
departure export** (`tenant-export-policy.ts`,
`APPENDIX_TENANT_DEPARTURE_EXPORT.md`), which is tenant-specific, HUMAN-only, and
requires its own capability (not `AUDIT_EXPORT`/`PLATFORM_AUDIT_VIEW`; SERVICE
may not authorize it).

Proposed: no general System Owner RLS bypass. Any legitimate cross-tenant read is
a **narrowly authorized operation** against a specific tenant (e.g., a departing
tenant export), implemented with a dedicated, tenant-scoped, capability-gated
path — not a global bypass. System Owner platform operations remain on platform
tables (outside tenant RLS).

### 3.4 SERVICE access

Preserved from 4.2: SERVICE principals receive **no** implicit RLS bypass.
`SB_SYNC_SCHEDULER` operates on shared/platform tables (no RLS policy), so it
needs no bypass. Any future tenant-specific SERVICE operation must establish a
legitimate tenant context from a valid tenant authority; it must not be granted
`BYPASSRLS` or a platform-wide bypass.

### 3.5 Normal application role cannot bypass RLS

Current state: `jupiter_app` **owns** all tables, so it would bypass RLS as table
owner. It is non-superuser and `NO BYPASSRLS`, but ownership alone is sufficient
to evade RLS.

Proposed runtime privilege model (either/both, with FORCE RLS required):

1. **Separate ownership from runtime.** Move tenant-owned table ownership to a
   `NOLOGIN` owner role (extend the `jupiter_governance_owner` pattern), and
   grant `jupiter_app` only the explicit CRUD matrix (§2.1). Then the runtime
   role is a non-owner, non-superuser, `NO BYPASSRLS` role subject to RLS.
2. **`FORCE ROW LEVEL SECURITY` on every tenant-owned table.** This is
   **required** where the runtime role remains owner (owner otherwise bypasses
   RLS), and is recommended as belt-and-suspenders even after ownership
   separation, so the owner role itself cannot evade RLS if ever used at
   runtime.

`FORCE ROW LEVEL SECURITY` applies RLS to the table owner but **not** to
superusers or `BYPASSRLS` roles; that is why migration/maintenance identities
must remain separate from runtime. Shared-master/platform tables (outside tenant
RLS per 4.1) receive no RLS policy and are unaffected.

### 3.6 Audit privileged bypass

- Migration execution is already recorded in the immutable `SequelizeMeta`
  ledger (identity + timestamp) and, for tenant-owned backfills, in
  `migration_batches`/`migration_batch_rows`.
- Platform/System Owner and maintenance mutations are recorded in the immutable
  `platform_global_audit_log` (who, what, why, when, correlation id) via
  `executeAuthoritativePlatformMutation`; SERVICE sync likewise.
- Operational/logging evidence uses `emitOperationalEvent` (observability).

Proposed: legitimate privileged access (migration, maintenance, cross-tenant
read) is recorded in the **platform audit / operational** domain, never mixed
into tenant `audit_log`. The evidence must capture who/what principal, the
controlled operation, the reason, the correlation id and time — without logging
secrets or row payloads. A dedicated operational/privileged-access journal may be
added if the platform audit log alone is insufficient, but it remains platform
evidence, not tenant audit.

## 4. Required runtime privilege model (summary)

- Runtime role (`jupiter_app`/`jupiter_test`): non-superuser, `LOGIN`,
  `NO CREATEDB`, `NO CREATEROLE`, `NO REPLICATION`, `NO BYPASSRLS`, `NOINHERIT`,
  no membership in owner/migration roles, CRUD-only per-table ACL.
- Owner role: `NOLOGIN`, `NO BYPASSRLS`, holds table ownership only.
- Migration identity: separate (currently `postgres`), never runtime.
- Maintenance/admin: separate `DB_ADMIN_USER`, never runtime.
- `FORCE ROW LEVEL SECURITY` on all tenant-owned tables.

## 5. Non-goals

- No universal application or role RLS bypass.
- System Owner authority ≠ unrestricted tenant-data visibility.
- SERVICE authority ≠ RLS bypass.
- Migration/maintenance privilege stays separate from runtime privilege.
- Three audit domains preserved (4.1); transaction-local context preserved (4.2).

## 6. Verification required (future IMPLEMENT)

1. Runtime role cannot read/write another tenant's rows even with valid OWN
   tenant context; owner/`BYPASSRLS` roles absent.
2. `FORCE ROW LEVEL SECURITY` effective where runtime is owner.
3. Migration identity can perform DDL/backfill while runtime cannot.
4. Maintenance/admin role can perform only its authorized operation, audited.
5. SERVICE performs shared-master work with no tenant context; tenant tables
   fail closed.
6. Privileged access produces platform-audit/operational evidence (no secrets).

## 7. Next gate

4.3 RLS Privileged / Bypass Access DEFINE is COMPLETE. Implementation is NOT
authorized by this document. The next gate is Project Owner authorization for a
separate IMPLEMENT slice.


