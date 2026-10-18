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
  granted to `jupiter_app`/`jupiter_test` only.
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

<!-- Append future defects above, each as a `## JUPITER-DEFECT-NNN` section. -->
