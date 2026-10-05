# Jupiter Production Release Runbook

## Purpose

Define a future controlled release gate using repository-supported validation
and commands without selecting a host or deploying anything.

## RPO and RTO

- **RPO — PROJECT OWNER DECISION REQUIRED.** Determines acceptable release
  recovery point and backup freshness.
- **RTO — PROJECT OWNER DECISION REQUIRED.** Determines maintenance/recovery
  capacity and reopen timing.

## Authority required

Each production backup, migration, deployment, bootstrap, SERVICE provisioning,
smoke test and reopen action requires explicit target-specific authorization.
One authorization must not be inferred to cover another.

## Compatibility model

For the 582–604 migration class, deployment is **database-first and forward-only**:
apply migrations before starting the new application, which must not run against the
old schema. An old application may remain read/auth-compatible against a migrated
database, but old writers are unsafe (NOT NULL tenant-ownership columns and
immutability triggers). Complete application/writer and SB-scheduler shutdown is
required during migration. A maintenance window/downtime is mandatory; its duration
is production-dependent. Existing sessions are preserved and `SESSION_SECRET` is not
rotated merely for this deployment.

## Pre-flight

1. Fix the exact release commit, package version, immutable artifact/checksum,
   dependency lockfile, runtime versions, and approver. Require a clean release
   index/worktree or a separately produced immutable clean artifact; never build
   production from the current dirty workspace.
2. Identify production database/server/runtime and migration identities without
   exposing credentials. Read the quoted `public."SequelizeMeta"` ledger;
   compare it in exact order with the release migration files. Record starting
   head, pending set, and SHA-256 for every pending migration.
3. Confirm application/schema compatibility for both the currently deployed and
   candidate application across the planned migration boundary. DOWN migrations
   are not presumed safe.
4. Create and validate the fresh encrypted backup set using `BACKUP.md`; require
   inventory, hashes/checksum sidecars and, for custom PostgreSQL format,
   `pg_restore --list`.
5. Validate the environment and secrets contracts, five absolute file roots,
   production/test refusal, database roles/permissions, session storage,
   observability key, and bounded health prerequisites.
6. Confirm HUMAN System Owner readiness through `GET /platform`. If scheduler is
   intended, confirm the exact active `SB_SYNC_SCHEDULER` SERVICE principal with
   only `SERVICE_BULLETIN_SYNC_EXECUTE`; otherwise keep scheduler disabled.
7. Define maintenance/writer state, file-operation quiescence, scheduler state,
   deployment mechanism, smoke/isolation evidence, observers and stop/reopen
   criteria. Stop if any mechanism or approval is missing.

## Execution

1. Enter the approved maintenance state and stop application writers/scheduler
   through the selected infrastructure process. Jupiter supports graceful
   process `SIGTERM`/`SIGINT`; no hosting-specific command or scheduler-only stop
   exists.
2. Reconfirm target identity, backup PASS, starting ledger, pending hashes and
   writer quiescence immediately before mutation.
3. With separately supplied migration credentials and exact approval flag, run
   `npm run migration:production`. The unified runner loads `.env`, requires
   `ALLOW_UNIFIED_DATABASE_MIGRATION=YES`, validates the production target/live
   identity, then invokes ordered Sequelize forward migrations. Do not use
   `db:migrate:undo` in production.
4. Re-read the ledger and required schema/constraint/role/trigger state. Stop on
   any mismatch.
5. Deploy the exact compatible artifact through the selected hosting mechanism.
   **OPERATIONAL GAP — IMPLEMENTATION REQUIRED:** no repository-defined
   production deployment command/provider exists.
6. Execute System Owner bootstrap or scheduler provisioning only when absent,
   necessary, and separately authorized, using their verified MP2-R3A runbooks.
7. Start the candidate release with the approved production process; `npm start`
   is the repository entry, not a hosting procedure.
8. Require `GET /health/live` and `GET /health/ready`, then perform the bounded
   checks in `POST_RELEASE_VERIFICATION.md`.
9. Observe privacy-safe operational events, scheduler status where enabled, and
   immutable audit. Reopen only after every required result is PASS and the
   authorized release owner accepts the evidence.

## Expected result

Only the approved artifact and forward migrations reach the exact target;
configuration, health, authority, files, tenant isolation, audit and monitoring
checks pass before reopening.

## Refusal / stop conditions

Stop for dirty/unfixed artifact, target ambiguity, missing authorization,
ledger/hash drift, invalid backup, compatibility uncertainty, active writers,
unresolved configuration/secret/root, unavailable System Owner, unexpected
SERVICE state, failed migration/deploy/health/isolation/audit check, or missing
monitoring observation. Keep production closed.

## Verification and evidence

Retain approvals, release/artifact hashes, redacted target/config manifest,
starting/final ledger, migration hashes, backup-set validation, writer state,
command exit evidence, health/smoke/isolation/audit results, operational-event
observation, deviations, and reopen decision without secrets or tenant payloads.

## Recovery / failure handling

Stop at the first substantive failure, preserve evidence and tenant data, and
apply `ROLLBACK_FORWARD_REPAIR.md`. Never retry, undo migrations, restore, patch
data, change privileges, or deploy another artifact without explicit authority.

## Operational gaps

**OPERATIONAL GAP — IMPLEMENTATION REQUIRED:** production topology/provider,
immutable artifact pipeline, release orchestrator, preflight report, supervisor
command, scheduler-only stop, monitoring/alert transport, and deployment
recovery tooling are not finalized. Resolve/rehearse required controls before
MP2-R4; production-specific selections and approvals are required before MP2-R5.

