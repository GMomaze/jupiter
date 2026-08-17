# Jupiter Master Execution Plan

**Document ID:** JUPITER-MASTER-EXECUTION-PLAN

**Revision:** 1.0

**Status:** Canonical

**Evidence review:** 2026-08-17

## Programme purpose

Jupiter is an aircraft maintenance execution, planning, compliance, records,
and traceability system. It must preserve operational history and authority
while replacing unsafe or fragmented manual workflows with controlled system
workflows.

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
