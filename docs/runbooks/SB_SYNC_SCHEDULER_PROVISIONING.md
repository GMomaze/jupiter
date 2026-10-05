# SB_SYNC_SCHEDULER Service Provisioning Runbook

## Purpose

Provision the single-purpose SERVICE principal used for scheduled Service
Bulletin synchronization. This does not start or configure the scheduler.

## Preconditions

- A repository-issued, active HUMAN platform principal is authenticated.
- That principal has fresh `PLATFORM_AUTHORITY_MANAGE` authority.
- Record an approved, non-empty operational reason.
- Confirm `GET /platform` contains no principal with service code
  `SB_SYNC_SCHEDULER`.

## Authority required

Only an authenticated HUMAN holding `PLATFORM_AUTHORITY_MANAGE` may provision,
revoke, or restore the grant. Tenant ADMIN and SERVICE identities are refused.

## Procedure

1. Open `GET /platform` through the authenticated, CSRF-protected application.
2. Submit the scheduler provisioning operation, `POST
   /platform/scheduler/provision`, with the approved `reason`.
3. Do not create a generic SERVICE principal or add any other capability.

## Expected result

One active SERVICE principal is created with exact service code
`SB_SYNC_SCHEDULER`, no user identity or tenant membership, and exactly one
active capability: `SERVICE_BULLETIN_SYNC_EXECUTE`. Principal creation and
grant actions appear in immutable platform audit.

## Refusal / stop conditions

Missing/stale HUMAN authority, absent reason, missing canonical capability, or
any existing `SB_SYNC_SCHEDULER` principal returns a generic refusal/conflict.
An arbitrary SERVICE capability grant is prohibited. Stop on any deviation.

## Verification

Refresh `GET /platform`. Confirm the principal type, exact service code, single
active capability, and successful immutable audit entries. Do not infer
authority from navigation or configuration alone.

## Recovery / failure handling

- To revoke execution while the principal remains active, submit `POST
  /platform/grants/revoke` with its principal ID, capability code
  `SERVICE_BULLETIN_SYNC_EXECUTE`, and an approved reason. Verify the revoked
  grant and audit entry at `GET /platform`.
- To restore that active principal, submit `POST /platform/grants` with the same
  principal ID, the same exact capability, and an approved reason.
- Duplicate provisioning is intentionally refused.
- If the canonical SERVICE principal was disabled, an authenticated HUMAN
  System Owner with fresh `PLATFORM_AUTHORITY_MANAGE` submits `POST
  /platform/scheduler/recover` with an approved reason. Recovery reuses the
  existing `SB_SYNC_SCHEDULER` identity, restores only
  `SERVICE_BULLETIN_SYNC_EXECUTE` when absent/revoked, and records immutable
  audit. An absent, active/healthy, non-canonical, or inconsistent principal
  state is refused. Never manipulate platform tables directly.

## Start / stop

Start only through the approved environment process. Enable scheduled execution
by setting `SB_SYNC_CRON_ENABLED=true`, exact
`SB_SYNC_SERVICE_CODE=SB_SYNC_SCHEDULER`, a positive
`SB_SYNC_INTERVAL_MINUTES`, and optionally `SB_SYNC_RUN_ON_BOOT`, then start the
application. `startCronJob` verifies non-test `NODE_ENV`, cron enablement, and
exact service code, resolves the exact `SB_SYNC_SCHEDULER` SERVICE principal, and
revalidates `SERVICE_BULLETIN_SYNC_EXECUTE`; any failure is fail-closed and emits
`SCHEDULER_START_REFUSED` (ERROR).

Stop with one of two existing controls; do not invent a scheduler shutdown
endpoint:

- Persistent stop: set `SB_SYNC_CRON_ENABLED=false` and restart the application.
  The scheduler does not start on the next boot.
- Immediate containment: trigger the existing graceful application shutdown
  (`SIGTERM`/`SIGINT`). The scheduler timers are unref'd and do not block exit;
  an in-flight run's transaction is terminated and rolls back, leaving no partial
  commit.

## Retry policy

No automatic retry. One attempt per scheduled tick; a failed run is not retried
immediately and receives no backoff. On failure the run's transaction rolls back
and `SCHEDULER_RUN_FAILED` (ERROR) is emitted; the scheduler waits for the next
normal interval (the fixed cadence is unchanged). Sustained failure escalates to
CRITICAL. Overlap protection (`pg_try_advisory_xact_lock`) applies on every
attempt; a still-running prior run yields
`SERVICE_BULLETIN_SYNC_ALREADY_RUNNING`, treated as a run failure, not retried.

## Timeout policy

No scheduler timeout currently exists. Define `SB_SYNC_RUN_TIMEOUT_MINUTES` as a
positive integer strictly less than `SB_SYNC_INTERVAL_MINUTES`; its production
value must be selected before deployment. Each external adapter (Veryon/ATP/
PiperPdf) network operation must be bounded by a timeout no greater than the run
timeout. On timeout, abort the run, roll back its transaction (releasing the
overlap lock), and emit `SCHEDULER_RUN_FAILED` (ERROR) with a timeout error code.
A timed-out run records no successful `SERVICE_BULLETIN_SYNC` audit; only the
redacted operational event is emitted. This policy is definition only;
enforcement is a later implementation slice.

