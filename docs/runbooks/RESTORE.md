# Jupiter Restore Runbook

## Purpose

Restore a complete Jupiter recovery set while preserving database/file
consistency, lifecycle state, authority, immutable audit, and tenant isolation.
Production use is prohibited until this procedure passes a controlled
non-production rehearsal for the selected backup mechanism and topology.

## Criticality

Jupiter is an operationally critical aviation maintenance management system.
Loss of availability, integrity, or recoverability can materially disrupt
maintenance execution, maintenance-record availability, compliance and
traceability, and planning and operational continuity. This operational
criticality is the basis for the established RPO of 1 hour and RTO of 4 hours.

## RPO and RTO

- **RPO objective: 1 hour.** The selected recovery point must demonstrate no
  more than one hour of recoverable-data exposure.
- **RTO objective: 4 hours.** Measure from declared recovery response through
  complete restore and recovery acceptance. This is not a guarantee.

## Recovery priority

Recovery must prioritize coherent system state over simply bringing the
HTTP/application process online as quickly as possible. Restore in this order:

1. **PostgreSQL database.** Restore authoritative application state,
   tenant/platform authority, lifecycle state, immutable audit, and relational
   references first.
2. **Tenant and shared-master files/uploads.** Restore after the database,
   because file references and expected file state are determined by database
   records.
3. **Application configuration, migration/release identity.** Establish that
   the application version, migration state, and required configuration are
   consistent with the restored database and files before application services
   become available.
4. **Application services.** Start last, only after database, files, and
   configuration/release state have been reconciled sufficiently for safe
   operation.

## Preconditions

- Obtain restore authorization for an exact recovery-set ID and isolated target.
- Verify custody, encryption, component inventory, SHA-256 sidecars, database
  readability, source environment, Git/release identity, configuration
  manifest, migration ledger/hashes, and all five file-root captures.
- Use a new or proven-empty isolated non-production restore target. Never
  overwrite a running or unidentified database/file root.
- Keep application access and scheduler execution disabled. Repository
  configuration supports `SB_SYNC_CRON_ENABLED=false` and
  `SB_SYNC_RUN_ON_BOOT=false`.

## Authority required

Project Owner authorization is required for the precise restore target and
recovery set. Database/file operators require approved infrastructure access.
Only repository-issued HUMAN authority may perform subsequent platform or
tenant lifecycle validation.

## Procedure

1. Record approval, recovery-set ID, source/target identities, intended recovery
   point, deployed commit, ledger, storage mapping, and UTC start time.
2. Validate the database archive using the approved tool. For PostgreSQL custom
   format, use the canonical `pg_restore --list` validation before restoration.
3. Restore the complete database into the isolated target using the selected
   approved mechanism. Do not run migrations, seeds, resets, undo, or repair SQL.
4. Restore each file-root component to its corresponding configured absolute
   target root without merging with unrelated files or following unsafe links.
5. Confirm database and files come from the same backup-set ID. Verify every
   database file reference is canonical and resolves within the expected root;
   identify missing and unreferenced files without deleting either.
6. Compare the restored quoted `public."SequelizeMeta"` ledger with the exact
   restored release's migration files and hashes. Stop on pending, unexpected,
   duplicate, reordered, or mismatched migrations.
7. Start the matching application release in the isolated environment with
   scheduler execution disabled and production/test separation intact.
8. Perform the verification below. Production restoration requires a separate,
   explicit authorization after this rehearsal is accepted.

## Expected result

The isolated target represents one coherent recovery point: database and files
match; tenant identities, memberships, records, lifecycle statuses, authorities,
and audits are preserved; suspended tenants remain `SUSPENDED`; no background
SERVICE work runs during validation.

## Verification

- Confirm liveness/readiness expose only bounded status.
- With authorized HUMAN access to `GET /platform`, verify the restored System
  Owner and SERVICE principals/grants exactly match the source recovery set.
  Do not bootstrap or provision missing authority as part of restore.
- Confirm active tenants can establish only their own tenant context; suspended
  tenants, their Customer Portal, and tenant-file delivery remain refused.
- Verify representative tenant-owned records/files for at least two isolated
  tenants and confirm neither can discover or influence the other.
- Confirm shared manufacturer file references resolve without granting tenant
  or platform authority.
- Confirm immutable audit tables/triggers and representative pre-backup audit
  history remain present and non-editable.
- Record elapsed time as evidence and compare it with the 4-hour objective;
  one rehearsal does not create a guarantee.

## Refusal / stop conditions

Stop for failed custody/hash/listing, incomplete components, target ambiguity,
release/ledger mismatch, active scheduler/writers, missing references, changed
lifecycle status, missing/excess authority, disabled audit protection,
cross-tenant discovery, or any attempt to use production before rehearsal
acceptance. Never clear tables, delete audit/data/files, reset, seed, use
migration undo, or bypass Jupiter authority as a recovery shortcut.

## Recovery / failure handling

Keep the failed target isolated, preserve evidence, and classify the recovery
set as unproven. Do not patch, retry, merge file sets, or promote it. Escalate to
the Jupiter System Owner and obtain a separately approved next action or a
different recovery point.

## Operational gap

**OPERATIONAL GAP — IMPLEMENTATION REQUIRED:** Jupiter has no repository-backed
restore orchestration, production topology/mapping, or approved automated
database-to-file reconciliation report. The selected mechanism and production
promotion procedure remain later MP2-R3 work.
