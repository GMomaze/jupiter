# L2-2D — File and SERVICE-Principal Authority Boundary DEFINE

**Document ID:** JUPITER-L2-2D-FILE-SERVICE-AUTHORITY-DEFINE  
**Revision:** 1.0  
**Status:** DEFINE COMPLETE / READY FOR BOUNDED IMPLEMENT AUTHORIZATION  
**Reviewed:** 2026-09-13

## 1. Evidence and deferred inventory

| Boundary | Runtime evidence | Required disposition |
|---|---|---|
| Manufacturer create/update | Mounted `POST /library/manufacturers` and `POST /library/manufacturers/:id/update`; authentication and the app-level Library gate precede route middleware, but route order is legacy RBAC → durable Multer write → CSRF → handler. `LibraryService.createManufacturer`/`updateManufacturer` accept no platform authority, use no transaction/audit, and arbitrary submitted `logo_url` remains possible. | HUMAN-only authoritative master/file boundary and crash-safe file lifecycle. |
| Manufacturer files | Multer writes directly to `uploads/manufacturers`, accepts any `image/*` declaration, retains the client extension, uses timestamp names, and has no denial/error/close cleanup or replacement retirement. Delivery separately requires a persisted reference and performs basename, containment, regular-file and symlink checks. | Quarantine, content validation, durable operation journal, safe promotion/retirement; preserve `/uploads/manufacturers/:filename`. |
| Manual SB sync | Mounted `POST /sb/sync`; authentication and HUMAN `SERVICE_BULLETIN_SYNC` platform gate precede router. Multer then writes original filenames directly to `uploads/service-bulletin-imports` before CSRF; body fields accept arbitrary server paths. `syncAll('MANUAL')` takes no authority and its writer/audit boundary is absent. | HUMAN authority, quarantined inputs, no request-selected server paths, transactional writer/audit. |
| Scheduled SB sync | `server.ts` calls `startCronJob`; timers call `syncAll('CRON')` with environment scheduling only. In-process `isRunning` does not protect multiple processes. | Dedicated repository-resolved SERVICE identity, live revalidation and database overlap lock. |
| Maintenance trigger | `evaluateComponentTBO` has no repository runtime caller. It creates a globally shared `MaintenanceRequirement` whose title/description contain a tenant component serial number, then attaches it to a tenant workpack. | Treat global creation as an ownership defect, not a SERVICE-authority use case. Disable/remove this shared writer; any future warning must be tenant-owned under a separately defined operational model. |
| Compliance projection | `projectAdSources`, `projectSbSources`, and `projectAdAndSbSources` are unmounted and have no caller outside their own module/tests. They insert global `compliance_items` and accept a caller-supplied transaction without authority. | Close public/direct mutation entry points. Do not provision authority or capability absent a proven runtime requirement. |

The approved L2-2D deferral set is complete; no additional runtime writer was
found. Shared reads and Manufacturer-logo delivery are not mutation surfaces.

## 2. Manufacturer authority and file lifecycle

Operations are fixed: create requires `MANUFACTURER_CREATE`; update requires
`MANUFACTURER_UPDATE`; either operation with a new logo additionally requires
`MANUFACTURER_FILE_REPLACE`. All require repository-issued HUMAN authority.
Tenant/legacy roles never substitute. The service receives validated immutable
evidence and transactionally revalidates every applicable capability before a
locked mutation and immutable platform audit.

Required mounted order is authentication → fixed HUMAN platform gate →
route-specific CSRF token verified without multipart side effects → lifecycle
begin → bounded quarantine upload → tracking/content validation → controller.
The lifecycle must still clean a parsed file if a defensive later authority
check, validation, mutation, audit, response close, or handler failure occurs.

Files use a private sibling quarantine root, UUID server names, allowlisted
extensions, declared MIME plus byte-signature validation, size/count limits,
basename/path containment, `lstat`/`realpath`, regular-file and non-symlink
checks. Client paths and submitted `logo_url` changes are rejected; no-logo
update preserves the persisted URL.

A durable `platform_file_operations` journal is required because database and
filesystem commits are not atomic and request-only cleanup cannot close a
process-crash window. Create a committed PREPARED journal entry before
promotion. The authoritative transaction locks the journal and Manufacturer,
renames the validated quarantine file atomically into the delivery root, writes
the final canonical URL, appends master and file platform audits, and marks the
journal COMMITTED. On rollback, the new promoted file is removed and the prior
file/reference remains. Startup/periodic reconciliation processes only bounded
stale journal rows, never scans or deletes arbitrary files, and safely removes
unreferenced quarantine/promoted artifacts. Old files are retired only after
commit, after confirming no Manufacturer row references them, with the same
containment/symlink protections; cleanup failure remains journaled for retry.

Cases: create/update without a file perform only the master transaction; create
with a file has no durable Manufacturer reference unless promotion and audit
succeed; replacement never deletes the prior file before commit; denied,
invalid, failed, or prematurely closed requests clean the new file and create no
success audit. Collision-resistant names plus locked resource/journal rows make
replacement races deterministic.

Audit actions are `MANUFACTURER_CREATE`, `MANUFACTURER_UPDATE`, and, when
applicable, `MANUFACTURER_FILE_REPLACE`. Before/after values are locked/reloaded
Manufacturer rows plus canonical old/new file references and journal ID; file
bytes and arbitrary paths are never audit payloads.

## 3. Service Bulletin synchronization

Manual contract: repository-issued HUMAN authority → fixed
`SERVICE_BULLETIN_SYNC` policy → `SERVICE_BULLETIN_SYNC_EXECUTE` live
revalidation → database advisory overlap lock → locked deterministic before
state → SB/model-link mutation and immutable audit in one transaction.

Scheduled contract is identical except that it requires SERVICE. Provision one
least-privilege principal with exact service code `SB_SYNC_SCHEDULER`; a HUMAN
System Owner must explicitly create it and grant only
`SERVICE_BULLETIN_SYNC_EXECUTE` through the verified L2-1 repository. L2-2D
does not create or grant it automatically. Each startup and tick resolves it by
exact configured service code through `resolveService`; the returned branded
authority is never cached across runs. Missing configuration/principal/grant,
inactive/revoked/stale authority, wrong type, or database-lock contention causes
zero domain/file/audit writes. Scheduling flags are never identity.

The writer transaction includes sync-run state, deterministic affected SB and
`service_bulletin_models` before/after evidence, and one parent correlation/run
ID shared by per-resource immutable audit. Mutation or audit failure rolls back
all success state. A separately recorded failure status may contain diagnostics
but must not claim mutation success.

Manual CSV/PDF files use the same lifecycle foundation with a separate private
quarantine root and operation-scoped directory. Original names are metadata
only. CSV/PDF extension, MIME and byte/content signatures are validated. The
mounted route rejects `veryon_root_path`, `piper_pdf_path`, and all client-chosen
server paths. Scheduled sources, if enabled, are operator configuration
allowlisted beneath explicit trusted roots and validated with containment and
symlink checks. Inputs are deleted after success or failure; no imported file is
a delivered durable resource. Audit action is `SERVICE_BULLETIN_SYNC` with
principal type/code, trigger, method, source kind, run/correlation ID, and
deterministic affected-record evidence.

## 4. Automated-writer closure

`MaintenanceTriggerService.evaluateComponentTBO` must cease creating shared
`MaintenanceRequirement` rows. Because no caller exists, L2-2D may make the
legacy entry fail closed and remove its direct writer. It must not grant
`MAINTENANCE_MASTER_MANAGE` to a service. A future tenant-owned TBO warning/task
design requires separate Project Owner DEFINE authority and must retain
`TenantQueryAuthority`.

The three Compliance Projection entry points must no longer expose a public
authority-free writer. With no mounted, startup, scheduled, migration, import,
or production caller proven, they are disabled/encapsulated rather than assigned
a HUMAN or SERVICE identity. Re-enabling projection requires a separate DEFINE
that proves its lifecycle, idempotency and actor. Existing shared projection
reads remain unchanged.

## 5. HUMAN/SERVICE separation and auditing

Only the exact SB sync operation accepts both principal types. Manufacturer
master/file work is HUMAN-only. `SB_SYNC_SCHEDULER` cannot manage platform
authority, Manufacturer/reference/model/maintenance masters, imports, RBAC, or
life-limit decisions. HUMAN sessions cannot impersonate the scheduled service;
SERVICE principals have no tenant identity. Repository branding, exact
principal type, active state, exact grant and transactional revalidation are
mandatory. Tenant membership, tenant/global legacy roles, `user_roles`, request
claims, environment variables and authentication alone confer neither form.

All successful global mutations use immutable `platform_global_audit_log` with
principal, capability, fixed operation, resource IDs, reason, correlation/run
ID, provenance and authoritative deterministic before/after state. Operational
file-journal and sync-failure records supplement but never replace success
audit. Tenant audit remains separate.

## 6. Capability and migration gap

Existing capabilities are sufficient:

- `MANUFACTURER_MASTER_MANAGE` for create/update;
- `MANUFACTURER_FILE_REPLACE` for add/replace;
- `SERVICE_BULLETIN_SYNC_EXECUTE` for manual HUMAN and scheduled SERVICE sync.

Existing fixed operations `MANUFACTURER_CREATE`, `MANUFACTURER_UPDATE`,
`MANUFACTURER_FILE_REPLACE`, and `SERVICE_BULLETIN_SYNC` are sufficient. No
wildcard, automatic grant, new capability, or new operation-policy entry is
required. Maintenance and projection deliberately receive none.

Migration 600 **is required**, solely for the minimal durable
`platform_file_operations` journal and its constraints/indexes; it must add no
principal, capability or grant. Populated DOWN must refuse pending/nonterminal
journal state and preserve evidence. Exact journal columns and state transitions
must be fixed in the first implementation sub-slice and independently verified.

## 7. Bounded implementation sequence

1. **L2-2D1 Durable File-Operation Foundation** — migration 600, fixed journal
   repository/state machine, containment/quarantine/promotion/cleanup primitive,
   close/crash reconciliation, no mounted conversion. Tests: traversal,
   symlink, MIME/signature, collision, close/race, state transitions, DOWN and
   zero residue. Next gate: formal D1 VERIFY.
2. **L2-2D2 Manufacturer HUMAN File Boundary** — the two deferred routes,
   controller/service contracts and master/file audits using D1. Preserve logo
   URLs/delivery and no-file semantics. Tests cover every failure/replacement
   case, capability combinations, audit rollback, old-file preservation and
   guarded filesystem/database residue. Next gate: formal D2 VERIFY.
3. **L2-2D3 Manual and Scheduled SB Sync Boundary** — manual quarantine, remove
   request paths, authority-required sync writer, DB overlap lock, HUMAN and
   `SB_SYNC_SCHEDULER` resolution/revalidation/audit. No principal/grant creation
   or real bootstrap. Test manual/scheduled success fixtures, every denial,
   concurrent run, rollback, cleanup and zero residue. Next gate: formal D3
   VERIFY.
4. **L2-2D4 Automated-Writer Closure** — remove/fail-close the dormant
   maintenance shared-master mutation and encapsulate/disable the three
   authority-free projection writers; preserve tenant workflows and projection
   reads. Tests prove no runtime caller/direct bypass and no shared writes. Next
   gate: formal D4 VERIFY.
5. **L2-2E** remains the separately authorized full mounted/direct/cron/file/
   concurrency adversarial verification after every L2-2D sub-slice closes.

Expected files are migration 600; platform file-operation model/repository and
lifecycle middleware/tests; upload middleware; Manufacturer Library routes,
controller/service and tests; SB sync route/service/adapters/server scheduler and
tests; maintenance trigger, compliance projection and inventory tests; model
exports/associations only if migration 600's journal model requires them; and
the two canonical governance files. No shared-read or tenant-owned repository
contract is otherwise changed.

## 8. Verification and safety

DB-free tests must prove fixed inventory, middleware order, authority branding,
HUMAN/SERVICE separation, no legacy fallback, service-resolution refusal,
operation mappings, file validation/containment, close/race cleanup, no arbitrary
paths, old-file retention, dormant-writer closure and unchanged reads.

Guarded exact `jupiter_test` must prove migration 600 UP/DOWN/reapply and
populated-DOWN refusal; journal recovery; manufacturer mutation/file/audit
atomicity; manual and SERVICE sync with concurrent revocation/overlap; audit
immutability; rollback and zero database/filesystem residue; ledger, 17 seeds,
no automatic grants and triggers. Regression covers Level 1, L2-1, L2-2A/B/C,
Aircraft Photo lifecycle, Manufacturer-logo delivery, shared reads, tenant
workpacks/compliance and real pre-bootstrap denial. No real bootstrap or service
principal provisioning occurs in tests outside isolated rollback fixtures.

## 9. Risks and decisions

The unavoidable database/filesystem atomicity gap is why migration 600 is
required. Cleanup must be idempotent and journal-bounded. Multi-process sync
requires a database lock, not `isRunning`. Current client-selected SB paths and
MIME-only Manufacturer validation are unsafe and cannot be retained. The only
future Project Owner decisions are operational provisioning values (exact
SERVICE principal code confirmation/target environment) and any later
tenant-owned TBO warning or re-enabled Compliance Projection design; neither is
part of L2-2D implementation authorization.

## 10. Next gate

Project Owner authorization required for **L2-2D1 — Durable File-Operation
Foundation IMPLEMENT**. No implementation, migration, bootstrap, principal,
grant, route, upload or scheduler change has begun.
