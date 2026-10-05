# MP2-R2 Guarded Platform Operations and Privacy-Safe Observability — DEFINE

**Document ID:** JUPITER-MP2-R2-GUARDED-PLATFORM-OPERATIONS-OBSERVABILITY

**Revision:** 1.18

**Status:** COMPLETE / VERIFIED

**Reviewed:** 2026-09-15

## 1. Purpose and current position

MP2-R2 supplies the minimum operational surface and privacy-safe signals needed
to operate already-verified platform authority. It does not redesign tenant or
platform authority and does not activate production.

Master Plan Level 2 remains PARTIAL. MP2-R1A-1 is COMPLETE / VERIFIED;
migration 603 is the guarded/test ledger head, migration 602 remains unchanged,
the exact 22 active system-locked capabilities remain canonical, and database
last-active-ADMIN enforcement remains deferred. No successor implementation,
real System Owner bootstrap, scheduler SERVICE provisioning, production action,
or RLS work has started.

## 2. Reused verified foundations

- `PlatformAuthorityRepository` issues authentic HUMAN and SERVICE authority,
  revalidates capabilities transactionally, serializes authority mutations, and
  atomically creates principals, grants, revokes, disables, and immutable audit.
- `PLATFORM_AUTHORITY_MANAGE` administration is HUMAN-only; self-grant is denied
  and the last active HUMAN System Owner is protected.
- `PLATFORM_AUDIT_VIEW` exists, but no mounted System Owner audit view exists.
- guarded bootstrap verifies database identity, the repository ledger through
  603, the exact 22-capability set, user identity and confirmation, and one-time
  execution. It is not mounted or exposed as an npm command.
- `provisionSbSyncScheduler` atomically creates exactly one
  `SB_SYNC_SCHEDULER` SERVICE principal with only
  `SERVICE_BULLETIN_SYNC_EXECUTE`, under fresh HUMAN
  `PLATFORM_AUTHORITY_MANAGE`, and writes immutable audit.
- scheduled SB sync resolves SERVICE authority fresh, requires exact service
  configuration and capability, and preserves the durable file boundary.
- mounted HUMAN tenant lifecycle and tenant ADMIN recovery already use exact
  capabilities, authentic authority, transaction-time revalidation,
  coordination, and immutable audit.
- Level-1 isolation, suspension, Customer Portal, shared-master, audit, and
  durable-file boundaries remain verified compatibility requirements.

## 3. Actual operational gaps

### 3.1 System Owner administration surface

There is no mounted operator surface for platform-principal inventory,
capability/grant inventory, platform-global audit viewing, principal creation or
disablement, capability grant/revoke, or guarded scheduler provisioning. The
repository operations exist but are not safely invocable by an authenticated
operator.

MP2-R2 shall add one authenticated, CSRF-protected, HUMAN-only `/platform`
administration module with server-rendered screens and POST commands consistent
with existing Jupiter UI. It shall:

- resolve the signed-in user to repository-issued HUMAN platform authority;
- require `PLATFORM_AUTHORITY_MANAGE` for principal creation/disable,
  capability grant/revoke, and the one-time scheduler command;
- require `PLATFORM_AUDIT_VIEW` for platform authority/audit reads;
- list principals, active/revoked grants, the canonical capability catalogue,
  and privacy-safe platform audit records without exposing credentials;
- invoke existing repository mutations rather than duplicate SQL or authority;
- require explicit reason and server-issued/validated correlation identifiers;
- give generic denials to missing, tenant-only, fabricated, stale, revoked, or
  SERVICE authority; and
- show navigation only to a currently authorized HUMAN; navigation is not
  authority.

Tenant ADMIN and ordinary staff roles never confer platform authority. The
surface provides no tenant-data browsing, global user search, Provider
hierarchy, or general-purpose capability definition.

### 3.2 Bootstrap and scheduler operational tooling

Bootstrap logic needs no redesign. MP2-R2 shall add a deliberately named,
non-automatic package entry point and preflight-only operator output stating
target database, user identity, ledger head and capability-set result before
the existing confirmation-gated command may run. Execution remains separately
authorized; secrets and confirmation values must never be logged.

The scheduler repository operation already exists. Its missing element is the
mounted one-time System Owner command above. Environment ownership, invocation
sequence, rollback response and operational approvals belong in MP2-R3
runbooks. MP2-R2 must not provision the real principal.

## 4. Privacy-safe observability contract

Current evidence consists mainly of immutable domain/platform audit and
unstructured `console` output. Relevant denial and failure paths do not share a
stable privacy-safe event contract.

MP2-R2 shall add a small application-local structured event sink, defaulting to
one JSON object per line and requiring no external vendor. Each event has a
fixed code/schema version, UTC timestamp, `INFO`/`WARN`/`ERROR`/`CRITICAL`
severity, outcome, environment, server-generated correlation ID, safe
route/operation code, and sanitized error code. Optional principal, tenant,
membership or operation correlation must use a keyed one-way digest or
non-reversible event-local alias outside immutable audit. Production structured
events contain no raw database message or stack trace.

Prohibited content includes names, emails, registrations, tenant codes/display
names, session/cookie/CSRF/invitation tokens, passwords, secrets, authorization
headers, request bodies, SQL/bind values, filenames/paths, file contents/hashes,
and foreign-tenant identifiers returned to a requester. Redaction is
deny-by-default: unknown fields are dropped.

Required event families are authentication refusal; invalid/stale tenant
context; suspended-tenant denial; tenant/platform authority refusal; stale or
revoked authority; scheduler startup/run refusal or failure; migration failure;
durable-file recovery/failure; CSRF/security rejection; unexpected database or
application failure; and successful critical platform operations. Immutable
audit remains authoritative for success and logs do not duplicate before/after
payloads.

Add non-disclosing liveness and readiness endpoints. Liveness reports only
process availability. Readiness checks the declared database connection,
supported ledger, session storage and enabled scheduler prerequisites, but its
HTTP response exposes only ready/not-ready; detailed causes go only through the
redacted event sink.

Expected authentication/context denials are `INFO` or `WARN` and rate-limited
by event code, safe route and time window. Repeated cross-boundary or CSRF
denials, revoked-authority use, scheduler failure, file cleanup-required state,
migration refusal and unexpected database errors are `ERROR`. Last-owner
protection, suspected isolation bypass, audit/mutation divergence or sustained
scheduler failure is `CRITICAL`. Critical tenancy/security alerts are initially
owned by the Jupiter System Owner. Alert transport/thresholds belong to MP2-R3.

## 5. Production configuration validation

MP2-R2 code shall fail closed before listening or starting background work when:

- `NODE_ENV` is missing/unsupported or production identity is ambiguous;
- required database host, port, name, runtime user or password is absent;
- production identifies as a test database or uses reset/test flags;
- the database is a superuser, is not the declared target, or required runtime
  access is unavailable;
- session secret, secure-cookie policy, proxy/HTTPS contract, IP allowlist,
  scheduler enablement/service code, interval, run-on-boot value, or trusted
  scheduler roots are malformed;
- remote-test authentication is enabled in production, or a production session
  cookie is not `secure`, `httpOnly` and appropriately `sameSite`;
- required durable/public file roots are missing, unresolved, or unsafe; or
- production has a migration ledger different from the explicitly supported
  application ledger.

Existing test-environment loading, migration refusal controls, superuser
refusal, scheduler authority checks, and path containment are reused.
Validation must not mutate or connect to another target merely to diagnose
configuration. Development defaults may remain local; production file roots and
proxy trust must be explicit configuration rather than inferred repository
paths or unconditional proxy trust.

Hosting, secret-manager selection, actual secrets/rotation, backup targets,
release approvals and deployment choreography belong to MP2-R3 or later.

## 6. Compatibility and future extensibility

MP2-R2 shall not alter tenant ownership predicates, sessions, lifecycle,
invitation/membership/recovery, shared-master authority, file authorization, SB
sync results, Customer Portal, operational screens, or existing audit records.
Operator reads use platform roots only and never join tenant payloads.

No parent/subsidiary or Provider schema is introduced. APIs/events use opaque
tenant references and authority scopes without preventing a future explicit
permission-based relationship model. Tenant isolation remains the default.

## 7. Schema and migration decision

**No schema or migration is required.** Existing principal, capability, grant,
immutable global-audit and file-operation structures cover the defined
authoritative records. Operational events are emitted, not made authority or
persisted in a new application table. A durable monitoring store would require
separate evidence and authorization.

## 8. Focused IMPLEMENT and VERIFY plan

Future IMPLEMENT shall use bounded slices:

1. production configuration validator and structured event sink;
2. read-only System Owner principal/capability/grant/audit views;
3. HUMAN mutation commands using existing repository methods;
4. guarded bootstrap package/preflight wrapper and scheduler command;
5. mounted integration and focused adversarial verification.

DB-free tests cover route inventory, CSRF, exact capability/type mapping,
tenant-role rejection, generic denial, navigation, redaction allowlists,
severity/deduplication, configuration refusal, and absence of raw secrets.
Guarded exact-`jupiter_test` tests cover HUMAN success; SERVICE, tenant ADMIN,
fabricated, stale and revoked denial; grant/revoke/disable concurrency and
last-owner protection; scheduler single-use; audit/mutation rollback;
platform-read confinement; cross-tenant non-disclosure; and zero residue.
File/scheduler failure events and database-target refusal receive focused
adversarial checks. Reuse affected Level-1, lifecycle, MP2-R1A, shared-master,
file and SB-sync regressions; do not run the broad 640+ suite.

## 9. Explicit exclusions

No real bootstrap, real SERVICE provisioning, production mutation/deployment,
tenant hierarchy, tenant-data System Owner browsing, new capability codes,
schema/migration, RLS, last-active-ADMIN enforcement, TS2352 repair, external
monitoring vendor, runbook/release choreography, broad UI redesign, or unrelated
regression work is part of MP2-R2.

## 10. Decisions and risks

No further Project Owner architecture decision is required before bounded
MP2-R2 IMPLEMENT. Principal risks are tenant-data exposure through operator
lists/logs, navigation treated as authority, raw exception/secret logging,
capability escalation, disabling the final System Owner, duplicate scheduler
provisioning, and validation occurring after side effects. The controls above
are mandatory verification boundaries.

## 11. Historical implementation gate (satisfied)

**Project Owner authorization required for MP2-R2 focused IMPLEMENT.**

That gate does not authorize real bootstrap, real SERVICE provisioning,
production action, migration, RLS, TS2352 repair, staging, commit, push,
deployment, reset, restore, or clean.

## 12. Implementation record

MP2-R2 focused IMPLEMENT is COMPLETE / READY FOR FORMAL VERIFY. The mounted
HUMAN System Owner read/mutation surface, one-purpose scheduler provisioning
command, guarded bootstrap preflight/package commands, privacy-safe structured
events, non-disclosing health endpoints, production runtime refusal and explicit
production file-root configuration are implemented. Existing authority
repositories, immutable audit and schema were reused. No real bootstrap,
SERVICE provisioning, database/migration or production action occurred.

The exact next gate is **Project Owner authorization required for MP2-R2 formal
focused VERIFY**. MP2-R3 has not begun.

## 13. Formal verification record

MP2-R2 is COMPLETE / VERIFIED. Lean independent verification passed 57/57
selected DB-free adversarial checks and 1/1 guarded exact-`jupiter_test`
transaction. Rollback assertions confirmed zero platform principal, grant,
audit, or test-user residue. The verified boundary includes HUMAN-only platform
administration, fresh fail-closed authorization, last-System-Owner protection,
single-purpose `SB_SYNC_SCHEDULER` SERVICE authority, migration-603 and exact
22-capability bootstrap preflight, privacy-safe telemetry, bounded health,
production/test crossover refusal, and preserved tenant/lifecycle separation.
The fresh 132/132 implementation suite, guarded implementation check, scoped
diff, and build evidence were reused; the only build finding remains the
established unrelated AircraftComponent TS2352. No production code,
schema/migration, real bootstrap, SERVICE provisioning, production, RLS, or
MP2-R3 action occurred.

That MP2-R3 implementation gate was subsequently satisfied for bounded slice
MP2-R3A. Its first VERIFY found one onboarding-runbook defect, and bounded
repair and formal RE-VERIFY completed; MP2-R3A is COMPLETE / VERIFIED. The
MP2-R3B focused IMPLEMENT and formal VERIFY subsequently completed. MP2-R3C
focused IMPLEMENT and formal VERIFY also completed. MP2-R3 governance closeout
subsequently completed; MP2-R3 is COMPLETE / VERIFIED with all recorded gaps
preserved. MP2-R4 DEFINE / readiness reconciliation subsequently completed;
implementation and verification remain NOT STARTED. The current next gate is
MP2-R4-1 decisions and prerequisites subsequently completed. The current next
MP2-R4-2A Scheduler Principal Recovery focused IMPLEMENT subsequently
completed. Its formal VERIFY found the exact-one principal defect; bounded
fail-closed repair is COMPLETE / READY FOR FORMAL RE-VERIFY. The current next
gate was satisfied by formal RE-VERIFY; MP2-R4-2A is COMPLETE / VERIFIED. The
MP2-R4-2B bounded repair focused IMPLEMENT subsequently completed with a clean
build, and formal focused VERIFY subsequently passed. MP2-R4-2B is COMPLETE /
VERIFIED. MP2-R4-3 preflight/DEFINE subsequently completed. The current next
gate is target-specific Project Owner authorization for **MP2-R4-3 controlled
non-production Recovery Rehearsal execution**.
