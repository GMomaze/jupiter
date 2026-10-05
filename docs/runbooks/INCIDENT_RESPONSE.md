# Jupiter Incident Response Runbook

## Purpose and ownership

Provide a bounded response framework that preserves evidence, contains access,
validates recovery, and reopens conservatively. The Jupiter System Owner is the
initial owner for critical security/tenancy incidents unless that authority is
suspected compromised; then escalate outside the affected principal and do not
use it. External personnel, vendors, contacts, and tooling are not yet defined.

## Alert rules

The following alerting policy is fixed. Production transport/address selection
remains a production-setup concern.

- **Thresholds.** CRITICAL events alert immediately. ERROR alerts after 3
  occurrences of the same condition within 15 minutes. WARN alerts after 5
  occurrences within 30 minutes. INFO does not alert. Security and
  tenant-isolation conditions are classified CRITICAL and bypass thresholds.
- **Warning vs critical.** WARN means abnormal or degraded operation without
  demonstrated loss of tenant isolation, authority integrity, or data integrity.
  CRITICAL means a condition requiring immediate containment, including suspected
  or confirmed cross-tenant exposure, compromised System Owner/platform authority,
  or serious data-integrity/corruption conditions.
- **Escalation timing.** CRITICAL alerts notify the Jupiter System Owner
  immediately. WARN/ERROR threshold alerts notify the System Owner and escalate
  to CRITICAL operational attention if unresolved for 30 minutes.
- **Alert destination.** The initial destination is a System-Owner-controlled
  alert channel. The exact production transport/address is selected during
  production setup; the alert owner and the delivery destination are distinct.
- **Out-of-hours behaviour.** CRITICAL alerts operate out-of-hours and must
  notify the System Owner regardless of time. Non-escalated WARN/ERROR alerts may
  wait until normal operational hours.
- **Recovery notification.** Recovery from an alert condition generates a
  recovery notification. CRITICAL incident recovery does not itself restore
  access; established recovery validation remains required.
- **Alert owner.** The Jupiter System Owner remains the initial alert owner.
- **Retention.** Operational log/alert retention remains 90 days by default;
  immutable authoritative audit evidence remains separately governed by its
  5-year default retention.

Existing severity levels (`INFO`/`WARN`/`ERROR`/`CRITICAL`) and alert
deduplication remain unchanged.

## RPO and RTO

- **RPO — PROJECT OWNER DECISION REQUIRED.** Database corruption, failed
  deployment, and file inconsistency recovery-point selection depend on it.
- **RTO — PROJECT OWNER DECISION REQUIRED.** Containment duration, restoration
  priority, and reopening targets depend on it.

## Preconditions

- Assign an incident ID, UTC timeline, initial owner, severity, affected scope,
  and evidence custodian without including secrets or tenant payloads.
- Preserve application/operational logs, immutable platform and tenant audits,
  relevant configuration names, release identity, database/file metadata, and
  correlation IDs. Do not alter originals.
- Treat uncertain tenant scope as potentially cross-tenant until disproved.

## Authority required

One unaffected System Owner may initiate platform/tenant containment; no dual
approval is currently implemented. Tenant ADMIN may disable membership only in
its active tenant. Infrastructure shutdown, secret replacement, restore, or
deployment requires separate target-specific authorization.

## Procedure

Apply the incident-class containment, evidence, escalation, validation, and
reopening controls below.

### Incident-class actions

| Incident | Immediate containment | Evidence and escalation | Recovery validation / reopening |
| --- | --- | --- | --- |
| Suspected cross-tenant exposure | Stop affected access; suspend implicated tenant only if that contains risk; shut down Jupiter if scope is uncertain. | Preserve request correlation, tenant-context refusal events, audits, release/config identity, and affected resource fingerprints without copying payloads. Escalate immediately to System Owner. | Prove mounted/direct/file isolation for affected and peer tenants; reopen only when scope, cause, containment, and no further discovery are established. |
| Compromised tenant user | Tenant ADMIN disables that user's membership with `POST /auth/staff/<user-id>/disable`; suspend the tenant if user scope is uncertain. | Preserve membership-authority and tenant audit evidence plus session/correlation metadata. | Verify membership-local denial, global identity and peer memberships preserved, credentials handled under separately approved process, and tenant access safe before reinstatement. |
| Compromised tenant | HUMAN System Owner suspends it with `POST /platform/tenants/<publicId>/suspend`. | Preserve lifecycle/platform audit and affected tenant evidence; verify peer tenants remain unaffected. | Validate cause/remediation, then use guarded reinstate only with approval; verify same data/memberships return and isolation holds. |
| Compromised System Owner | An unaffected HUMAN System Owner revokes specific grants or disables the principal through `/platform`. If only the final System Owner remains, stop: last-owner protection refuses removal. | Preserve platform audit and authority state; escalate outside the suspect principal. | Establish an independently trusted HUMAN authority and validate exact grants/audit before reopening platform operations. |
| Compromised SERVICE principal | HUMAN System Owner revokes `SERVICE_BULLETIN_SYNC_EXECUTE`; shut down Jupiter if execution cannot otherwise be contained. | Preserve scheduler events, platform audit, service code, correlations, and affected sync-run evidence. | Confirm the grant is revoked and no run executes. Regrant only to the existing active exact `SB_SYNC_SCHEDULER` principal after cause removal. |
| Lost/compromised secret | Isolate the affected runtime and stop Jupiter when continued use is unsafe. | Preserve redacted configuration identity and access timeline; never copy the secret into incident records. | Secret-manager and rotation mechanisms are undefined; reopen only after separately authorized replacement and configuration validation. |
| Failed deployment | Stop or isolate the failing release; do not migrate, undo, restore, or retry automatically. | Preserve commit/artifact, configuration manifest, logs, ledger/hashes, listener/process state, and failed assertion. | Use only a separately approved compatible rollback/forward-repair plan and complete smoke/isolation validation before reopening. |
| Database corruption | Stop all Jupiter writers and quarantine the target from application use. | Preserve database identity, logs, ledger, hashes, symptoms, and recovery-set inventory. | Perform the Restore Runbook in isolated non-production first; verify authority, lifecycle, audit, files, and tenant isolation before any production authorization. |
| File-store inconsistency | Stop affected file writers/delivery; do not delete missing, unreferenced, quarantine, or destination files. | Preserve root mapping, metadata/hashes, file-operation journal, database references, and correlations. | Reconcile in isolation against a coherent backup set; reopen only when referenced files and tenant/shared delivery boundaries are proven. |

## Expected result

The incident is contained with the smallest supported authority action,
evidence remains intact, unaffected peers remain available where safely
provable, and reopening is based on explicit validation rather than elapsed
time.

## Refusal / stop conditions

Stop if authority is suspect, scope cannot be bounded, audit/evidence capture
fails, peer impact appears, a final-System-Owner action is refused, or recovery
would require destructive reset, data/audit deletion, unsafe file cleanup,
direct table edits, invented commands, or authority bypass.

## Verification and reopening

Record containment action/audit, affected and unaffected scope, root cause or
documented remaining uncertainty, recovery evidence, tenant-isolation result,
authority state, lifecycle state, and System Owner approval. Reopen only the
validated scope; retain the incident timeline and unresolved follow-ups.

## Recovery / failure handling

Keep containment in place, preserve failed recovery evidence, and seek a new
explicit authorization. Never repeatedly retry mutations or conceal an
unresolved isolation, authority, database, file, or secret condition.

## Operational gaps

**OPERATIONAL GAP — IMPLEMENTATION REQUIRED:** external escalation contacts,
secret rotation/manager, deployment rollback/forward repair, automated evidence
capture, and incident tooling are not repository-defined. The existing null
invitation delivery, disabled-scheduler recovery, and membership-audit-view gaps
also remain open.
