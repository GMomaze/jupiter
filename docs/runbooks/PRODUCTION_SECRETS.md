# Jupiter Production Secrets Contract

## Purpose

Define how Jupiter secret categories must be owned, supplied, protected,
rotated, and handled when compromised without selecting a secret manager or
recording values.

## Secret inventory

| Category | Current configuration / status |
| --- | --- |
| Runtime database | `DB_PASSWORD` with non-secret connection identifiers `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`. |
| Administrative database | `DB_ADMIN_PASSWORD` / `DB_ADMIN_USER`; privileged use requires separate authority. |
| Migration database | `DB_MIGRATION_PASSWORD`; `DB_MIGRATION_USER` must be exact migration authority and must not be application credentials. |
| Session/authentication | `SESSION_SECRET`; production requires at least 32 characters and rejects the development placeholder. CSRF uses the authenticated session; no separate CSRF secret key is repository-defined. |
| Tenant switching | `TENANT_SWITCH_TOKEN_SECRET`; non-placeholder, minimum 32 UTF-8 bytes. |
| Privacy-safe telemetry | `OPERATIONAL_EVENT_HMAC_KEY`; production requires at least 32 characters. |
| Remote test access | `REMOTE_TEST_USER` / `REMOTE_TEST_PASS`; test-only. `REMOTE_TEST_MODE=true` is forbidden by production safety. |
| Bootstrap confirmation | `PLATFORM_OWNER_CONFIRMATION` plus nominated user/database inputs; one-time controlled material, never retained in source or ordinary logs. |
| Email delivery | No production delivery provider or email credential is configured; `NullStaffInvitationDelivery` remains active. |
| External SB sources | Trusted source/root paths exist; no external API credential is currently repository-defined. |
| Scheduler | Uses database-backed exact SERVICE authority and configuration, not a separate scheduler password. |
| File storage | Current repository uses configured filesystem roots; no storage-provider credential is defined. |

The example environment file contains development placeholders and must never be
used as a production secret source.

## Ownership and decisions

Each secret needs a named Project Owner-approved business owner and a separately
authorized infrastructure custodian. Least privilege, environment-specific
identity, access logging, expiry/rotation policy, backup treatment, and emergency
revocation must be recorded without exposing values.

### Production secret-management method

The exact production secret-management product/provider and injection mechanism
are deferred until production infrastructure selection (Jupiter currently has no
production environment). This is **not** permission to use plaintext `.env` files
as the production solution. The selected mechanism must satisfy the existing
requirements: protected secret storage, controlled runtime injection,
environment separation, least-privilege custodian access, no Git storage, no
secret logging, and controlled rotation. Selection/configuration is required
before production activation.

### Rotation and expiry policy

- **Database credentials** (`DB_PASSWORD`, `DB_ADMIN_PASSWORD`,
  `DB_MIGRATION_PASSWORD`): planned rotation every **90 days**, plus immediate
  rotation on suspected compromise and when relevant privileged
  access/custodian changes require it.
- **`SESSION_SECRET`**: planned rotation every **90 days**, plus immediate
  rotation on suspected compromise; rotation must explicitly account for
  invalidation of existing sessions.
- **`TENANT_SWITCH_TOKEN_SECRET`**: planned rotation every **90 days**, plus
  immediate rotation on suspected compromise; rotation must explicitly account
  for invalidation of outstanding tenant-switch tokens.
- **Future email/API/storage/provider credentials**: comply with
  provider-required expiry/rotation and Jupiter's compromise procedure;
  immediately rotate/revoke on suspected compromise.
- **`PLATFORM_OWNER_CONFIRMATION`**: transient one-time bootstrap material; no
  periodic rotation/expiry schedule.
- **SB scheduler SERVICE principal/capability**: authority state rather than a
  secret credential; no secret rotation/expiry schedule.

## Preconditions

- Establish the target environment and redacted configuration manifest.
- Prove no secret is committed, embedded in an artifact, printed in command
  lines/logs, copied into tickets/runbooks, or shared across environments.
- Confirm replacement and rollback procedures exist before initial issuance or
  rotation.

## Authority required

Secret read/write/rotation access is restricted to approved custodians for the
specific environment. Jupiter System Owner application authority does not
automatically grant infrastructure secret access.

## Procedure

1. Create each value in the selected protected mechanism after the required
   decision; never edit tracked files with real values.
2. Inject values into only the intended process/environment. Keep database
   runtime, admin and migration credentials separate.
3. Validate production startup requirements without displaying values. Confirm
   `SESSION_SECRET` and `OPERATIONAL_EVENT_HMAC_KEY` length requirements and the
   tenant-switch non-placeholder/minimum-byte requirement.
4. Record secret identifier/version, owner, custodian, environment, issue and
   expiry times, consumer, and validation result—never the value.
5. Rotate under the category-specific procedure in "Rotation procedure".
   Validate replacement before revoking the old value; preserve audit/evidence.

## Rotation procedure

Rotate each secret class under a separately approved, category-specific
procedure. Where applicable:

1. Authorize the rotation for the exact secret and environment.
2. Provision the replacement value securely in the selected protected mechanism.
3. Validate the replacement (length/format/startup requirements) before use.
4. Coordinate application restart/re-authentication where rotation invalidates
   sessions or tokens (e.g., `SESSION_SECRET`, `TENANT_SWITCH_TOKEN_SECRET`).
5. Revoke/remove the old credential only after the replacement is proven valid.
6. Verify operation after rotation (health/readiness and affected flows).
7. Preserve privacy-safe operational/audit evidence (identifiers/versions, never
   values).
8. For emergency compromise rotation, containment/revocation may take priority
   over normal overlap; normal validation follows separately.

## Expected result

Every secret is environment-local, least-privilege, externally protected from
source/artifacts/logs, owned, versioned, auditable, and supplied only to its
consumer. Production refuses known missing/weak session, database and event-key
configuration; tenant switching independently refuses an invalid secret.

## Refusal / stop conditions

Stop for unknown owner/custodian, unselected manager, shared or exposed value,
development placeholder, missing replacement/rollback plan, production test
mode, overprivileged database credential, or any request to print/commit/log a
secret.

## Verification

Review the redacted manifest, access policy/log, environment uniqueness,
consumer startup result, and absence from Git/artifacts/logs. Do not treat
startup validation as proof that rotation or compromise recovery is complete.

## Compromise and recovery

Isolate the affected consumer, preserve redacted evidence and access history,
and stop Jupiter if continued use is unsafe. Do not record the exposed value.
Replacement, revocation, restart and validation require separate authority and
the selected secret-management procedure.

## Operational gap

**OPERATIONAL GAP — IMPLEMENTATION REQUIRED:** the rotation/expiry policy is now
fixed (see "Rotation and expiry policy"), but the production secret-manager
product/provider, injection/access workflow, and credential-specific overlap
mechanism remain deferred to production infrastructure selection (required before
MP2-R5 production activation; rehearse the chosen controls before MP2-R4
completion).

