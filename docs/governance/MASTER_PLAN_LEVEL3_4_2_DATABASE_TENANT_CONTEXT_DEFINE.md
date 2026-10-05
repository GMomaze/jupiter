# Master Plan Level 3 — 4.2 Database Tenant Context DEFINE

**Document ID:** JUPITER-L3-4.2-DB-TENANT-CONTEXT-DEFINE

**Revision:** 1.0

**Status:** Canonical DEFINE / INVESTIGATE COMPLETE

**Reviewed:** 2026-09-23

## 1. Objective

Define the database tenant-context mechanism that lets PostgreSQL Row-Level
Security obtain the authoritative active tenant identity, without trusting any
client-supplied tenant ID and without weakening the completed 4.1 ownership
architecture or the existing application-level isolation model. This is DEFINE
only; it does not authorize RLS implementation, migrations, or database
mutation.

## 2. Current architecture evidence

### 2.1 Connection / pool layout (`src/config/database.ts`)

- One Sequelize instance with **no explicit `pool` override** — Sequelize's
  built-in pool is used for all model queries and `sequelize.transaction(...)`.
- Two raw `pg` pools: `pool` (max 20, idle 30s) and `adminPool` (same shape,
  admin credentials). The raw `pool` is used by `PlatformAuthorityRepository`
  and `executeAuthoritativePgPlatformMutation` (platform/shared-master work and
  `SB_SYNC_SCHEDULER`).

Consequence: tenant-owned work and platform mutation work can share the Sequelize
pool, so tenant context must be scoped to a single transaction/connection and
must never be session-persistent.

### 2.2 Authoritative tenant identity (`tenant-query-authority.ts`)

`TenantQueryAuthority` is a branded, frozen object in a module-level `WeakSet`,
issued **only** by `createTenantQueryAuthority(ValidActiveTenantContext)`, which
requires `state='VALID_ACTIVE_TENANT'`, `tenant.status='ACTIVE'`,
`membership.status='ACTIVE'`, and `membership.tenantId === tenant.id`. Its single
payload is `tenantId`. A raw string is not a valid authority
(`assertTenantQueryAuthority` throws `TENANT_AUTHORITY_REQUIRED`).

### 2.3 Active-tenant gate (`active-tenant-context.middleware.ts`, `.service.ts`)

`resolveTenantContext` revalidates the stored session context against the
membership relationship on every request; `requireValidActiveTenantContext`
issues the authority only for `VALID_ACTIVE_TENANT` and denies otherwise.
`revalidateStoredContext` maps `SUSPENDED_TENANT`, `SUSPENDED_MEMBERSHIP`,
`DISABLED_MEMBERSHIP`, `ARCHIVED_TENANT`, `PROVISIONING_TENANT`, and
`STALE_MEMBERSHIP` to fail-closed invalid states. The tenant ID is never read
from a request parameter; it is resolved from the authenticated user's
revalidated membership.

### 2.4 Transaction architecture (`authoritative-platform-mutation.ts`)

- `executeAuthoritativePlatformMutation` runs `sequelize.transaction(callback)`
  (or a supplied transaction) and transactionally revalidates the platform
  capability before work.
- `executeAuthoritativePgPlatformMutation` uses `pool.connect()` → `BEGIN` →
  work → `COMMIT`/`ROLLBACK` → `release()` on a raw client.
- Tenant-owned mutations are wrapped directly in `sequelize.transaction(...)`
  inside services, using `TenantQueryAuthority` and tenant-scoped repositories
  that translate `authority.tenantId` into `WHERE`/`EXISTS` predicates.

### 2.5 Scheduler / SERVICE (`service-bulletin-sync.service.ts`)

`SB_SYNC_SCHEDULER` is resolved fresh per run via `resolveService(...)` and
authorized only for `SERVICE_BULLETIN_SYNC` (SERVICE-allowed per
`shared-operation-policy.ts`). It performs shared-master/platform work and never
obtains a `TenantQueryAuthority`. No mounted tenant scheduler exists.

### 2.6 Absence of any DB-level context today

No `set_config`, `SET LOCAL`, or session-level tenant state exists anywhere in
the application. Tenant isolation is currently enforced entirely by
application-level predicates.

## 3. Proposed mechanism — transaction-local tenant context

Use PostgreSQL **transaction-local custom GUC** via
`set_config('jupiter.tenant_id', $tenantId, true)` (third argument `is_local =
true`), issued on the same connection that runs the tenant-owned transaction.

- The authoritative value is always derived from a valid `TenantQueryAuthority`
  (`authority.tenantId`), never from a request parameter or session value.
- RLS policies read `current_setting('jupiter.tenant_id', true)` (missing-OK)
  and compare it to the row's ownership column.
- `is_local = true` scopes the value to the current transaction and PostgreSQL
  reverts it automatically at `COMMIT` or `ROLLBACK`, so no connection retains
  tenant context after it returns to the pool.

A thin tenant-transaction wrapper (analogous to
`executeAuthoritativePlatformMutation`) opens `sequelize.transaction`, asserts
the authority, runs
`SELECT set_config('jupiter.tenant_id', :tenantId, true)`, then executes the
tenant-owned work inside that transaction. Raw `pg` platform paths never set
tenant context.

## 4. Eight-point reconciliation

### 4.1 PostgreSQL tenant-context mechanism
Mechanism: transaction-local `set_config('jupiter.tenant_id', ..., true)` read by
RLS via `current_setting('jupiter.tenant_id', true)`. Value originates only from
a validated `TenantQueryAuthority`.

### 4.2 Safest mechanism to obtain authoritative tenant identity
Reuse `TenantQueryAuthority.tenantId` (already proven authoritative). Do **not**
read `req.body`, `req.query`, `req.params`, or the raw session
`activeTenantContext.tenantId`; those are inputs, not authority.

### 4.3 Transaction-scoped context
Context is set inside the Sequelize transaction on the transaction's connection
and is transaction-local (`is_local=true`). Integrates with existing
`sequelize.transaction(...)` and `TenantQueryAuthority` by a wrapper that sets
context after `BEGIN` and before tenant-owned queries.

### 4.4 Pooled connection cannot retain Tenant A context
`set_config(..., is_local=true)` is transaction-scoped; PostgreSQL reverts it on
`COMMIT`/`ROLLBACK`, and Sequelize always commits or rolls back before releasing
the connection. A reused connection therefore has no `jupiter.tenant_id`.
Additionally the RLS predicate compares `current_setting` to the row owner, so
even a hypothetical stale value could only grant that stale tenant's rows — not
another tenant's — and the reset removes it entirely.

### 4.5 Tenant B receives clean context
Verification: run a Tenant A transaction (sets A), commit; open a new transaction
(possibly the same pooled connection), assert
`current_setting('jupiter.tenant_id', true)` is `NULL` before establishing B,
then set B and assert B sees only B's rows and none of A's.

### 4.6 Absent-context behaviour
`current_setting('jupiter.tenant_id', true)` returns `NULL` when unset. The RLS
predicate evaluates to `FALSE`, so tenant-owned tables are fail-closed: SELECT
returns zero rows; INSERT/UPDATE/DELETE affect zero rows (or are rejected by the
policy). Tenant-owned rows never become accessible merely because context is
absent, malformed, stale, or invalid.

### 4.7 Suspended-tenant DB behaviour
A suspended tenant cannot produce a `TenantQueryAuthority`
(`createTenantQueryAuthority` requires `status='ACTIVE'`), so no suspended-tenant
context can be established and RLS fails closed. This mirrors, and does not
change, the existing L3-3 suspension enforcement and active-tenant gate. No
`tenants.status` check is added to RLS predicates; suspension remains an
application/authority boundary, and RLS stays defence-in-depth.

### 4.8 Background / SERVICE context
- Tenant-specific background work (none mounted today) must establish a valid
  `TenantQueryAuthority`-derived context per tenant; it must not use a SERVICE
  bypass.
- Shared-master/platform work (e.g., `SB_SYNC_SCHEDULER`, platform lifecycle,
  capability administration) runs with **no** tenant context and touches only
  shared-master/platform tables, which are outside tenant RLS.
- SERVICE principals receive **no** implicit RLS bypass; they never set tenant
  context, so tenant-owned tables remain fail-closed to them.

## 5. Fail-closed semantics

- No context (NULL) → tenant-owned tables invisible/unwritable.
- Malformed/stale/invalid context → same (never issued by the wrapper, and the
  predicate still fails if the value does not match any owned row).
- Shared-master/platform tables are unaffected (no RLS policy), so platform and
  shared-master operations remain distinguishable and functional.

## 6. Design principles (non-goals)

- RLS remains defence-in-depth under the verified application isolation model.
- No persistent session-level tenant state on pooled connections.
- No general platform/System Owner/SERVICE RLS bypass.
- No `tenant_id` added to any table merely to simplify RLS.
- Local initial deployment does not weaken the eventual multi-tenant SaaS design.

## 7. Verification required (future IMPLEMENT)

1. Two-tenant guarded test proving a reused pooled connection carries no tenant
   context after Tenant A commits, and Tenant B sees only B's rows.
2. Fail-closed test for absent/malformed/stale context across SELECT/INSERT/
   UPDATE/DELETE.
3. Suspended-tenant test proving no context is establishable.
4. SERVICE/SB-sync test proving shared-master writes succeed with no tenant
   context and tenant-owned tables remain fail-closed to SERVICE.
5. Platform/shared-master operations unaffected by tenant RLS.

## 8. Next gate

4.2 Database Tenant Context DEFINE is COMPLETE. Implementation is NOT authorized
by this document. The next gate is Project Owner authorization for a separate
IMPLEMENT slice, which must not begin automatically.

