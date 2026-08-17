# Jupiter Database and Migration Safety

**Document ID:** JUPITER-DATABASE-MIGRATION-SAFETY

**Revision:** 1.0

**Status:** Canonical

**Evidence review:** 2026-08-17

## Scope

This policy governs database inspection, tests, resets, seeds, migrations,
backups, restores, production changes, credentials, and recovery. A command's
presence in `package.json` does not by itself authorize its execution.

## Universal rules

- Verify live database, user, server address, port, environment, and intended
  operation before mutation.
- Never infer the target solely from `.env`, a CLI environment name, filename,
  shell prompt, or earlier session.
- Use read-only connections for investigation and preflight wherever possible.
- Do not print credentials or place them in SQL files, reports, command strings,
  shell history, or tracked files.
- Do not perform a destructive operation, restore, undo, seed, reset, role
  change, or migration without explicit authority for that exact operation.
- Stop at the first substantive failure. Do not weaken checks to obtain a pass.

## Guarded test database

Current fail-closed enforcement is implemented by:

- `src/config/testDatabaseSafety.ts`
- `src/scripts/testDatabasePreparation.ts`
- test setup/reset helpers
- Playwright global setup

Destructive test preparation requires all of:

```text
NODE_ENV=test
DB_NAME=jupiter_test
DB_USER=jupiter_test
ALLOW_TEST_DATABASE_RESET=YES
```

The guard also queries live PostgreSQL and requires:

```text
current_database() = jupiter_test
current_user       = jupiter_test
```

The check is case-sensitive and fail-closed. Missing, blank, or different
values prohibit the operation. A test that cannot prove this identity must not
run destructive setup.

When `NODE_ENV=test`, Jupiter removes inherited database environment values and
loads ignored `.env.test` with override. Secret values must never be reported.
The environment file is configuration input, not live-target proof.

Approved guarded entry points currently include:

```text
npm.cmd run db:test:reset
npm.cmd run db:test:migrate
npm.cmd run db:test:migrate:undo
npm.cmd run db:test:seed
```

Their safeguards do not replace the need for task-specific authorization,
especially for reset and undo.

## Generic script hazards

These scripts are target-dependent and are not safe operating procedures by
themselves:

```text
npm.cmd run db:migrate
npm.cmd run db:migrate:undo
npm.cmd run db:seed
```

Do not use them until an approved procedure has established the exact target,
environment, ledger, credentials, application state, backup/recovery boundary,
and authorized migration set.

Raw SQL formerly stored in `docs/CLEAR DB.txt` is unsafe historical material.
It is not an executable procedure.

## Migration rules

- Inspect models, schema, constraints, existing migrations, and ledger before
  proposing schema work.
- No migration is created merely for UI convenience.
- Once recorded in any shared or operational migration ledger, a migration is
  immutable. Do not edit, rename, reorder, or reuse it.
- Repair an executed migration only through a new additive migration with a new
  identity and explicit prerequisite checks.
- Compare the quoted `public."SequelizeMeta"` ledger with the migration
  filesystem using a quoting-safe SQL file or trusted helper.
- Verify each expected predecessor exactly once and the exact pending order.
- Record or verify hashes for approved migration files before deployment.
- Do not run migration undo in production unless a separately approved recovery
  procedure explicitly requires it.

## Production preflight and execution

Before any production schema mutation, an approved procedure must prove:

- exact database, runtime user, administrator user, host address, and port;
- server identity using typed address comparison rather than fragile textual
  comparison of PostgreSQL `inet` values;
- read-only preflight transaction where required;
- exact migration ledger and pending sequence;
- expected migration hashes;
- clean Git index and known working tree;
- verified owning application process and listener state;
- permission, role, ownership, and recovery prerequisites.

Create a new timestamped backup before an approved production schema change.
The backup must be:

1. Fresh for that deployment.
2. Custom format where PostgreSQL tooling is used.
3. Validated with `pg_restore --list` or the approved equivalent.
4. Hashed with SHA-256.
5. Accompanied by a checksum sidecar.
6. Reported without exposing credentials.

Apply only the explicitly approved migrations, in order, using the approved
environment. Do not improvise privileges, edit deployed migrations, retry a
failed controlled action, or restore a backup without separate authorization.

After migration, perform read-only ledger, schema, constraint, ownership,
permission, function, trigger, data-preservation, count, and fingerprint checks
defined by the phase. Restart and smoke verification occur only after every
required assertion passes.

## Recovery

A backup is recovery capability, not automatic restore authority. On failure:

- preserve logs and backup details;
- respect the approved application stopped/running state;
- report the exact failed assertion;
- do not undo, restore, patch data, alter privileges, or retry without explicit
  authorization.
