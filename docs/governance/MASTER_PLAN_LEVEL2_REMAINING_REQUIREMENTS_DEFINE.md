# Master Plan Level 2 Remaining Requirements — DEFINE

**Document ID:** JUPITER-MP-L2-REMAINING-DEFINE

**Revision:** 1.21

**Status:** DEFINE COMPLETE; MP2-R2/R3 verified; MP2-R4 readiness DEFINE complete

**Reviewed:** 2026-09-15

MP2-R1A identity/admin-continuity/offboarding is COMPLETE / VERIFIED in
[`MASTER_PLAN_LEVEL2_MP2_R1A_IDENTITY_ADMIN_OFFBOARDING_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R1A_IDENTITY_ADMIN_OFFBOARDING_DEFINE.md).
MP2-R2 is defined in
[`MASTER_PLAN_LEVEL2_MP2_R2_GUARDED_PLATFORM_OPERATIONS_OBSERVABILITY_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R2_GUARDED_PLATFORM_OPERATIONS_OBSERVABILITY_DEFINE.md).
MP2-R2 and MP2-R3 are COMPLETE / VERIFIED. MP2-R4 DEFINE / readiness
reconciliation is COMPLETE in
[`MASTER_PLAN_LEVEL2_MP2_R4_PREPRODUCTION_READINESS_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R4_PREPRODUCTION_READINESS_DEFINE.md),
but MP2-R4 implementation and verification remain NOT STARTED. Master Plan
Level 2 remains PARTIAL. MP2-R4-1 decisions and prerequisites are COMPLETE;
RPO=1 hour and RTO=4 hours are objectives, and the two prerequisite repair
slices remain pending. MP2-R4-2A focused IMPLEMENT is COMPLETE / READY FOR
VERIFY. Its first formal VERIFY failed on missing exact-one principal
cardinality; bounded repair is COMPLETE / READY FOR FORMAL RE-VERIFY. The next
gate was satisfied by formal RE-VERIFY; MP2-R4-2A is COMPLETE / VERIFIED. The
MP2-R4-2B bounded repair focused IMPLEMENT is COMPLETE / READY FOR FORMAL
VERIFY, with TS2352 removed and the build clean. Formal focused VERIFY
subsequently passed; MP2-R4-2B is COMPLETE / VERIFIED. MP2-R4-3
preflight/DEFINE is COMPLETE. The next gate is target-specific authorization
for **MP2-R4-3 controlled non-production Recovery Rehearsal execution**; later
rehearsals remain pending.
Completed foundations remain closed and are not to be rebuilt.

## 1. Fixed completed foundation

The controlling baseline is the Project Owner's **JUPITER AMMS Multi-Tenant
SaaS Programme — Complete Master Execution Plan, baseline 9 September 2026**.
Master Plan Level 1 application isolation is COMPLETE / VERIFIED. Completed
repository-local Level 2 platform/shared-master authority and repository-local
Level 3 tenant provisioning/lifecycle are COMPLETE / VERIFIED Master Plan
Level-2 requirements. They are fixed dependencies and must not be repeated.

PostgreSQL RLS, production activation, and final Production SaaS Acceptance have
not begun. AircraftComponent TS2352 remains separate deferred technical debt.

## 2. Remaining requirement findings

| Requirement | Existing evidence | Remaining classification |
| --- | --- | --- |
| System Owner operational activation | Repository-issued HUMAN principals, grants, revocation, audit, and lifecycle commands exist. No mounted operator administration surface exists. | Implementation required; operational/configuration action required; documentation/runbook required |
| Real System Owner bootstrap | Guarded one-time repository operation and direct script exist; exact database, ledger-head-601, schema, user, email, confirmation, replay, and audit checks are implemented and verified. It is not exposed as an npm command and has never been executed for the production target. | Already satisfied by verified implementation evidence; operational action and runbook required |
| `SB_SYNC_SCHEDULER` SERVICE provisioning | Atomic HUMAN-System-Owner repository method exists and is verified. No approved operator entry point exists; no SERVICE principal/grant has been provisioned. Runtime scheduler correctly fails closed without exact configuration and authority. | Implementation required for a guarded operator entry point; operational/configuration action and runbook required |
| Provider/organisation hierarchy | `tenants` are the current Organisation/company boundary. Users may have memberships in multiple tenants, but there is no provider entity, parent/child tenant relation, provider authority, or provider provisioning model. “Provider” elsewhere denotes data/maintenance sources, not SaaS tenancy. | Project Owner decision required before architecture; conditional implementation only if a provider tier is selected |
| Onboarding/offboarding | Authoritative tenant provision/activate/suspend/reinstate exists and preserves data. Provisioning requires an already-active initial user. Invitation/user creation, customer identity onboarding, responsibility assignment, offboarding evidence, and operator procedures are not defined. Deletion is prohibited. | Project Owner decisions required; implementation and runbook required where automation is selected |
| Backup/restore/incident/lockout | Canonical database safety policy defines mutation preflight and backup requirements; historical backups are evidence, not a current SaaS runbook. Tenant suspension provides lockout. No approved end-to-end backup validation, restore rehearsal, incident classification/escalation, emergency tenant lockout, or recovery acceptance procedure exists. | Documentation/runbook required; operational rehearsal/verification required; implementation required only for selected automation |
| Monitoring/alerting | Fail-closed errors and immutable platform audit exist. No defined privacy-safe metrics, alert thresholds, correlation/redaction policy, health signals, or operator response integration exists for tenant-context, authority, lifecycle-lock, portal/file denial, scheduler, or isolation anomalies. | Implementation required; configuration action and runbook required |
| Production secrets/config/environment separation | Production session-secret checks, guarded target parsing, database identity checks, test isolation, and scheduler configuration checks exist. No complete secrets inventory/ownership/rotation policy, production configuration manifest, environment promotion contract, least-privilege credential issuance procedure, or deployment-time validation gate exists. | Partly satisfied; implementation/configuration and runbook required |
| Controlled production migration/deployment readiness | Migration safety policy and guarded runner foundations exist. Production remains at its last established lineage and application deployment has not occurred. Required 582–601 sequencing, hashes, role/ACL changes, application compatibility, downtime/writer control, backup/restore proof, forward-repair posture, smoke verification, and reopen criteria are not assembled into an approved release plan. | Documentation/runbook and operational/configuration action required; focused implementation only for identified preflight automation gaps |

## 3. Project Owner decisions required

### Provider/organisation operating model

The Project Owner must decide:

1. whether Jupiter has only independent Organisations/companies, or a distinct
   Provider that controls multiple Organisations;
2. if a Provider exists, whether it owns, administers, or merely supports those
   Organisations, and whether an Organisation may belong to more than one;
3. who may create/link/unlink Organisations and assign provider operators;
4. whether provider operators may see tenant data, only operational metadata,
   or neither without explicit tenant-scoped membership;
5. required audit, suspension propagation, exit/transfer, and conflict rules.

No QA-MAN or SAFETY-MAN semantics are evidence for these decisions. Until they
are made, no provider schema, hierarchy, inheritance, or cross-tenant authority
may be implemented. The safe default remains independent tenants with explicit
per-tenant membership and no provider-derived data access.

### Onboarding/offboarding and operations

The Project Owner must also decide the identity source and approval process for
initial staff users; manual versus automated invitations; customer-portal
onboarding responsibility; required onboarding/offboarding evidence and
retention; emergency lockout approvers; recovery objectives; alert destinations
and duty ownership; and the target production topology/secret manager.

## 4. Smallest finite completion plan

### MP2-R1 — Operating Model Decisions and Fixed Operational Contracts

Project Owner DECISION gate, followed by governance DEFINE confirmation.
Resolve the provider/Organisation and onboarding/offboarding decisions above;
name production topology, secret ownership, recovery objectives, alert owners,
and operational approvers. VERIFY: decision completeness and conflict review.
No implementation or database action. The fixed independent-company operating
model and unresolved decisions are reconciled in
[`MASTER_PLAN_LEVEL2_MP2_R1_OPERATING_MODEL_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R1_OPERATING_MODEL_DEFINE.md).

### MP2-R2 — Guarded Platform Operations and Privacy-Safe Observability

IMPLEMENT only after MP2-R1. Add the minimum operator-only entry points needed
for System Owner capability administration and one-time scheduler provisioning;
retain HUMAN authority, transaction-time revalidation, immutable audit, replay
protection, and fail-closed pre-bootstrap behavior. Add privacy-safe structured
signals for tenant-context/authority/lifecycle coordination, portal/file denial,
scheduler health, and isolation anomalies without tenant payloads or foreign
identifiers. The Provider hierarchy branch is closed for this release; no
Provider schema is permitted. Separate focused VERIFY gate, including rollback
and no-leakage adversarial checks.

### MP2-R3 — Operational Runbooks and Environment/Release Controls

IMPLEMENT documentation and only the bounded validation automation identified
by MP2-R1/R2. Produce executable, target-specific runbooks for bootstrap,
capability grants, scheduler provisioning, tenant onboarding/offboarding,
suspension/emergency lockout, backup and restore rehearsal, incidents,
monitoring/alert response, secrets/rotation, environment separation, and the
controlled 582–601 production release. Define stop/reopen criteria, evidence
capture, compatible application rollback/forward repair, and ownership. Separate
VERIFY gate using non-production rehearsal; no production mutation.

### MP2-R4 — Pre-Production Operational Readiness Verification

After R2/R3 VERIFY, perform a clean-build gate (therefore requiring separate
resolution or explicit acceptance of AircraftComponent TS2352), configuration
validation, restore rehearsal, onboarding/lockout/reinstatement rehearsal,
bootstrap and scheduler-provisioning rehearsal only in an authorized disposable
environment, migration/application compatibility rehearsal, monitoring tests,
and final Level-1/Level-2 adversarial regressions. No production action.

### MP2-R5 — Controlled Production Activation

Requires a new explicit target-specific Project Owner authorization after R4
PASS. Execute the approved backup, maintenance window, exact migration sequence,
matching application deployment, real System Owner bootstrap, exact lifecycle
capability grants, `SB_SYNC_SCHEDULER` provisioning/configuration, initial
Organisation onboarding, smoke/isolation/monitoring verification, and controlled
traffic reopening. Stop at the first failed gate. Separate production VERIFY
and evidence gate.

### MP2-R6 — Master Plan Level-2 Final Verification and Closeout

After production activation VERIFY, perform combined Level-2 operational,
authority, isolation, recovery, observability, and onboarding/offboarding
acceptance. On PASS, separately authorize Master Plan Level-2 governance
closeout. Master Plan Level 3 RLS remains blocked until that closeout.

## 5. Dependencies and exclusions

R1A decisions → R2 and R3; R2 + R3 → R4; R4 PASS → separately authorized R5;
R5 VERIFY → R6. The Provider implementation branch is closed for this release;
future parent/subsidiary work requires a new explicit DEFINE.

This DEFINE does not authorize implementation, bootstrap, grants, SERVICE
provisioning, database mutation, RLS, production action, TS2352 repair, staging,
commit, push, deployment, reset, restore, or clean.

## 6. Historical next gate (satisfied)

**Project Owner decisions required for MP2-R1A — Identity, Admin Continuity,
Offboarding and Operations Contract.**

MP2-R1A and MP2-R1A-1 subsequently completed. The current next gate is Project
Owner authorization for **MP2-R2 focused IMPLEMENT** as defined in the MP2-R2
DEFINE document. That gate is now satisfied; formal focused VERIFY requires
separate Project Owner authorization.
