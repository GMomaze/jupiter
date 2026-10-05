# MP2-R4 Pre-Production Operational Readiness Verification - DEFINE

**Document ID:** JUPITER-MP2-R4-PREPRODUCTION-READINESS

**Revision:** 1.8

**Status:** MP2-R4 COMPLETE / VERIFIED (closeout 2026-09-22). Supersedes the
Rev 1.7 header: R4-3 recovery rehearsal is COMPLETE / VERIFIED (not "execution
pending"); R4-4 and R4-5 rehearsals are complete. Requirements in this document
are preserved unchanged; completion is recorded in ACTIVE_WORK.md.

**Reviewed:** 2026-09-16

## 1. Authority and boundary

MP2-R1A-1, MP2-R2 and MP2-R3 are COMPLETE / VERIFIED. MP2-R4 is not
implemented, verified or complete. This record defines the smallest sufficient
future non-production readiness boundary. It authorizes no implementation,
test, build, database action, backup, restore, migration, bootstrap, SERVICE
provisioning, production action, RLS or MP2-R5 work.

Master Plan Level 2 remains PARTIAL. PostgreSQL RLS belongs to Master Plan
Level 3 and is not an MP2-R4 or Master Plan Level-2 prerequisite.

## 2. Readiness classification

### A. Already satisfied / reusable verified evidence

- Level-1 tenant isolation and the verified MP2-R2 HUMAN/SERVICE, lifecycle,
  health, privacy-safe observability and production-refusal boundaries.
- MP2-R3A/B/C runbooks, including bootstrap and scheduler provisioning,
  onboarding/offboarding, lockout, backup/restore, incident, environment,
  secrets, release, recovery and post-release procedures.
- Guarded/test migration head 603, exact 22-capability bootstrap preflight and
  the verified 582-603 filename/hash inventory.

This evidence may be reused. MP2-R4 must not rerun every Level-1 or MP2 suite.

### B. Fresh evidence required during MP2-R4

1. A clean build/typecheck gate after the TS2352 disposition below.
2. Production-like configuration validation and fail-closed negative cases in
   an authorized non-production target.
3. One complete controlled backup and restore rehearsal using an approved
   manual or automated toolchain. It must prove archive/hash integrity,
   database/file-set consistency, matching release and ledger, lifecycle and
   suspended-tenant preservation, immutable audit/authority preservation, and
   two-tenant isolation after restore.
4. Onboarding, staff containment, tenant suspension/lockout and reinstatement
   rehearsal with peer-tenant non-impact.
5. Disposable-target System Owner bootstrap rehearsal plus scheduler SERVICE
   provisioning, least-capability, revocation, audit, replay/stale-authority and
   refusal checks. No production principal may be created.
6. Production-like release rehearsal covering preflight, ordered migrations
   582-603 from an approved starting state, application/schema compatibility,
   bounded health/readiness, tenant-isolation smoke checks and a tabletop plus
   executable safe branch of rollback/forward-repair decision handling.
7. Privacy-safe operational-event and bounded-health tests, with locally
   defined thresholds, observation window and a representative alert receiver;
   no production monitoring vendor is required.

### C. Must be decided or implemented before MP2-R4 can pass

- **RPO and RTO:** Project Owner values are mandatory before backup/restore and
  release recovery acceptance can be judged. No values are inferred here.
- Approve a representative non-production topology, process supervisor,
  storage mapping, deployment/recovery toolchain and secret injection/access
  mechanism. Production vendor/topology selection may remain for MP2-R5.
- Define a category-specific secret rotation/emergency replacement procedure
  capable of rehearsal. Production manager integration remains an MP2-R5 gate.
- Define non-production monitoring thresholds, observation window, alert
  receiver and accountable observer.
- Approve safe acceptance fixtures and residue evidence for two tenants,
  lifecycle, files, authority and scheduler checks.
- Choose a bounded membership-authority audit evidence method. The existing
  authoritative audit/database evidence is sufficient only if the Project
  Owner explicitly approves non-mounted access; a mounted view is not otherwise
  mandatory for this release.
- Resolve AircraftComponent TS2352 or explicitly accept it as a named clean-
  build deviation for MP2-R4. Without one of those dispositions MP2-R4 fails.
- If production scheduler activation remains intended, provide a supported
  disabled-principal replacement/recovery path and rehearse it. The current
  absence blocks MP2-R4 PASS for that release path; merely documenting it is
  insufficient.

### D. May remain until MP2-R5 production activation

- Final production hosting/provider topology, production supervisor and
  deployment integration, final secret-manager product/integration, production
  monitoring/alert transport and external incident contacts.
- Production backup schedule/retention and production-integrated orchestration,
  provided the precise manual or representative R4 toolchain passes and the
  production mechanism is fixed before activation.
- Real System Owner bootstrap, real SERVICE provisioning and every production
  mutation; these occur only under separate MP2-R5 authority.
- `NullStaffInvitationDelivery` does not block R4 rehearsal if its limitation
  is explicitly exercised and onboarding uses approved existing identities.
  It blocks MP2-R5 usable SaaS activation unless working delivery or a safe,
  explicitly approved supported alternative exists.
- Scheduler-only shutdown may remain absent only if full graceful application
  shutdown is explicitly accepted and successfully rehearsed as the scheduler
  containment control. Otherwise it must be resolved before MP2-R5.

### E. Later operational maturity

Automation of backup/restore orchestration, residue reporting, incident case
management, retention analytics and continuous recovery validation may mature
after activation only where the approved repeatable manual control already
meets R4/R5 safety. A mounted membership-audit UI may remain later maturity
when the approved bounded evidence path is retained.

## 3. Incident and lockout boundary

MP2-R4 must rehearse classification, evidence preservation, least-scope tenant
or membership containment, platform capability/SERVICE revocation, peer-tenant
continuity, refusal conditions, reinstatement and conservative reopen. A
tabletop is sufficient for external escalation and production-wide shutdown;
supported application controls and the selected non-production process stop
must be exercised. No production incident tooling vendor is required.

## 4. Smallest bounded future verification slices

1. **R4-1 Decisions and prerequisite controls:** record RPO/RTO, TS2352
   disposition, representative topology/secrets/monitoring/evidence choices;
   implement only missing scheduler recovery or other explicitly selected
   prerequisite mechanisms; separately verify any change.
2. **R4-2 Clean/configuration/observability gate:** clean build/typecheck,
   production-like configuration refusal, bounded health/events and local alert
   observation.
3. **R4-3 Recovery rehearsal:** controlled backup plus isolated restore with
   database/files, ledger, lifecycle, audit and two-tenant checks.
4. **R4-4 Authority and operations rehearsal:** disposable bootstrap/SERVICE
   provisioning/recovery, onboarding, lockout, reinstatement and incident
   containment.
5. **R4-5 Release rehearsal and final adversarial gate:** migration/application
   compatibility, release preflight, health, focused Level-1/Level-2 isolation
   regressions, recovery decision path, residue review and R4 evidence closeout.

Each slice requires separate Project Owner authorization. Database work is
limited to exact `jupiter_test` or another explicitly authorized disposable
non-production target. Stop on the first substantive failure; verification
must not repair.

## 5. Exact next gate

Project Owner decisions are required for RPO, RTO, the TS2352 disposition, the
representative R4 topology/process/storage controls, secret injection/rotation,
monitoring acceptance, membership-audit evidence and invitation/scheduler
release posture. After those decisions, separately authorize **MP2-R4-1
Decisions and Prerequisite Controls**. MP2-R4 formal verification and MP2-R5
remain unauthorized.

## 6. MP2-R4-1 Project Owner decision record

The following decisions supersede the unresolved decision set above without
authorizing implementation or rehearsal:

- **RPO: 1 hour. RTO: 4 hours.** These are operational recovery objectives,
  not guarantees. R4 recovery evidence must measure against both.
- For R4, reproducible bounded access to the authoritative
  `tenant_membership_authority_audit` source is accepted without a mounted UI,
  provided authority is not bypassed and no cross-tenant operational data is
  exposed.
- `NullStaffInvitationDelivery` is accepted only for R4 fixtures using approved
  existing test identities. The gap remains open and blocks MP2-R5 unless a
  supported delivery mechanism or explicitly approved supported operational
  alternative exists.
- Production SB synchronization remains intended. Safe recovery of a disabled
  `SB_SYNC_SCHEDULER` principal is therefore an R4 blocker requiring a separate
  implementation and verification slice.
- AircraftComponent TS2352 is not accepted as a permanent deviation. It must
  be repaired and independently verified before the R4 clean-build gate.
- R4 may use a controlled representative non-production environment. Final
  production hosting, secret manager and monitoring transport remain MP2-R5
  decisions.
- R4 secrets must be non-production values injected outside source control.
  R4 observability uses measurable local thresholds, a fixed observation
  window and a representative local receiver.

### Minimum R4 environment and fixture contract

The isolated target must have a uniquely identified non-production database,
separate injected secrets, five disposable absolute file roots, scheduler
disabled by default, controlled process start/graceful `SIGINT`/`SIGTERM`, an
approved manual backup/restore and deployment/recovery toolchain, captured
release/ledger/hash identity, and no route to production credentials or data.

The minimum removable fixture set is: one HUMAN System Owner; Tenant A and
Tenant B; one Company ADMIN per tenant; representative staff and Customer
Portal identities where exercised; one disposable exact `SB_SYNC_SCHEDULER`
SERVICE principal; tenant-owned files for both tenants; shared-master data;
representative active and suspended lifecycle state; and correlated immutable
audit evidence. Creation and cleanup must be transactionally rolled back or
performed only by an approved disposable-target reset procedure, with residue
checked before acceptance.

## 7. Defined prerequisite repair slices

### MP2-R4-2A - Scheduler Principal Recovery

**Defect:** provisioning permanently refuses once the unique exact scheduler
principal exists, while disabling it leaves no guarded re-enable or replacement
path.

**Smallest implementation boundary:** add one HUMAN-System-Owner-only,
transactional recovery operation for the exact `SB_SYNC_SCHEDULER` principal.
It must take the existing platform-authority advisory lock, revalidate fresh
`PLATFORM_AUTHORITY_MANAGE`, require an existing DISABLED SERVICE principal,
restore only the exact `SERVICE_BULLETIN_SYNC_EXECUTE` boundary, create no
second scheduler identity, and write immutable before/after and grant audit.
Mounted invocation must remain under `/platform` with a mandatory reason and
generic refusal behavior.

**Affected components:**
`src/modules/platform-authority/platform-authority.repository.ts`,
`platform-administration.routes.ts`, their focused tests, and only if needed
the existing platform administration view and scheduler provisioning runbook.
No schema/migration change is expected.

**Focused verification:** stale/fabricated/SERVICE/tenant authority refusal;
ACTIVE, absent and wrong-service target refusal; exact disabled-principal
recovery; no extra capability or principal; revoked-grant handling; immutable
audit; concurrency/idempotency refusal; scheduler resolution after recovery;
transaction rollback and zero guarded-test residue.

**Exclusions:** arbitrary SERVICE creation/re-enable, new capabilities,
scheduler execution redesign, production provisioning, schema/migration,
secret, topology or supervisor work.

### MP2-R4-2B - AircraftComponent TS2352 Repair

**Defect:** the Sequelize `AircraftComponent` model adapter in
`src/modules/aircraft/aircraft-component-tenant.repository.live.ts` does not
type-safely satisfy `AircraftComponentModelPort`; the established unsafe result
conversion produces the clean-build TS2352 finding.

**Smallest implementation boundary:** align the adapter/model-port result and
attribute types at the live adapter boundary without changing queries,
includes, tenant predicates, return semantics or runtime model behavior.

**Affected components:**
`aircraft-component-tenant.repository.live.ts`, the port declarations in
`aircraft-component-tenant.repository.ts`, and
`src/models/core/AircraftComponent.ts` only if accurate model attribute typing
requires it; add or adjust only focused adapter/type tests.

**Focused verification:** focused aircraft-component tenant repository tests,
compile-time adapter compatibility, tenant-root predicates and mutation-result
semantics, followed by one clean build/typecheck proving TS2352 is absent and
introducing no new error.

**Exclusions:** SQL/query behavior, schema/migrations, tenancy design, model
associations, component lifecycle functionality, broad refactoring or any
suppression/double-cast used merely to hide the error.

## 8. Remaining sequence

1. **MP2-R4-2A** focused IMPLEMENT, then separate focused VERIFY.
2. **MP2-R4-2B** focused IMPLEMENT, then separate focused VERIFY and clean
   build/typecheck. The two repair slices are otherwise independent.
3. **MP2-R4-3 Recovery Rehearsal:** controlled backup and isolated restore with
   RPO/RTO measurement, file/database integrity, lifecycle, audit and
   two-tenant isolation.
4. **MP2-R4-4 Authority and Operations Rehearsal:** disposable bootstrap,
   scheduler provision/recovery/revocation, onboarding, lockout/reinstatement
   and incident containment.
5. **MP2-R4-5 Release and Final Readiness Gate:** configuration refusal,
   migration/application rehearsal, health, local observability, focused final
   adversarial regression, recovery decision path and residue closeout.

The exact next gate is Project Owner authorization for **MP2-R4-2A Scheduler
Principal Recovery focused IMPLEMENT**. MP2-R4 rehearsal, formal VERIFY and
MP2-R5 remain unauthorized.

## 9. MP2-R4-2A implementation record

MP2-R4-2A Scheduler Principal Recovery focused IMPLEMENT is COMPLETE / READY
FOR VERIFY. The guarded mounted operation reuses only the existing disabled
`SB_SYNC_SCHEDULER` principal, requires fresh repository-issued HUMAN
`PLATFORM_AUTHORITY_MANAGE`, holds the existing authority advisory/row locks,
restores only `SERVICE_BULLETIN_SYNC_EXECUTE` when required, refuses healthy or
inconsistent state, and records recovery/grant audit atomically. No schema or
migration changed and no real SERVICE principal was recovered or provisioned.
Focused evidence is 17/17 DB-free PASS and 1/1 guarded exact-`jupiter_test`
PASS with outer rollback and zero residue. Build reports no R4-2A error and
retains only the separately pending AircraftComponent TS2352. The exact next
gate is Project Owner authorization for **MP2-R4-2A formal focused VERIFY**.
R4-2B has not begun.

## 10. MP2-R4-2A failed VERIFY and bounded repair

Formal VERIFY failed because recovery selected `rows[0]` without proving that
exactly one canonical scheduler principal matched; the partial active-principal
unique index permits multiple disabled matches. The bounded fail-closed repair
now requires query cardinality exactly one: zero retains
`SB_SYNC_SCHEDULER_REQUIRED`, multiple returns
`SB_SYNC_SCHEDULER_STATE_INVALID`, and one continues through the unchanged
validation/recovery path. Guarded exact-`jupiter_test` evidence constructed two
disabled matching principals, proved no principal/grant/audit change on
refusal, then rolled the complete fixture back with zero residue. Focused
evidence is 17/17 DB-free PASS and 1/1 guarded PASS. Build adds no repair error
and retains only the separate TS2352. The repair is COMPLETE / READY FOR FORMAL
RE-VERIFY; R4-2A is not yet COMPLETE / VERIFIED. The exact next gate is Project
Owner authorization for **MP2-R4-2A formal focused RE-VERIFY**.

## 11. MP2-R4-2A formal RE-VERIFY

MP2-R4-2A Scheduler Principal Recovery is COMPLETE / VERIFIED. Ultra-lean
formal RE-VERIFY statically confirmed that the locked complete match set is
cardinality-checked before any row selection or principal/grant/audit mutation:
zero preserves `SB_SYNC_SCHEDULER_REQUIRED`, exactly one continues through the
existing guarded path, and multiple returns
`SB_SYNC_SCHEDULER_STATE_INVALID`. Fresh repair evidence was reused: 17/17
DB-free PASS, 1/1 guarded exact-`jupiter_test` PASS with duplicate-disabled
state, unchanged mutation counts, rollback and zero residue, and no repair
build error. The original VERIFY failure and bounded repair remain historical
evidence. The exact next gate is Project Owner authorization for **MP2-R4-2B
AircraftComponent TS2352 bounded repair focused IMPLEMENT**.

## 12. MP2-R4-2B implementation record

MP2-R4-2B AircraftComponent TS2352 bounded repair focused IMPLEMENT is
COMPLETE / READY FOR FORMAL VERIFY. The pre-existing compiler finding at
`aircraft-component-tenant.repository.live.ts` arose because the model port
typed update options as an unconstrained readonly record while Sequelize
`UpdateOptions` requires `where`. The port now requires Sequelize's `where`
shape plus the existing transaction, and the live adapter passes that typed
object directly without a blind/double assertion. Runtime queries, predicates,
returns, tenant/custody/installation behavior, schema and migrations are
unchanged. Focused tests passed 37/37 and the normal `npm run build`/TypeScript
gate is clean with TS2352 removed and no other errors. The historical deferral
is preserved. The exact next gate is Project Owner authorization for
**MP2-R4-2B formal focused VERIFY**. R4-3 has not begun.

## 13. MP2-R4-2B formal VERIFY

MP2-R4-2B AircraftComponent TS2352 Bounded Repair is COMPLETE / VERIFIED.
Independent static inspection confirmed that the model-port requires
Sequelize's valid `where` shape and the existing required transaction, and the
live adapter passes that contract directly without an options double assertion
or broad escape. Both versioned update callers retain their exact aircraft or
custody tenant predicates, version predicate, transaction and return semantics.
Fresh 37/37 focused test and clean `npm run build` evidence was reused; TS2352
is absent and no other build/type error exists. The historical pre-R4 deferral
and bounded-repair record remain preserved. The exact next gate is Project
Owner authorization for **MP2-R4-3 controlled non-production Recovery
Rehearsal**.

## 14. MP2-R4-3 recovery preflight

MP2-R4-3 Recovery Rehearsal PREFLIGHT / DEFINE is COMPLETE / READY FOR PROJECT
OWNER EXECUTION AUTHORIZATION in
[`MP2_R4_3_RECOVERY_REHEARSAL_PREFLIGHT.md`](MP2_R4_3_RECOVERY_REHEARSAL_PREFLIGHT.md).
No backup, restore, fixture, database/file mutation or application start
occurred. The exact next gate is target-specific Project Owner authorization
for **MP2-R4-3 controlled non-production Recovery Rehearsal execution**.
