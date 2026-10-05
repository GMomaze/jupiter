# MP2-R1 Operating Model Contract — DEFINE

**Document ID:** JUPITER-MP2-R1-OPERATING-MODEL

**Revision:** 1.20

**Status:** DEFINE / RECONCILIATION COMPLETE; MP2-R1A contract fixed

**Reviewed:** 2026-09-15

## Fixed operating model

The current release hierarchy is System Owner → independent Company/Tenant →
Company Administrator → Company Users. Only the System Owner decides which
companies may operate; companies cannot create companies and cannot discover
other tenants. System Owner suspension/reinstatement preserves all company data,
relationships, memberships, history, and files. No Provider or parent/subsidiary
tier is required now. Future hierarchy is deferred and must use explicit
permission-based sharing, never automatic cross-tenant access.

## Reconciled current behavior

| Item | Evidence and classification |
| --- | --- |
| Company provisioning | Exact Platform HUMAN lifecycle commands create/activate/suspend/reinstate tenants; companies have no lifecycle authority. **ALREADY SATISFIED.** |
| First Company Administrator | Provisioning requires an existing active user and atomically creates its ACTIVE membership and ADMIN role. **ALREADY SATISFIED for assignment; identity prerequisite remains.** |
| User identity/account creation | Password login and inactive-user denial exist. No mounted production account creation, password establishment, invitation, or activation workflow was found. **IMPLEMENTATION REQUIRED; PROJECT OWNER DECISION REQUIRED.** |
| Staff invitation/onboarding | Membership supports INVITED/ACTIVE/SUSPENDED/DISABLED, but no mounted invitation, acceptance, or membership-creation workflow exists. **IMPLEMENTATION REQUIRED; PROJECT OWNER DECISION REQUIRED; OPERATIONAL/RUNBOOK REQUIRED.** |
| Tenant-local staff/roles | Active same-tenant ADMIN can list ACTIVE staff and toggle active roles under authentic tenant context. **ALREADY SATISFIED for role toggling; PARTIALLY SATISFIED overall.** |
| Administrator replacement/disable | No last-company-admin protection, deliberate replacement workflow, membership suspend/disable command, or global-user disable operator workflow exists. **IMPLEMENTATION REQUIRED; PROJECT OWNER DECISION REQUIRED.** |
| Offboarding/retention | Membership states can preserve history; company suspension and deletion prohibition preserve tenant data. No mounted employee offboarding or retention procedure exists. **PARTIALLY SATISFIED; IMPLEMENTATION REQUIRED; OPERATIONAL/RUNBOOK REQUIRED.** |
| Emergency company lockout | System Owner suspension is implemented, audited, race-safe, and data-preserving. **ALREADY SATISFIED technically; OPERATIONAL/RUNBOOK REQUIRED.** |
| Backup/recovery | Canonical policy requires target proof, backup, hash/list validation, and separate recovery authority. Existing artifacts are not a current SaaS restore rehearsal. **PARTIALLY SATISFIED; OPERATIONAL/RUNBOOK REQUIRED.** |
| Monitoring/logging/alerting | Immutable audit and fail-closed errors exist. No verified privacy-safe tenancy metrics, thresholds, alert routing, or incident integration exists. **PARTIALLY SATISFIED; IMPLEMENTATION REQUIRED; OPERATIONAL/RUNBOOK REQUIRED.** |
| Environment separation | Test quarantine, migration target parsing, production secret checks, DB identity validation, and scheduler guards exist. **PARTIALLY SATISFIED; OPERATIONAL/RUNBOOK REQUIRED.** |
| Production secrets/configuration | Environment variables and basic secret safeguards exist. Secret inventory, ownership/rotation, selected secret manager, production manifest, and promotion verification do not. **PROJECT OWNER DECISION REQUIRED; OPERATIONAL/RUNBOOK REQUIRED; bounded validation implementation may be required.** |

## Removed from remaining implementation workload

Do not rebuild tenant/membership schema, context selection/switching, isolation,
provisioning, first-admin assignment, lifecycle commands, deletion protection,
coordination/audit, platform HUMAN/SERVICE authority, bootstrap and scheduler-
provisioning repositories, shared-master authority, dormant-writer closure,
tenant-local staff listing/role toggling, or core database target/migration
safety. The Provider implementation branch is closed for this release. Future
parent/subsidiary work is **DEFERRED** to a new explicit DEFINE.

## Minimum Project Owner decisions still required

1. Who may create a new staff identity: System Owner only, Company Administrator
   invitation, or external identity provider? Is public self-registration
   prohibited?
2. May a Company Administrator invite a new email and activate membership after
   acceptance, or only attach an existing active Jupiter user?
3. Must every ACTIVE company retain at least one ACTIVE ADMIN, and who may
   replace/disable the last ADMIN: System Owner only or controlled company-admin
   handover?
4. Does employee offboarding disable only that tenant membership, or also the
   global user when no other membership/platform authority remains? What
   retention applies to invitation/membership evidence?
5. What production topology/secret manager, recovery objectives, incident and
   lockout approvers, and alert destinations/duty ownership apply?

## Reconciled finite plan

- **MP2-R1A:** Project Owner decisions above; governance-only contract VERIFY.
- **MP2-R2 IMPLEMENT / VERIFY:** only selected identity/invitation/membership
  lifecycle and last-admin controls; guarded invocation of existing platform
  grant/revoke/disable and scheduler provisioning; privacy-safe observability.
  No Provider schema.
- **MP2-R3 IMPLEMENT / VERIFY:** operational runbooks, environment/release
  controls, and only necessary validation automation.
- **MP2-R4 VERIFY:** authorized non-production readiness rehearsals. A clean-
  build gate requires separate TS2352 resolution or explicit acceptance.
- **MP2-R5 IMPLEMENT / VERIFY:** separately authorized target-specific
  production activation only after R4 PASS.
- **MP2-R6 VERIFY / CLOSEOUT:** combined Master Plan Level-2 verification, then
  separately authorized governance closeout. RLS remains blocked until closeout.

## Historical next gate (satisfied)

**Project Owner decisions required for MP2-R1A — Identity, Admin Continuity,
Offboarding and Operations Contract.**

No implementation, database action, bootstrap, SERVICE provisioning, RLS,
production activation, TS2352 repair, staging, commit, push, deployment, reset,
restore, or clean is authorized.

## MP2-R1A decision resolution

The Project Owner fixed the identity, administrator-continuity, offboarding,
emergency-authority, and initial alert-ownership decisions on 2026-09-14. The
resulting missing implementation boundary is canonical in
[`MASTER_PLAN_LEVEL2_MP2_R1A_IDENTITY_ADMIN_OFFBOARDING_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R1A_IDENTITY_ADMIN_OFFBOARDING_DEFINE.md).
The earlier MP2-R1A decision gate is satisfied and must not be repeated. The
MP2-R1A-1 implementation and verification also subsequently completed. The
then-next gate was Project Owner authorization for **MP2-R2 focused IMPLEMENT**,
governed by the MP2-R2 DEFINE document. That implementation and formal
verification are now complete. MP2-R3A focused IMPLEMENT subsequently
completed, its first VERIFY found one onboarding-runbook defect, and bounded
repair and RE-VERIFY completed. MP2-R3A/B/C and aggregate MP2-R3 are COMPLETE /
VERIFIED with all recorded gaps preserved. MP2-R4 DEFINE / readiness
reconciliation subsequently completed; implementation and verification remain
NOT STARTED. MP2-R4-1 decisions and prerequisites subsequently completed. The
MP2-R4-2A Scheduler Principal Recovery focused IMPLEMENT subsequently
completed. Its formal VERIFY found the exact-one principal defect; bounded
fail-closed repair is COMPLETE / READY FOR FORMAL RE-VERIFY. The current next
gate was satisfied by formal RE-VERIFY; MP2-R4-2A is COMPLETE / VERIFIED. The
MP2-R4-2B bounded repair focused IMPLEMENT subsequently completed with a clean
build, and formal focused VERIFY subsequently passed. MP2-R4-2B is COMPLETE /
VERIFIED. MP2-R4-3 preflight/DEFINE subsequently completed. The current next
gate is target-specific Project Owner authorization for **MP2-R4-3 controlled
non-production Recovery Rehearsal execution**.
