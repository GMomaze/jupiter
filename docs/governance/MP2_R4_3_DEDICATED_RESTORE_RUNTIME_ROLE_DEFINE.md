# MP2-R4-3 Dedicated Restore Runtime Role - DEFINE

**Document ID:** JUPITER-MP2-R4-3-DEDICATED-RESTORE-RUNTIME-ROLE

**Revision:** 1.0

**Status:** DEFINE PASS; READY FOR PROJECT OWNER AUTHORIZATION

**Reviewed:** 2026-09-16

## Decision

**A. DEDICATED RESTORE ROLE SAFE.** A disposable login role named
`jupiter_r4_app` can run the isolated `jupiter_r4_restore` application without
changing or authenticating as the shared `jupiter_app` role. This conclusion
authorizes no mutation.

## Identity dependencies

Mounted runtime code does not require literal PostgreSQL identity
`jupiter_app`. `src/server.ts` rejects a superuser, then logs
`current_user/session_user`; `src/app.ts` also observes `current_user` without
authorizing from its value. Application tenant, platform and audit authority is
derived from authenticated application identities and persisted authority
records, not the PostgreSQL login name.

Exact-name checks are confined to non-runtime boundaries:

- guarded test preparation requires exact `jupiter_test`;
- migration execution requires exact `postgres`;
- migration and privilege-baseline definitions name `jupiter_app` when
  installing/verifying ACLs; and
- migrations 582-584 grant two component-life governance entry functions to
  `jupiter_app`, but those function bodies do not test the invoker name.

The rehearsal applies no migration. Future migration execution as
`jupiter_r4_app` is prohibited because hard-coded migration ACL installation
would not maintain that disposable role.

## Exact restored runtime authority

Read-only inspection of the migration-603 `jupiter_test` source established
that `jupiter_app` owns zero public objects and has no membership in
`jupiter_governance_owner`. Its explicit runtime ACL is:

- database: the restore role needs `CONNECT` only on
  `jupiter_r4_restore`; it needs neither database `CREATE` nor `TEMPORARY`;
- schema: `USAGE` on `public`, without `CREATE`;
- 78 ordinary tables: `SELECT, INSERT, UPDATE, DELETE`;
- `aircraft_component_movement_history`: `SELECT, INSERT` only;
- `tenant_membership_authority_audit`: `SELECT, INSERT` only;
- `staff_invitations`: `SELECT, INSERT, UPDATE` only;
- `tenants`: `SELECT, INSERT, UPDATE` only;
- `vw_component_status`: `SELECT` only;
- `component_life_limit_governance_transition_gate`: no privilege;
- sequences: no privilege (none exist in the source public schema); and
- functions: `EXECUTE` only on
  `fn_cllg_decide_proposal(uuid,uuid,character varying,text,boolean)` and
  `fn_cllg_activate_publication(uuid,uuid,text)`.

The source ACL also contains PostgreSQL 17 `MAINTAIN` on `rf_permission` and
`rf_role_permissions`, inherited from historical `ALL` grants. No runtime code
uses maintenance operations, so this is not required and must not be granted
to the disposable role. Trigger functions need no invoker `EXECUTE`; the five
protected component-life trigger functions remain denied. Default privileges
are unnecessary because the rehearsal creates no schema objects.

The 78-table set is exactly the source relations on which `jupiter_app` has all
four CRUD privileges after excluding the six specially constrained relations
listed above. A later authorized grant procedure must enumerate the restored
catalog and prove the resulting per-object matrix equals this contract; it
must not use `GRANT ALL` or table ownership as a shortcut.

## Security and recovery implications

- Tenant isolation and platform authority are unchanged because the dedicated
  role receives the same database CRUD boundary and application predicates,
  persisted principals and capability grants remain authoritative. No RLS is
  present or claimed.
- Immutable audit/history protection remains in database triggers. The
  dedicated role retains only the source runtime insert/read ACL on the two
  specially restricted history tables and receives no transition-gate access.
- Restore ownership remains `postgres` and `jupiter_governance_owner` exactly
  as archived. `jupiter_r4_app` owns no database, schema, relation, function or
  sequence and cannot `SET ROLE` to either owner.
- `jupiter_r4_app` must be non-superuser, `LOGIN`, `NO CREATEDB`,
  `NO CREATEROLE`, `NO REPLICATION`, `NO BYPASSRLS`, `NOINHERIT`, no
  memberships and no grant option.
- Existing `jupiter_test` and `jupiter_db` revoke public database connection,
  so a newly created role has no connection to either unless explicitly
  granted; no such grant is permitted. The cluster `postgres` database retains
  ambient public `CONNECT`, but the role receives no object or schema grant
  there. This does not alter normal development; a later execution must verify
  zero effective application-object access outside `jupiter_r4_restore`.
- Production safety accepts non-production `NODE_ENV=development` without a
  literal runtime username. Restore startup still must prove exact database
  `jupiter_r4_restore`, exact login/session identity `jupiter_r4_app`,
  non-superuser state and scheduler disabled.

## Minimal separately authorized lifecycle

1. Reconfirm endpoint `127.0.0.1:5432`, role absence, target database identity
   and existing source/normal-development preservation.
2. As local `postgres`, create only `jupiter_r4_app` with the safe attributes
   above and a strong random SCRAM credential. Store it only in a user-DPAPI
   protected file outside the repository; never expose it.

   Windows PowerShell compatibility requires an instantiated cryptographic RNG;
   the installed runtime does not support the static
   `RandomNumberGenerator.Fill` API. Generate the existing 48-byte requirement
   with `RandomNumberGenerator.Create()`, call `GetBytes(byte[48])`, dispose the
   generator, Base64-encode the result, and pass it directly through
   `SecureString`/`PSCredential` to `Export-Clixml`. Never emit the plaintext.
3. Create/restore `jupiter_r4_restore` under the already approved restore
   owners. Do not make `jupiter_r4_app` an owner.
4. Revoke any ambient target-database authority not in this contract; grant
   target `CONNECT`, public-schema `USAGE`, the exact table/view privileges and
   the two entry-function executions above. Grant no default privilege,
   ownership, membership or grant option.
5. Prove the exact per-object matrix, zero transition-gate/trigger-function
   access, zero ownership/membership, inability to connect to `jupiter_test`
   and `jupiter_db`, and no application-object access outside the restore.
6. Start only the isolated restored application using external non-production
   configuration and the DPAPI credential; run the existing R4-3 acceptance
   boundary without migrations.
7. Retain the role and secret with the restore evidence until separately
   authorized cleanup. Cleanup must stop the restored application, revoke/drop
   owned checks (expected zero), drop exact role `jupiter_r4_app`, remove only
   its exact DPAPI secret, and prove absence without touching `jupiter_app`.

## Next gate

Project Owner authorization for bounded creation/configuration of the
disposable `jupiter_r4_app` role as part of a newly authorized R4-3 execution,
with a new backup-set ID. The historical blocked ID remains closed. R4-3 is not
complete or verified; R4-4 has not begun.
