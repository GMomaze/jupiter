# Jupiter Master Execution Plan

**Document ID:** JUPITER-MASTER-EXECUTION-PLAN

**Revision:** 1.23

**Status:** Canonical

**Effective date:** 2026-08-18

## Programme purpose

Jupiter is an aircraft maintenance execution, planning, compliance, records,
and traceability system.

Development must preserve existing working functionality, operational history,
data integrity, and authority while safely extending the system through
controlled workflows.

## Execution discipline

Work progresses through:

```text
INVESTIGATE -> DEFINE -> IMPLEMENT -> VERIFY
```

Only one authorised phase or implementation slice is active at a time. The
Project Owner may return work to an earlier mode when new evidence requires it.
No later phase starts automatically.

Every phase must define:

- purpose and approved outcome;
- current mode;
- exact scope and exclusions;
- authority and affected operational boundaries;
- expected files/data/processes;
- verification and stop conditions;
- documentation, commit, release, and recovery obligations.

## Engineering boundaries

- Database persistence and backend services own operational truth.
- The UI expresses intent and displays authoritative results; it does not invent
  lifecycle, compliance, audit, permission, or due state.
- Existing operational authority is extended rather than duplicated.
- Schema, permission, ownership, and tenancy changes require explicit approval.
- Compatibility remains until a separately approved retirement phase proves safe
  replacement and recovery.

## Programme state

### Multi-Tenant SaaS controlling level map

For the Jupiter AMMS Multi-Tenant SaaS Programme, the Project Owner's
**Complete Master Execution Plan baseline 9 September 2026** controls level
meaning and sequencing. Repository-local phase or level names are evidence
labels only and do not supersede that map.

- Master Plan Level 1 — application-level multi-tenant isolation: COMPLETE /
  VERIFIED.
- Master Plan Level 2 — platform governance and operational SaaS readiness:
  PARTIAL. Platform/shared-master authority and tenant provisioning/lifecycle
  are complete and verified. Remaining requirements are System Owner
  operational activation; the provider/organisation hierarchy business-model
  decision and resulting requirements; real System Owner bootstrap;
  `SB_SYNC_SCHEDULER` SERVICE provisioning; onboarding/offboarding;
  backup/restore/incident/lockout procedures; monitoring/alerting; production
  secrets, configuration, and environment separation; and controlled production
  migration/deployment readiness.
- Master Plan Level 3 — PostgreSQL RLS: 4.1 RLS DEFINE / ARCHITECTURE COMPLETE,
  4.2 Database Tenant Context DEFINE COMPLETE, and 4.3 RLS Privileged / Bypass
  Access DEFINE COMPLETE; implementation NOT STARTED. The authoritative
  tenant-ownership architecture is defined in
  [`MASTER_PLAN_LEVEL3_4_1_RLS_OWNERSHIP_ARCHITECTURE_DEFINE.md`](MASTER_PLAN_LEVEL3_4_1_RLS_OWNERSHIP_ARCHITECTURE_DEFINE.md),
  the transaction-local tenant-context mechanism in
  [`MASTER_PLAN_LEVEL3_4_2_DATABASE_TENANT_CONTEXT_DEFINE.md`](MASTER_PLAN_LEVEL3_4_2_DATABASE_TENANT_CONTEXT_DEFINE.md),
  and the privileged/bypass access model in
  [`MASTER_PLAN_LEVEL3_4_3_RLS_PRIVILEGED_ACCESS_DEFINE.md`](MASTER_PLAN_LEVEL3_4_3_RLS_PRIVILEGED_ACCESS_DEFINE.md).
  RLS implementation remains gated and blocked until the Project Owner authorizes
  a separate IMPLEMENT slice.
- Final Production SaaS Acceptance: NOT STARTED.

The repository-local “Level 2 — Shared / Reference-Master Curator Authority”
and “Level 3 — Tenant Provisioning and Lifecycle Administration” are completed
Master Plan Level-2 work. Their implementation and verification evidence remains
valid; their local numbering must not be interpreted as completion of Master
Plan Level 2 or commencement of Master Plan Level 3.

The remaining Level-2 investigation and finite plan are defined in
[`MASTER_PLAN_LEVEL2_REMAINING_REQUIREMENTS_DEFINE.md`](MASTER_PLAN_LEVEL2_REMAINING_REQUIREMENTS_DEFINE.md).
MP2-R1 is reconciled in
[`MASTER_PLAN_LEVEL2_MP2_R1_OPERATING_MODEL_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R1_OPERATING_MODEL_DEFINE.md).
MP2-R1A-1 Identity, Membership, Administration & Recovery is COMPLETE /
VERIFIED; its historical failed verification attempts and bounded repairs are
preserved in current-state governance. MP2-R2 is defined in
[`MASTER_PLAN_LEVEL2_MP2_R2_GUARDED_PLATFORM_OPERATIONS_OBSERVABILITY_DEFINE.md`](MASTER_PLAN_LEVEL2_MP2_R2_GUARDED_PLATFORM_OPERATIONS_OBSERVABILITY_DEFINE.md).
MP2-R2 and MP2-R3 are COMPLETE / VERIFIED. MP2-R4 Pre-Production Operational
Readiness Verification is COMPLETE / VERIFIED (items 1–26 complete; item 27
Independent VERIFY = PASS; item 28 governance closeout). MP2-R4-1 Decisions and
Prerequisite Controls, MP2-R4-2A Scheduler Principal Recovery (original VERIFY
failure, bounded fail-closed repair and formal RE-VERIFY preserved), MP2-R4-2B
AircraftComponent TS2352 Bounded Repair (clean TypeScript build), MP2-R4-3
controlled non-production Recovery Rehearsal (recovery result PASS; lean formal
VERIFY PASS; temporary recovery infrastructure/code removed, evidence and
immutable audit history retained), MP2-R4-4 Authority and Operations rehearsal
(bootstrap, SERVICE provisioning, onboarding, lockout, reinstatement) and
MP2-R4-5 Release rehearsal (integrated release and rollback/forward-repair
decision handling) are COMPLETE / VERIFIED. This supersedes the earlier
statement that R4-4 and later R4 rehearsals remained pending. Zero unintended
residue was verified and no production environment was used. Master Plan Level 2
remains PARTIAL; production-specific operational and infrastructure matters are
deferred to MP2-R5, which has not begun. It does not authorize bootstrap
execution, SERVICE provisioning, database or production action, RLS, or final
acceptance.

The evidence-based capability map is
[`CURRENT_SYSTEM_ROADMAP.md`](CURRENT_SYSTEM_ROADMAP.md). Active and paused work
is recorded only in [`ACTIVE_WORK.md`](ACTIVE_WORK.md). Historical programme and
phase details remain indexed through
[`SUPERSESSION_REGISTER.md`](SUPERSESSION_REGISTER.md).

Current programme priorities are:

1. Complete and verify Governance Modernisation.
2. Preserve production, test-database, migration, and repository safety.
3. Resume only explicitly registered feature work after its governance gate.
4. Reconcile roadmap claims when source evidence changes.

## Completion gate

A phase is complete only when:

1. Its approved scope is satisfied.
2. Verification reaches an allowed successful outcome with limitations explicit.
3. No material regression or authority violation remains.
4. Database/migration obligations are satisfied where applicable.
5. Roadmap and active-work records are reconciled where authorised.
6. Unrelated user-owned files remain excluded.
7. Commit/release readiness is separately stated; completion does not itself
   authorise staging, commit, push, deployment, or rollback.

## Recovery rule

On unexpected behavior:

1. Stop mutation.
2. Preserve evidence and current state.
3. Verify phase, target, database, process, and Git state.
4. Determine whether recovery needs new authority.
5. Do not improvise undo, restore, privilege changes, or destructive cleanup.
