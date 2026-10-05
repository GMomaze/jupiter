# Jupiter Post-Release Verification Runbook

## Purpose

Define the minimum non-destructive evidence required before reopening a future
production release. This document does not authorize executing the checks.

## Preconditions

- Exact artifact/commit, configuration manifest, database target, final
  migration ledger, backup set, maintenance state and authorization are fixed.
- Application is reachable only to authorized verifiers; scheduler remains
  disabled unless its verification is explicitly included.
- Prepare two approved non-production-style tenant verification identities/data
  sets for Tenant A and Tenant B without exposing production payloads.

## Authority required

System Owner performs platform/lifecycle checks; each tenant check uses only its
own tenant ADMIN/staff/customer authority. SERVICE verification uses the exact
configured SERVICE identity. No verifier receives broader authority for
convenience.

## Procedure

1. **Health:** require `GET /health/live` status `ok` and `GET /health/ready`
   status `ready`; confirm responses disclose no internals.
2. **System Owner:** through `GET /platform`, verify active HUMAN authority,
   expected grants, immutable platform audit and no unexpected principals.
3. **Lifecycle:** verify an authorized read/controlled rehearsal of tenant
   state; suspended tenants remain refused and no lifecycle mutation occurs
   unless separately authorized.
4. **Tenant isolation:** establish Tenant A context and verify only A records;
   repeat for B; challenge A requests with B identifiers and require neutral
   refusal/no discovery.
5. **Staff:** confirm active tenant ADMIN reaches `GET /auth/staff`, ordinary
   staff cannot administer users, and neither receives platform authority.
6. **Customer Portal:** where configured, verify customer access is limited to
   its own active tenant and remains refused for suspended tenant state.
7. **Files:** verify tenant-owned aircraft files require matching active tenant
   authority; foreign/orphan/traversal references fail neutrally. Verify shared
   manufacturer files resolve only when referenced and do not grant mutation
   authority.
8. **Shared master:** verify required HUMAN mounted gates and tenant users cannot
   perform platform/shared-master administration.
9. **Scheduler/SERVICE:** if enabled, verify exact service code
   `SB_SYNC_SCHEDULER`, only `SERVICE_BULLETIN_SYNC_EXECUTE`, approved method and
   trusted paths; confirm HUMAN administration and tenant authority remain
   unavailable to SERVICE. Do not provision during verification.
10. **Audit/monitoring:** confirm expected immutable audit entries and
    privacy-safe operational events, with no secrets/payloads/unsafe paths.
    Observe the approved channel for the defined window.
11. **Residue/errors:** confirm no unexpected principal/grant, lifecycle lock,
    file-operation, failed job, migration, temporary file, or test fixture
    residue. Record all warnings/errors and classify them before reopening.

## Expected result

Health, configuration, platform/SERVICE authority, lifecycle, staff/customer,
tenant/shared files, two-tenant isolation, audit and monitoring all PASS with no
unexpected residue or disclosure.

## Refusal / stop conditions

Keep production CLOSED on any failed/unknown check, cross-tenant influence or
discovery, unexpected authority, suspended-tenant access, missing file/audit,
unsafe telemetry, scheduler mismatch, residue, unclassified error, or pressure
to bypass a gate.

## Verification evidence

Retain check owner/time, redacted identities, request/correlation IDs, bounded
responses, audit/event references, ledger/artifact/config hashes, result and
reopen decision. Never retain credentials, tokens, tenant payloads or unsafe
paths in the report.

## Recovery / failure handling

Stop at first substantive failure, preserve state/evidence, maintain closure,
and use the Incident Response and Rollback/Forward-Repair decision runbooks.
Do not fix, reset, delete, reprovision, migrate, or rerun broadly inside this
verification.

## Operational gaps

**OPERATIONAL GAP — IMPLEMENTATION REQUIRED:** production smoke-test fixtures,
monitoring/alert transport and observation window, automated residue report,
and hosting-integrated reopen control are undefined. Resolve/rehearse required
parts before MP2-R4 and select production specifics before MP2-R5.

