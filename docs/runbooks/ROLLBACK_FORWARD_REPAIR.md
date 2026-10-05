# Jupiter Rollback and Forward-Repair Decision Runbook

## Purpose

Choose a non-destructive response to a failed release while preserving evidence,
tenant data, database/file consistency, authority, and immutable audit.

## Core distinction

- **ROLLBACK:** restore the previously approved application artifact or
  configuration only when it remains compatible with the current database and
  files. Database restore is a separate destructive-risk operation requiring
  explicit authority and a rehearsed coherent backup set.
- **FORWARD REPAIR:** create and verify a new application/configuration fix or an
  additive migration when deployed state cannot be safely reversed. Executed
  migrations are immutable; DOWN migration is never automatically safe.

## Authority required

The release owner/System Owner may keep production closed. Artifact rollback,
configuration replacement, additive migration, database restore, or forward
deployment each requires separate target-specific Project Owner authorization.

## Decision table

| Failure | Rollback only when | Forward repair when | Production state |
| --- | --- | --- | --- |
| Application deployment | Prior artifact is available, trusted and compatible with current database/files. | Schema/API/data already require the candidate or defect needs a new build. | CLOSED until health, authority and isolation PASS. |
| Migration | No database change occurred, or a separately proven reversible boundary exists. Never assume DOWN safety. | Any migration committed, partial effects are uncertain, or additive correction is safer. | CLOSED; preserve ledger/error and stop migration retries. |
| Configuration | Prior values remain valid, uncompromised and compatible. | Prior values are unsafe/invalid or contract changed. | CLOSED until production validation and health PASS. |
| Health check | Prior artifact/config can be restored compatibly and cause is bounded. | Failure is caused by required new state or unknown compatibility. | CLOSED while live/ready fails. |
| Tenant isolation | Only if prior artifact is proven compatible and removes the defect without data reversal. | Any uncertainty, persisted exposure, or required authority/data correction. | CLOSED immediately; treat as critical incident. |
| Data integrity | Only through separately rehearsed full recovery set and explicit restore authority. | Additive correction preserves valid data/history and can be independently verified. | CLOSED; never delete/overwrite evidence. |
| File-store inconsistency | Prior coherent database/file recovery set can be restored together under separate authority. | References/files can be reconciled non-destructively with auditable tooling. | Affected scope CLOSED; preserve all files/journal. |

## Preconditions

- Preserve failure timeline, logs, correlation IDs, artifact/config identities,
  ledger/hashes, database/file state, audits and backup inventory.
- Stop writers and scheduler where continued mutation could expand harm.
- Establish the last known compatible application/database/file combination.

## Procedure

1. Classify the failed boundary using the table; document uncertainty.
2. Prove compatibility and evidence preservation before proposing rollback.
3. If rollback cannot be proven safe, choose forward repair and define its new
   implementation and VERIFY gates; do not repair during incident triage.
4. Obtain explicit authorization for the exact action.
5. Execute through the selected release/recovery mechanism, then complete all
   post-release verification before reopen.

## Expected result

The chosen response restores a coherent, verified state without destructive
shortcuts, hidden migration divergence, tenant-data loss, authority weakening,
or audit deletion.

## Refusal / stop conditions

Keep production CLOSED for unknown target/state, missing backup or artifact,
unproven compatibility, partial migration, ledger/hash mismatch, isolation or
data-integrity failure, file mismatch, compromised secret, failed audit, or any
request to reset, clear tables, delete evidence/files, edit executed migrations,
or bypass authority.

## Verification

Require final ledger/schema/file consistency, `GET /health/live`, `GET
/health/ready`, System Owner/SERVICE state, tenant lifecycle, two-tenant
isolation, tenant/shared file access, immutable audit, and operational-event
observation. Record the decision and residual risk.

## Recovery / failure handling

If the selected response fails, stop and preserve both evidence sets. Do not
chain retries or switch strategies without new authorization. Use the isolated
Restore Runbook only when explicitly approved.

## Operational gap

**OPERATIONAL GAP — IMPLEMENTATION REQUIRED:** no production artifact rollback,
deployment recovery, database/file reconciliation, or forward-repair
orchestration is repository-defined. Resolve and rehearse before MP2-R4/MP2-R5
as applicable.

