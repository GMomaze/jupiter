# Jupiter Database and Migration Safety

**Document ID:** JUPITER-DATABASE-MIGRATION-SAFETY

**Revision:** 1.1

**Status:** Canonical

**Effective date:** 2026-08-18

## Scope

This policy governs database inspection, tests, resets, seeds, migrations,
backups, restores, production changes, credentials, and recovery.

A command's presence in `package.json` does not authorize its execution.

Use the smallest database evidence set sufficient for the authorized task.
Do not inspect the entire schema or migration history by default.

## Universal rules

- Verify live database, user, server address, port, environment, and intended
  operation before mutation.
- Never infer the target solely from `.env`, a CLI environment name, filename,
  shell prompt, or earlier session.
- Prefer read-only inspection and preflight wherever practical.
- Do not print credentials or place them in SQL files, reports, command strings,
  shell history, or tracked files.
- Do not perform a destructive operation, restore, undo, seed, reset, role
  change, or migration without explicit authority for that exact operation.
- Preserve existing Jupiter data, relationships, history, constraints, and
  operational authority unless their change is explicitly approved.
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