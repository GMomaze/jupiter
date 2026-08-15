# Governance ownership repair administrator preparation

Migration 582 never creates, alters, or drops PostgreSQL cluster roles. A database owner must prepare the dedicated role separately after reviewing the commands.

## First-time preparation (do not run automatically)

```sql
BEGIN;

CREATE ROLE jupiter_governance_owner
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

REVOKE jupiter_governance_owner FROM jupiter_app;
REVOKE jupiter_governance_owner FROM jupiter_test;

COMMIT;
```

If the role may already exist, do not run `CREATE ROLE` or an unconditional `ALTER ROLE`. Run this verification query first and obtain owner approval before correcting any mismatch:

```sql
SELECT
  r.rolname,
  r.rolcanlogin,
  r.rolsuper,
  r.rolcreatedb,
  r.rolcreaterole,
  r.rolinherit,
  r.rolreplication,
  r.rolbypassrls,
  pg_catalog.pg_has_role('jupiter_app', r.oid, 'SET') AS jupiter_app_can_set_role,
  pg_catalog.pg_has_role('jupiter_test', r.oid, 'SET') AS jupiter_test_can_set_role
FROM pg_catalog.pg_roles r
WHERE r.rolname = 'jupiter_governance_owner';
```

The query must return exactly one row with every boolean column `false`.

## Guarded positive test

Place administrator credentials only in ignored `.env.test.local`:

```text
DB_ADMIN_USER=<administrator>
DB_ADMIN_PASSWORD=<administrator secret>
ALLOW_GOVERNANCE_OWNERSHIP_TEST=YES
```

Do not commit this file. Do not persist `RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST` in any environment file. The harness also requires the existing `.env.test` safety values, verifies the live target is `jupiter_test`, rejects runtime identities, and never creates, alters, or drops the owner role.

Run:

```powershell
npm.cmd run test:governance-ownership-positive
```

The dedicated npm command supplies `RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST=YES` to that process only. Both that invocation flag and the persistent `ALLOW_GOVERNANCE_OWNERSHIP_TEST=YES` preparation flag are required exactly and case-sensitively. Missing, blank, lowercase, or different values skip the test. Ordinary `npm.cmd test` explicitly sets the invocation flag to `NO`, so ignored local configuration cannot activate the destructive harness during a normal suite. The ordinary missing-owner test remains the default fail-closed verification.

## Positive harness lifecycle

The owner must separately approve the initial guarded `jupiter_test` schema reset and the reset performed by the harness's unconditional restoration. The harness never targets `jupiter_db` and never creates, alters, or drops a PostgreSQL role.

After the approved initial reset, the harness:

1. requires both exact ownership-test flags, including the process-scoped invocation flag, the exact test safety flags, `DB_ADMIN_USER=postgres`, a nonblank administrator password, and explicit host/port;
2. verifies runtime `jupiter_test` and administrator `postgres` reach the same server address and configured port, with both connected to `jupiter_test`;
3. internally records migration 582 for separate execution, runs ordinary migrations and seeds as `jupiter_test`, and verifies ordinary ownership;
4. runs migration 582 directly as `postgres`;
5. verifies that migration 582 grants the governance owner schema `USAGE` required by its security-definer functions and explicitly withholds schema `CREATE`;
6. grants `jupiter_test` test-only `EXECUTE` on only the proposal-decision and publication-activation entry functions;
7. verifies gate denial, trigger-function denial, function ownership, fixed search paths, and entry-function ACLs;
8. runs real approval, activation, and gate-forgery regression workflows through `jupiter_test`.

In an unconditional `finally`, the harness narrowly returns the gate and seven functions to `jupiter_test` so the guarded reset can run, resets the public schema as `jupiter_test`, reruns ordinary migrations and seeds as `jupiter_test`, reapplies migration 582 as `postgres` (including governance-owner `USAGE` and no `CREATE`), reapplies only the two test entry-function grants, and verifies the ledger, seeds, ownership, ACLs, and zero governance workflow fixtures.

If both the workflow and restoration fail, the harness reports both errors while preserving the original workflow failure. The final guarded test state keeps ordinary objects owned by `jupiter_test`, the transition gate and seven governed functions owned by `jupiter_governance_owner`, and test-only execution for `jupiter_test` on the two entry functions. It grants no gate access, trigger execution, owner-role membership, or broad table/schema privileges.
