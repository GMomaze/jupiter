# System Owner Bootstrap Runbook

## Purpose

Create the first HUMAN Jupiter System Owner through the guarded, one-time
bootstrap operation. This is not a user-creation procedure.

## Preconditions

- Obtain the target environment approval and an approved maintenance window.
- Confirm the target database name independently. Never copy a production
  database value into test configuration or vice versa.
- Confirm the nominated user already exists, is active, and has the exact
  UUID and email supplied below. Use placeholders in retained evidence.
- The complete repository migration ledger must match the database and end at
  the current canonical repository head (verified dynamically via the
  migration-ledger comparison, not a hard-coded constant).
- All 23 canonical platform capabilities must be active and system-locked, and
  the immutable platform-audit trigger must be enabled.
- There must be no prior `SYSTEM_OWNER_BOOTSTRAPPED` audit and no active
  `PLATFORM_AUTHORITY_MANAGE` grant.

## Authority required

Separate Project Owner authorization for the named target and real bootstrap is
required. Repository access alone is not authorization.

## Procedure

1. Set these process environment values without writing them to a file or shell
   history:
   - `DB_NAME=<approved-target-database>`
   - `PLATFORM_OWNER_USER_ID=<existing-active-user-uuid>`
   - `PLATFORM_OWNER_EMAIL=<that-user-exact-email>`
   - `PLATFORM_OWNER_CONFIRMATION=BOOTSTRAP:<database>:<user-uuid>:<lowercase-email>`
   - `ALLOW_INITIAL_SYSTEM_OWNER_PREFLIGHT=YES`
2. Run `npm run platform:bootstrap:preflight`.
3. Require exit code zero and the bounded JSON result `outcome=READY`, the
   approved database, nominated user UUID, the current canonical migration
   head, and capability count 23. Stop if any value differs.
4. Obtain the final execution approval. Add
   `PLATFORM_OWNER_DISPLAY_NAME=<approved-display-name>` and
   `ALLOW_INITIAL_SYSTEM_OWNER_BOOTSTRAP=YES` to the same controlled process
   environment.
5. Run `npm run platform:bootstrap:execute` once.

## Expected result

The command exits successfully and atomically creates one active HUMAN
principal for the nominated user, grants the six canonical System Owner
capabilities — `PLATFORM_AUTHORITY_MANAGE`, `PLATFORM_AUDIT_VIEW`,
`TENANT_PROVISION`, `TENANT_ACTIVATE`, `TENANT_SUSPEND`, and
`TENANT_REINSTATE` — and writes `SYSTEM_OWNER_BOOTSTRAPPED` to immutable
platform audit. The lifecycle capabilities remain independent granular
capabilities checked individually by the lifecycle policy; they are not
collapsed into `PLATFORM_AUTHORITY_MANAGE`.

## Refusal / stop conditions

Stop on a missing value; database, ledger, schema, capability-set,
confirmation, user, UUID/email, or active-state mismatch; prior bootstrap;
existing System Owner; disabled audit trigger; or any non-zero exit. Never
change the database to make a failed preflight pass during this procedure.

## Verification

Sign in as the nominated HUMAN user and open `GET /platform`. Confirm the HUMAN
principal, all six grants, and `SYSTEM_OWNER_BOOTSTRAPPED` audit entry. Repeat
`npm run platform:bootstrap:preflight`; it must refuse the duplicate.

## Recovery / failure handling

The repository transaction rolls back on failure. Preserve the error and
correlation evidence, remove process-only values, and escalate for diagnosis.
Do not rerun execution until preflight is READY and fresh authorization exists.

