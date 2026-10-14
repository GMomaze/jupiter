# Operational Role Initialization (JUP-005)

## Problem

Company onboarding was blocked because `rf_role` contained no `ADMIN` role on a
production-style install. Company provisioning requires exactly one row:

```sql
SELECT id FROM rf_role WHERE code='ADMIN' LIMIT 2;  -- must return exactly 1 row
```

(`src/modules/tenancy/tenant-lifecycle-command.repository.ts`)

## Root cause

The seven operational roles (`ADMIN`, `ENGINEER`, `MECHANIC`, `SUPERVISOR`,
`QA`, `PLANNER`, `VIEWER`) were initialized only by the destructive,
development-only seeder `seeders/010_reference_seeds.ts` (`seedOperationalRoles`).
No migration created them. The production install path is migrations only
(`src/scripts/migrationRunner.ts` -> `db:migrate`) plus System Owner bootstrap;
seeders are never run (and `db:seed` is blocked). A fresh or partially rebuilt
database therefore gains no operational roles.

`ADMIN` is a genuine global reference role that also doubles as a tenant-local
membership role (`tenant_membership_roles.role_id -> rf_role.id`). It is the
correct required role code; provisioning does not reference the wrong model.

## Permanent repair

`migrations/623_seed_operational_roles.ts` initializes the seven operational
roles idempotently and non-destructively, following the migration-581
`restoreDedicatedReferenceRoles` pattern:

- `INSERT ... ON CONFLICT (code) DO NOTHING` — repeated runs create no duplicates.
- Fails closed (rolls back) on any existing role with conflicting metadata.
- Reconciles that every role exists exactly once with canonical metadata
  (`description = NULL`, `is_active = true`, `system_locked = true`).
- `down` is intentionally non-destructive (deleting operational roles would
  cascade membership/role-permission authority records).

## Applying to an existing database (e.g. the Ubuntu jupiter_db)

1. Obtain Project Owner authorization for the named target.
2. Run the guarded production migration (postgres identity, exact target
   database, `ALLOW_UNIFIED_DATABASE_MIGRATION=YES`). This applies migration
   `623_seed_operational_roles` and seeds the missing operational roles without
   touching existing users, tenants, memberships, grants, or audit records.
3. Verify: `SELECT id, code FROM rf_role WHERE code='ADMIN';` returns exactly one
   row, then re-run the blocked company onboarding.

Do not run the destructive reference seeder `seeders/010_reference_seeds.ts`
against an operational database (JUP-002); its bulk-delete clean phase removes
existing operational data.
