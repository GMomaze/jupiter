# Jupiter Permanent Defect Register

**Purpose:** Single authoritative record of confirmed application/database defects.
Each entry tracks discovery, root cause, corrective action, regression coverage and
verification. No other authoritative defect register exists in the repository (the
separate `OPEN_OPERATIONAL_GAPS.md` tracks *operational gaps*, not defects).

**State model:** `OPEN` → `INVESTIGATING` → `FIXED` → `VERIFIED` → `CLOSED`.

- `OPEN` — reported, not yet triaged.
- `INVESTIGATING` — root cause being established.
- `FIXED` — minimum correct repair implemented and regression tests added; awaiting
  full verification.
- `VERIFIED` — repair proven by focused/guarded verification.
- `CLOSED` — verified and released.

---

## JUPITER-DEFECT-001 — Staff Management SQLSTATE 42501 (role-assignment read denied)

| Field | Value |
| --- | --- |
| Defect ID | `JUPITER-DEFECT-001` |
| Discovery date | 2026-10-17 |
| Affected release | `faedb3c84936483eaafd207a42e42231148e0e55` |
| Status | `FIXED` — AWAITING DEPLOYMENT VERIFICATION |
| Severity | High |
| Component | `src/modules/auth/staff-tenant.repository.ts` (`listStaff`, `toggleRole`) |

### Symptoms

- `GET /auth/staff` → HTTP 500.
- Correlation ID: `37d3ce7f-276c-4f37-b58d-6d0c9c026640`.
- PostgreSQL SQLSTATE `42501` (`insufficient_privilege`).
- Failing component (server diagnostics): `dist/modules/auth/staff-tenant.repository.js`.
- Call path: `staff.routes → staff-tenant.service → staff-tenant.repository`.

### Confirmed root cause

`listStaff` and `toggleRole` performed direct `SELECT`/`JOIN` on
`tenant_membership_roles` to aggregate role codes. The runtime role `jupiter_app` is
deliberately denied `SELECT` on `tenant_membership_roles` — migration 602 grants only
`INSERT, UPDATE` (`GRANT INSERT,UPDATE ON tenant_memberships,tenant_membership_roles
TO jupiter_app;`), and migration 625 documents "jupiter_app is denied SELECT on it".
PostgreSQL therefore rejects the read with SQLSTATE `42501`.

Evidence: `migrations/602_create_staff_membership_administration.ts` (line 104);
`migrations/625_create_membership_role_resolver_function.ts` (lines 6–9);
`src/config/databasePrivilegeBaseline.ts` (`RESTRICTED_RUNTIME_TABLE_PRIVILEGES`,
`tenant_membership_roles: ['INSERT','UPDATE']`).

The canonical access pattern is a `SECURITY DEFINER` resolver (migration 620/625),
owned by `postgres`, with `EXECUTE` granted to the runtime roles.

### Corrective action

- Added migration `627_resolve_tenant_membership_roles_function.ts` — a narrow,
  additive `SECURITY DEFINER` function `resolve_tenant_membership_roles()` returning
  the active role assignments (`membership_id`, `assignment_id`, `role_id`,
  `role_code`). It derives the tenant from the transaction-local
  `current_setting('jupiter.tenant_id', true)` (set from the validated
  `TenantQueryAuthority` via `set_config`), so it accepts no caller-supplied tenant
  UUID and cannot be used to request another tenant's assignments. `EXECUTE` is
  granted to `jupiter_app` (and `jupiter_test` only when that role exists).
- Migration 627 portability repair: `jupiter_test` is optional — the migration no
  longer fails with `MIGRATION_627_ROLES_MISSING` on operational/commissioning
  installations lacking the test role. `postgres` (owner) and `jupiter_app` remain
  mandatory and fail closed when absent; no test role is created.
- Updated `listStaff` to aggregate `role_code` via a `LEFT JOIN` on the resolver.
- Updated `toggleRole` to resolve the current assignment and the "other active ADMIN"
  check via the resolver, eliminating all direct `SELECT`/`JOIN` on
  `tenant_membership_roles`.

No broad privileges, `BYPASSRLS`, superuser rights or schema access were granted.
FORCE RLS and tenant isolation are preserved (the resolver is keyed by the validated
tenant authority and returns no cross-tenant rows).

### Permanent regression tests

- `src/modules/auth/staff-tenant.repository.test.ts` — asserts `listStaff` and
  `toggleRole` read role assignments only through `resolve_tenant_membership_roles`
  and never via direct `FROM/JOIN tenant_membership_roles`.
- Existing `src/modules/auth/staff-tenant-two-tenant.database.test.ts` and
  `staff-last-admin-protection.database.test.ts` (guarded) continue to prove
  authorised access and tenant isolation.

### Verification results

- Focused unit tests: `staff-tenant.repository.test.ts` 4/4 pass.
- `tsc --noEmit` and `npm run build` pass.
- Guarded database verification against a narrowed-privilege runtime role is pending
  (not run in this environment; the Windows `jupiter_db` still grants `SELECT`).

### Associated commit

Not yet committed (repair pending Project Owner review per task 58).

---

## JUPITER-DEFECT-002 — Staff invitation / role-toggle advisory-lock deadlock

| Field | Value |
| --- | --- |
| Defect ID | `JUPITER-DEFECT-002` |
| Discovery date | 2026-10-17 |
| Affected release | `0c6cbf9f2fb785baa27a5b1cd523ff042f6d302b` |
| Status | `FIXED` — AWAITING DEPLOYMENT VERIFICATION |
| Severity | High |
| Component | `staff-membership-administration.ts` (`lock`), `staff-tenant.repository.ts` (`toggleRole`) |

### Symptoms

"Send Invitation" (and role toggle) hung indefinitely. PostgreSQL: PID 17286 held a
session-level **shared** advisory lock; PID 17288 waited on an **exclusive**
transaction-level advisory lock on the **same** identifier; `pg_blocking_pids(17288)
= {17286}`; blocked > 12 minutes.

### Confirmed root cause

The tenant access lease (`TenantSuspensionAccessCoordinator.acquire`) takes
`pg_advisory_lock_shared` (session-level SHARED) on
`hashtextextended(tenantId, TENANT_LIFECYCLE_LOCK_NAMESPACE)` and holds it until the
HTTP response ends. The invitation/role-toggle path then took
`pg_advisory_xact_lock` (transaction-level **EXCLUSIVE**) on the **same** key. The
exclusive request conflicts with the request's own shared lease, producing a
circular wait (the request waits for its own lease to release).

### Corrective action

Changed both tenant-admin mutations to the **shared work lock**
(`pg_advisory_xact_lock_shared`), which is compatible with the session-level shared
lease. Suspension coordination is preserved: the shared work lock still conflicts
with the exclusive lifecycle lock (`pg_advisory_xact_lock`) used by suspension, so
mutations remain blocked during a suspension. Same-row serialisation is retained by
existing `FOR UPDATE` row locks and the DB-level last-admin trigger.

### Permanent regression tests

- `src/modules/auth/staff-advisory-lock-regression.test.ts` — executable mock-client
  tests asserting `invite` and `toggleRole` use `pg_advisory_xact_lock_shared` and
  never `pg_advisory_xact_lock(`.

### Verification results

- Focused unit tests pass; `tsc --noEmit` and `npm run build` pass.
- Guarded real-PostgreSQL concurrency verification (invitation vs suspension, lock
  release on abort/disconnect) is pending (no disposable database in this
  environment).

### Associated commit

Not yet committed (repair pending Project Owner review per task 63).

---

<!-- Append future defects above, each as a `## JUPITER-DEFECT-NNN` section. -->
