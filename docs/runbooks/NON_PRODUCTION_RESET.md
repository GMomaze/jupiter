# Non-Production Database Reset & Reload — Operator Runbook

**Scope:** controlled full application-schema reset of a non-production
`jupiter_db` (e.g. the Ubuntu test server), followed by canonical migration,
required seeds, privilege hardening, and System Owner bootstrap. It does **not**
reinstall Ubuntu, PostgreSQL, or Jupiter, and it preserves the PostgreSQL
server, database roles, application configuration, HTTPS, and systemd services.

**Nature:** DESTRUCTIVE — it performs `DROP SCHEMA public CASCADE`. Historical
audit evidence survives only in the verified pre-reset backup, not inside the
reset database.

## Safety gates (all mandatory; any failure aborts before mutation)

1. `ALLOW_NON_PRODUCTION_RESET=YES` — explicit non-production authorisation,
   independent of `NODE_ENV`.
2. `ALLOW_UNIFIED_DATABASE_MIGRATION=YES` — canonical migration approval.
3. `DB_MIGRATION_NAME` and `CONFIRM_NON_PRODUCTION_RESET_DATABASE` must match
   exactly (the database name is typed twice).
4. `NON_PRODUCTION_RESET_BACKUP_PATH` — a mandatory pre-reset backup path.
5. Refusal list: `jupiter_test`, `postgres`, `template0`, `template1` are never
   reset here.
6. Interactive confirmation: the operator must retype the database name at a
   prompt after the configuration gate passes.
7. Live identity verification: the actual `current_database()`, `current_user`,
   `session_user`, `server_address`, and `server_port` must match the configured
   database, `postgres` user, host, and port, and the server must not be
   read-only.

## Prerequisites

- PostgreSQL `postgres` superuser access and the `pg_dump`/`pg_restore` client
  binaries on `PATH`.
- The target is a **non-production** `jupiter_db` only.

## Procedure

```bash
# 1. Verified pre-reset backup (also performed automatically by the command).
pg_dump --format=custom --file=/secure/path/jupiter_db_pre_reset_$(date +%F_%H%M%S).dump \
  --host="$DB_HOST" --port="$DB_PORT" --username=postgres jupiter_db

# 2. Reset (gated; prompts for the database name again).
ALLOW_NON_PRODUCTION_RESET=YES \
ALLOW_UNIFIED_DATABASE_MIGRATION=YES \
DB_MIGRATION_NAME=jupiter_db \
CONFIRM_NON_PRODUCTION_RESET_DATABASE=jupiter_db \
NON_PRODUCTION_RESET_BACKUP_PATH=/secure/path/jupiter_db_pre_reset_<ts>.dump \
DB_MIGRATION_USER=postgres \
DB_ADMIN_PASSWORD='<secret>' \
DB_MIGRATION_HOST="$DB_HOST" \
DB_MIGRATION_PORT="$DB_PORT" \
npm run reset:non-production
```

The command: verifies identity → takes a verified `pg_dump` backup → validates
the archive with `pg_restore --list` → runs the existing guarded rebuild
(`developmentRebuild.ts`: DROP SCHEMA → migrate → required seeds → privilege
hardening) → runs the canonical System Owner bootstrap → prints the
reconciliation summary and the restoration command.

## Credential propagation

The single operator-supplied database credential is `DB_ADMIN_PASSWORD` (the
PostgreSQL `postgres` superuser password), read by the reset safety gate. It is
propagated as follows, without ever being printed to stdout, logs, or error
messages:

- **Reset orchestration** — `DB_ADMIN_PASSWORD` → `config.password`, used for the
  `pg_dump` backup (`PGPASSWORD`) and the identity/reconciliation `pg` clients.
- **Guarded rebuild + migrations + hardening** — the orchestration maps
  `DB_ADMIN_PASSWORD` to `DB_MIGRATION_PASSWORD` for the existing guarded
  rebuild (`buildDevelopmentRebuildCommandEnvironment`).
- **System Owner bootstrap** — the bootstrap scripts read `DB_HOST`/`DB_PORT`/
  `DB_NAME`/`DB_USER`/`DB_PASSWORD` from the inherited application environment
  (the app `.env`, loaded by `dotenv/config`); the reset orchestration adds no
  password to that stage.

## Backup validation

After the pre-reset `pg_dump` completes, the command runs
`pg_restore --list` against the new archive. A successful listing (exit code 0
with a non-empty `; TOC Entries:` header) proves the archive is a readable
PostgreSQL custom-format dump; a corrupt, truncated, empty, or unreadable
archive is rejected **before** any destructive step begins.

This listing establishes archive **readability only** — it is not proof that a
complete database restoration has been tested. A separate rehearsed
`pg_restore` (see `RESTORE.md`) is required to prove full restorability.

## Post-reset state

- All migrations applied (head 626), required reference data and operational
  roles/RBAC mappings seeded, privileges/RLS/triggers/security functions
  hardened, and the canonical System Owner (fixed UUID `a5319d4e-…`) with its
  platform principal and grants re-established.
- No WAA/WA tenant data or unintended tenant/staff records remain.

## Failure & restoration

- If any gate fails, the command aborts **before** mutation (fail-closed).
- If a migration/seeding/bootstrap step fails, the command reports a non-zero
  exit and the prior state is recovered by restoring the backup:

```bash
pg_restore --clean --if-exists --dbname=jupiter_db /secure/path/jupiter_db_pre_reset_<ts>.dump
```

- A reset is only reported successful after every migration, seed, hardening,
  and System Owner bootstrap step completes; incomplete runs never print a
  success summary.

## Uploaded files

The schema reset does not touch the filesystem `uploads/` tree. Before reset,
inventory and, if required, separately archive/quarantine tenant uploads using
the existing tenant-ownership evidence; never delete files that are not proven
to belong to the reset tenants.

## Windows verification (Phase 1)

The safety gate is unit-tested (13 tests, fail-closed for missing/incorrect
authorisation, wrong database, missing backup, wrong user, invalid port,
identity mismatch, read-only server). The reset itself reuses the already-verified
guarded rebuild and System Owner bootstrap. The System Owner bootstrap scripts
are `jupiter_db`-specific by design and are exercised against `jupiter_db`, not
a differently-named disposable database.
