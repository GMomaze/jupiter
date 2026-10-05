# Appendix — Tenant Departure Export Implementation

**Document ID:** JUPITER-APPENDIX-TENANT-DEPARTURE-EXPORT

**Origin:** MP2 2E.2 — Data Retention.

**Status:** DEFERRED — NOT CURRENT EXECUTION SCOPE.

## Fixed state

- **Phase 1 Authority & Targeting: COMPLETE / VERIFIED.** Migration 604 seeds the
  granular `TENANT_EXPORT` platform capability (`system_locked=true`,
  `is_active=true`, `domain=TENANT_LIFECYCLE`, HUMAN-only through the existing
  platform-authority policy machinery; zero automatic grants). Ledger head is
  604. Authoritative tenant targeting (`resolveTenantExportTarget`) binds one
  exact `public_id`/`tenantId` identity and revalidates eligibility
  (`ACTIVE`/`SUSPENDED`; `PROVISIONING` denied; `ARCHIVED` reserved).
- **Phase 2 Departure Export Generation: DEFINED / NOT IMPLEMENTED.**
- No Phase 2 implementation is authorized. No generation route, `tenant_exports`
  journal, package generation, filesystem export root, delivery mechanism, or
  download functionality is to be implemented now.
- This appendix may only resume through explicit Project Owner authorization, or
  if a later Granular Execution Plan requirement explicitly requires the
  implemented capability.

## Return point

**RETURN TO MAIN PLAN: MP2 2E.2 — Data Retention.**

## Phase 2 DEFINE (preserved for future implementation)

### A. Authoritative export inventory

Ownership roots: migrations 590 (aircraft/customers/serialized_components/
planning_sessions/workpacks), 595 (aircraft_components custody), 597
(migration_batches), and tenancy foundations 588/598/602.

Tenant-owned (include): `tenants` metadata; `aircraft`, `customers`,
`customer_aircraft_links`, `customer_users`; `workpacks`, `workpack_tasks`,
`task_cards`, `workpack_snags`, `workpack_snag_audit_log`,
`workpack_executions/measurements/signatures/audit_log/sources`;
`aircraft_sb_compliance`, `compliance_items`/`compliance_assignments`;
`aircraft_components`, `aircraft_component_installations`,
`aircraft_component_movement_history`; `serialized_components` and its
life-state/maintenance-event children; tenant-authored
`component_life_limits`/governance; `planning_sessions`; `utilisation_events`;
`tenant_memberships`/`tenant_membership_roles` (incl. revoked history);
`tenant_membership_authority_audit`; tenant-scoped `audit_log` rows;
`staff_invitations` (identity/status only).

Shared-master/reference (exclude as owned; include by stable code/id +
descriptive metadata): manufacturers, component models, asset types,
maintenance requirements/templates, AD/SB/SID catalogues, task templates,
applicability allocations/relationships, `rf_role`/`rf_permission`/
`rf_role_permissions`, workpack status/type.

Platform-global/security (exclude): `platform_principals`,
`platform_capabilities`, `platform_capability_grants`, `platform_global_audit_log`,
`users.password_hash`, `user_roles`, `sessions`, CSRF/session tokens,
`staff_invitations.token_hash`, other tenants' data, `migration_batches`/`rows`/
`created_targets` (internal tooling).

### B. File inventory

| File type | DB reference | Root | Include | Missing/corrupt |
|---|---|---|---|---|
| Aircraft photo | `aircraft.document_url` | `uploads/aircraft/` | ✅ byte-for-byte | fail-closed → FAILED |
| Manufacturer logo | `manufacturers` | `uploads/manufacturers/` | ❌ shared-master | n/a |
| SB source PDF/CSV | `service_bulletins` | `.jupiter-private-uploads/` | ❌ shared-master | n/a |
| Workpack PDF | on-demand `pdf.service.ts` (not stored) | in-memory | ❌ (reproducible) | n/a |

Generated documents are reproducible from exported structured data; no
byte-for-byte export obligation exists for on-demand PDFs.

### C. Package contract

`.tar.gz` archive (no new dependency). Structure: `manifest.json` (package id,
export id, tenant public id, generated-at, record counts, entity/file inventory,
missing-file report), `schema.json` (schema/version + per-entity docs),
`data/<entity>.ndjson`, `files/<name>` (byte-for-byte, deterministic safe names),
`sha256sums.txt`, `README.md`. Path-traversal/duplicate-name prevention via
basename + containment (reuse `durable-file-operation` `contained()`);
duplicate collision → fail-closed.

### D. Consistency model

- SUSPENDED tenant (primary): no writers; one `REPEATABLE READ` read transaction,
  then file copy.
- ACTIVE tenant: read in one `REPEATABLE READ` transaction while holding the
  shared tenant advisory lock (`acquireTenantWorkLock`) for the DB-read phase,
  release before file copy; verify each file against its DB reference and
  fail-closed on mismatch.
- PostgreSQL transaction rollback does not control filesystem; the journal
  reconciles the two.

### E. Journal design — `tenant_exports`

`id uuid PK`, `tenant_id uuid NOT NULL REFERENCES tenants(id)`,
`public_id uuid`, `status varchar(16)` (PENDING/GENERATING/COMPLETE/FAILED/
EXPIRED/CLEANED), `package_path text`, `manifest_sha256 char(64)`,
`record_counts jsonb`, `missing_files jsonb`, `created_by_principal_id uuid`,
`created_at`, `updated_at`, `expires_at`, `error_code text`. Constraints: status
check; manifest/path required when COMPLETE; tenant+created index; status index.

### F. Mounted authority chain (future)

`POST /platform/tenants/:publicId/export` → `requireAuth` + platform
`resolveHuman` + `TENANT_EXPORT` revalidation (HUMAN-only) →
`resolveTenantExportTarget` → generation service/repository (platform-authority
path, never a tenant route; never calls `requireValidActiveTenantContext` or
ordinary tenant repositories for SUSPENDED data).

### G. Audit contract

Immutable `platform_global_audit_log` (capability `TENANT_EXPORT`):
`TENANT_EXPORT_REQUESTED`, `TENANT_EXPORT_GENERATION_STARTED`,
`TENANT_EXPORT_GENERATION_SUCCEEDED`, `TENANT_EXPORT_GENERATION_FAILED`.
Metadata only (resource id, correlation id, package id, manifest hash, counts);
no contents/sensitive values. Download audit deferred to secure-delivery phase.

### H. Failure / recovery contract

Generation failure, partial collection, missing/corrupt file, traversal/symlink,
duplicate name, hash/manifest mismatch, authorization revocation → FAILED +
cleanup + audit. Interrupted generation → `recover()` reconciles (COMPLETE if
verified, else clean → FAILED/CLEANED). Never present a partial package as
complete.

### I. Minimum implementation slices (future)

1. P2-1 Inventory + read contract. 2. P2-2 Journal migration + repository.
3. P2-3 Package assembly. 4. P2-4 Mounted generation endpoint + audit.
5. P2-5 Adversarial verification.

### Project Owner decisions recorded (for future implementation)

1. `.tar.gz` archive (portable, no new dependency). 2. Workpack PDFs reproducible
(data only). 3. `migration_batches` excluded. 4. `staff_invitations` without
`token_hash`.

