# Jupiter Backup Runbook

## Purpose

Create one security-controlled, internally consistent recovery set covering the
Jupiter PostgreSQL database, referenced files, release identity, and non-secret
configuration metadata. This runbook does not select a backup provider.

## RPO and RTO

- **RPO objective: 1 hour.** This determines backup frequency and the maximum
  acceptable data interval not represented by a recovery set.
- **RTO objective: 4 hours.** This determines restore capacity, rehearsal
  frequency, and the target service-restoration duration.

These are operational objectives, not guarantees; rehearsal evidence is
required before any recovery claim.

## Backup policy

The disaster-recovery policy below is fixed. Production-specific mechanisms,
providers, paths, keys, and named personnel remain separate deployment
decisions recorded at production activation.

- **Recovery point and frequency.** RPO is **1 hour** and RTO is **4 hours**.
  Production recovery points must be no more than one hour apart. The technical
  mechanism (full dump, incremental, WAL/PITR, snapshot, or another approved
  method) is not prescribed here; the chosen production implementation must
  demonstrably meet the 1-hour RPO.

- **Retention.** Recovery-point retention is **30 daily**, **12 monthly**, and
  **5 annual** recovery points. Backup retention is a disaster-recovery asset
  policy and is distinct from Jupiter's business/maintenance-record retention
  policy; backups must not become the mechanism for normal record-retention or
  access requirements.

- **Encryption.** Backups require strong industry-standard encryption at rest,
  encrypted transport in transit, protected encryption-key management, and
  backup encryption credentials/keys that are never stored with the backup in a
  manner that defeats that protection. No provider, algorithm implementation,
  key-management product, or actual key is selected here.

- **Storage.** Production backups must be stored physically and/or logically
  separate from the live application/database storage so that failure or loss
  of the live environment does not inherently destroy the recovery copy. Exact
  provider, server, path, and storage topology remain production deployment
  decisions.

- **Off-site copy.** At least one independently stored off-site recovery copy
  is required so that loss, compromise, or destruction of the primary
  environment cannot remove both the operational data and all usable recovery
  copies. The off-site provider and location are not chosen here.

- **Ownership.** A Project Owner-approved operational/business owner and a
  separately authorized infrastructure/database custodian (responsible for
  backup operation and custody) are required, preserving least privilege and
  separation of duties. Actual named personnel are assigned before production
  activation.

- **Automatic verification and restore testing.** Every scheduled backup must
  automatically verify successful completion, presence of expected backup
  artifacts, integrity/checksum validation, and surfacing of failures for
  operational attention. Periodic isolated restore testing is also required so
  backup verification is not treated as proof of restorability. The
  automation/orchestration and restore-test schedule may be selected before
  production activation.

### Status distinction

- **Policy now defined:** the seven items above, together with the data scope
  recorded in "Preconditions" and "Expected result" (database, five file roots,
  release/migration identity, and redacted configuration).
- **Mechanism already proven (MP2-R4-3):** manual custom-format PostgreSQL
  dump, SHA-256 checksum sidecar, `pg_restore --list` readability validation,
  five-file-root capture, and isolated restore rehearsal (recovery result
  PASS).
- **Production infrastructure/configuration deferred:** backup provider,
  storage topology/path, off-site location, encryption algorithm/key-management
  product, named owner/custodian, concrete schedule, and automation/
  orchestration.

## Preconditions

- Obtain target-specific backup authority and identify the database by host,
  port, database name, runtime user, and environment without recording secrets.
- Identify the exact production-configured absolute roots:
  `AIRCRAFT_UPLOAD_ROOT` (tenant aircraft files), `MANUFACTURER_UPLOAD_ROOT`
  (shared-master files), `MANUFACTURER_QUARANTINE_ROOT`,
  `SB_IMPORT_QUARANTINE_ROOT`, and `SB_IMPORT_EPHEMERAL_ROOT`.
- Identify the deployed Git commit/release artifact, runtime/package versions,
  migration-file hashes, and quoted `public."SequelizeMeta"` ledger. The
  current guarded/test head is
  `603_remove_deferred_last_admin_enforcement.ts`; never assume a production
  target has that head without inspection.
- Select an approved encrypted database/file backup mechanism and protected
  destination. Repository automation for this does not exist.

## Authority required

Project Owner authorization is required for the named target and backup window.
Only approved infrastructure/database operators may access backup credentials
or storage. Application and tenant authority must never be bypassed to obtain
data exports.

## Procedure

1. Record a backup-set identifier, authorization, UTC start time, target
   identity, deployed commit, ledger, configured root identifiers, and operator.
2. Stop new application and scheduler writes. The current Node process supports
   graceful `SIGTERM`/`SIGINT`, closing the HTTP listener and database pools;
   the production process-supervisor mechanism remains topology-specific.
3. Confirm Jupiter writers are stopped and no file promotion/import is in
   progress. Stop if quiescence cannot be proven.
4. Using the approved database backup mechanism, capture the entire PostgreSQL
   database, including schema, data, migrations, platform/tenant authority,
   lifecycle state, sessions, file-operation journal, and immutable audits.
5. While writes remain stopped, capture all five configured file roots as one
   associated file set. Preserve paths, names, bytes, timestamps, and access
   protections; do not follow unsafe links or clean quarantine/working roots.
6. Capture the approved release artifact/source identity, dependency lockfile,
   migration files and hashes, and a redacted configuration manifest containing
   variable names and storage mappings but no values that are secrets.
7. Complete and seal all components under the same backup-set identifier before
   allowing restart under separately approved operating procedure.

## Expected result

One encrypted recovery set links a full database capture, all configured file
roots, exact release/migration identity, redacted configuration metadata,
timestamps, sizes, hashes, and custody evidence.

## Refusal / stop conditions

Stop for target ambiguity, active writers, incomplete root inventory, missing
component, inconsistent timestamps/identifiers, permission failure, plaintext
secret exposure, failed hash, or unapproved destination. Never delete data,
clear tables, reset a database, prune files, or weaken authority to complete a
backup.

## Verification

Require successful tool completion, component inventory, non-zero expected
sizes, SHA-256 hashes and checksum sidecars. For PostgreSQL custom format,
validate readability with `pg_restore --list` as required by canonical database
safety policy. Verification of recoverability requires the separate controlled
non-production restore rehearsal; listing or hashing alone is insufficient.

## Evidence and security

Retain the backup-set ID, approvals, redacted target identity, commit, ledger
and migration hashes, root manifest, tool/version, start/end times, component
sizes/hashes, verification result, custody/location, retention class, and any
failure. Encrypt in transit and at rest, restrict least-privilege access, never
record credentials/tokens, and protect backups as production-sensitive data.

## Recovery / failure handling

Preserve partial artifacts and logs without treating them as valid recovery
sets. Mark the attempt failed, keep Jupiter in the approved stopped/running
state, and escalate. Do not retry, overwrite a prior set, restore, or improvise
cleanup without fresh target-specific authority.

## Operational gap

**OPERATIONAL GAP — IMPLEMENTATION REQUIRED:** the backup *policy* is fixed (see
"Backup policy"), but Jupiter has no repository-backed backup orchestration,
production storage topology, provider, scheduled-backup validation automation,
or automated restore-test schedule. Those production mechanisms and selections
remain deployment work to be completed before production activation.
