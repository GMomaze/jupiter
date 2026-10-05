# MP2-R4-3 Controlled Non-Production Recovery Rehearsal - Preflight

**Document ID:** JUPITER-MP2-R4-3-RECOVERY-PREFLIGHT

**Revision:** 1.6

**Status:** DISPOSABLE SYSTEM OWNER BOOTSTRAP COMPLETE; FIXTURE CREATION AUTHORIZATION REQUIRED

**Reviewed:** 2026-09-16

## 1. Scope and fixed target contract

This record defines a future rehearsal; it authorizes no backup, restore,
database/file mutation, fixture creation, application start or cleanup.

- **Source database:** exact guarded `jupiter_test`, proven live as database
  and runtime user `jupiter_test` under `NODE_ENV=test`. It must contain only
  the separately authorized disposable R4 fixtures before capture.
- **Restore database:** exact `jupiter_r4_restore` on the same explicitly named
  non-production PostgreSQL host/port. It must be newly created or proven empty
  and must not be production, `jupiter_test`, or the configured development
  database. Dedicated restore/admin credentials are injected outside source.
- **Restore runtime:** `NODE_ENV=development` with explicitly injected database
  variables naming only `jupiter_r4_restore`. `NODE_ENV=test` is prohibited
  because the repository intentionally reloads `.env.test` and pins
  `jupiter_test`.
- **Restore file-root parent:** exact future path
  `C:\Users\User\AppData\Local\Temp\jupiter-r4-3-restore`. Its five children
  are `aircraft`, `manufacturers`, `manufacturer-quarantine`,
  `sb-import-quarantine`, and `sb-import-ephemeral`. Execution must prove the
  parent is absent or empty, resolve every child under that parent, and refuse
  links/reparse points or path escape.
- **Backup/evidence parent:** exact future path
  `C:\Users\User\AppData\Local\Temp\jupiter-r4-3-evidence`, with a unique
  approved backup-set ID below it. It must not pre-exist for that ID.

These paths are targets, not existing approved data. Execution must stop if
the OS temporary root resolves differently, either path is occupied, or the
database host/port and roles are not explicitly authorized.

## 2. Production-safety and identity gates

Before any mutation, record and compare live `current_database`, `current_user`,
`session_user`, server address and port against the separately authorized
source/restore manifest. Require exact source `jupiter_test`/`jupiter_test` and
exact restore `jupiter_r4_restore`; reject known production/development database
identities. Resolve the configured host to the live server address. Confirm no
production credential, URL, file root or secret is present.

Require guarded/test ledger head
`603_remove_deferred_last_admin_enforcement.ts`, exact ordered ledger and the
verified 582-603 migration-file hashes. Stop on drift; do not migrate or repair
inside the rehearsal. Fix an immutable application artifact/hash from the
clean-build source. Current HEAD is
`bad68aa8976c83e3d26cec1c2f1aceaaebfa6597`, but the dirty working tree is not
itself an immutable artifact and must not be used without a separately captured
content manifest/checksum.

The source application and in-process scheduler must be stopped and writer
quiescence proven before capture. Restore startup requires
`SB_SYNC_CRON_ENABLED=false` and `SB_SYNC_RUN_ON_BOOT=false`; scheduler remains
off throughout verification. Non-production secrets are injected outside
source, unique to this rehearsal, and never recorded in evidence.

## 3. Recovery-set definition

One backup-set ID links:

1. a full PostgreSQL custom-format `jupiter_test` archive;
2. complete captures of all five source-configured file roots;
3. source live identity, UTC quiescence/capture timestamps and fixture marker;
4. quoted `public."SequelizeMeta"` ordered ledger and migration file hashes;
5. immutable application artifact/content-manifest identity, Git HEAD,
   package-lock SHA-256, runtime and PostgreSQL tool versions;
6. a redacted configuration-name/storage mapping with no secret values;
7. component inventory, byte counts, SHA-256 hashes and checksum sidecars; and
8. custody, operator, authorization and integrity/listing results.

`pg_restore --list` or an approved equivalent must validate archive readability
before restore. Missing/zero unexpected components, hash mismatch, mixed
backup-set IDs or timestamp ambiguity are stop conditions.

RPO evidence is the interval between the latest fixture-change timestamp that
must be recoverable and the successful quiesced backup timestamp. PASS requires
that exposure to be no more than the 1-hour objective.

## 4. Disposable fixture contract

The source set must contain clearly non-production markers and deterministic
IDs for one HUMAN System Owner; Tenant A ACTIVE and Tenant B SUSPENDED; one
Company ADMIN per tenant; representative staff and Customer Portal identities;
tenant-owned records and aircraft files for both tenants; shared-master records
and files; the exact bounded `SB_SYNC_SCHEDULER` SERVICE principal/grant state;
and representative immutable platform and membership audit evidence. Record
counts and non-sensitive fingerprints before backup. No real identity,
credential, customer payload or production file may be used.

Fixture creation and later source cleanup require separate execution authority.
The restore must preserve the fixture state; it must not bootstrap, provision,
seed, migrate or repair missing evidence.

## 5. Restore acceptance checks

- **Database:** exact ledger/order/hashes; expected fixture counts and
  fingerprints; System Owner/SERVICE principals and exact grants; tenant
  lifecycle; sessions where expected; audit tables/triggers and representative
  immutable history.
- **Isolation:** A can access only A; B cannot establish active tenant/customer
  context while suspended; bidirectional foreign identifiers return neutral
  refusal; tenant ADMIN remains tenant-local.
- **Files:** all referenced tenant/shared files match captured hashes and stay
  within their configured roots; cross-tenant, orphan, substituted, traversal
  and reparse-point cases fail; report unexpected unreferenced files without
  deleting them.
- **Lifecycle:** A operates; B remains denied; a separately authorized
  reinstate/re-suspend check preserves B's data and returns it to the restored
  suspended state.
- **Platform:** HUMAN authority and immutable audit survive; scheduler SERVICE
  has only `SERVICE_BULLETIN_SYNC_EXECUTE`; scheduler stays disabled; no excess
  principal/capability/grant exists.
- **Application:** start only the matching artifact against
  `jupiter_r4_restore`; require bounded `GET /health/live` and
  `GET /health/ready`; retain privacy-safe events and no secrets/payloads.

## 6. RTO measurement

The RTO clock starts when the rehearsal declares the source recovery event and
begins the controlled response, before backup-set selection/restore work. It
stops only when archive/file integrity, restore, matching application startup,
health/readiness, authority/lifecycle, file consistency and two-tenant
isolation all PASS and the target is declared recoverable. Record monotonic and
UTC start/end timestamps, phase durations, failures/retries and total elapsed
time. PASS against the 4-hour objective is evidence, not a guarantee.

## 7. Exact later execution sequence and stop gates

1. **Preflight:** approve operator, source/target identities, artifact,
   fixture manifest, tools and paths; prove live identities, target emptiness,
   root containment, scheduler-off state and writer quiescence. Stop on any
   unknown or mismatch.
2. **Backup:** start RTO evidence, capture database and five roots under one
   backup-set ID without exposing secrets. Stop on writer activity or partial
   capture.
3. **Integrity:** inventory/hash every component and validate archive listing.
   Stop on mismatch; do not retry or overwrite.
4. **Restore:** create/use only approved empty `jupiter_r4_restore` and five
   empty target roots; restore database then files. Never reset, merge, seed,
   migrate or repair.
5. **Startup:** inject isolated configuration and matching artifact; keep
   scheduler disabled; start through the controlled process and check health.
6. **Verification:** execute only section 5 checks and compare pre/post
   counts/fingerprints. Stop at first substantive failure.
7. **Objectives:** calculate backup age/RPO exposure and complete RTO timing;
   retain the redacted evidence bundle and decision.
8. **Cleanup:** stop the restore process, reconfirm exact live database identity
   and resolved target paths, then remove only the named restore database and
   unique restore-root tree under separate cleanup authority. Re-query database
   absence, verify target-root absence, and confirm source `jupiter_test`,
   source roots, backup evidence and workspace are unchanged. Never use a broad
   reset/clean command.

## 8. Execution-time prerequisites and blockers

Before execution authorization, the Project Owner must approve the exact
non-production host/port, source and restore roles, manual PostgreSQL/file-copy
toolchain, immutable application artifact/content manifest, fixture-creation
and cleanup authority, and exact backup-set ID. The restore database and target
directories do not yet exist or have proven-empty evidence. No repository-
backed backup/restore orchestration or automated database-to-file
reconciliation exists; the approved manual procedure is mandatory. These are
execution preconditions, not permission to improvise.

## 9. Exact next gate

Project Owner authorization for **MP2-R4-3 controlled non-production Recovery
Rehearsal execution** using the exact supplemental manifest below and an
instantiated backup-set ID. MP2-R4-3 is not yet executed or verified; MP2-R4-4
has not begun.

## 10. Supplemental execution manifest

The 2026-09-16 read-only resolution established this exact local
non-production execution contract. It performed no database, role, process or
file mutation.

### Database and tool identities

- Approved endpoint for the next authorization: `127.0.0.1:5432`. Both test
  and local development configuration name it, and live source/admin queries
  resolved to `127.0.0.1/32:5432`; no conflicting endpoint was found.
- Source database and role: `jupiter_test` / `jupiter_test`. The role owns the
  source database and is neither superuser nor `CREATEDB`.
- Restore database: exact `jupiter_r4_restore`, currently absent.
- Restore/database-creation, database-owner and archive-owner role:
  `postgres`. A read-only localhost connection proved that existing role is
  login-enabled, superuser and `CREATEDB`. Source objects are owned by
  `postgres` (83 relations and 14 functions) or
  `jupiter_governance_owner` (one relation and seven functions); restore must
  preserve those owners and must not use `--no-owner`.
- Restore application runtime role: existing non-superuser `jupiter_app`.
  Application startup must prove `current_user = session_user = jupiter_app`.
- Manual toolchain: installed PostgreSQL 17 `pg_dump`, `pg_restore` and
  `psql`, plus native PowerShell file inventory/copy and SHA-256 commands.
  Tool versions are recaptured in the evidence bundle before use.
- Ledger expectation: exactly 117 ordered entries with head
  `603_remove_deferred_last_admin_enforcement.ts`.

The existing repository `.env` is marked `NODE_ENV=production` and must not be
loaded wholesale or treated as rehearsal configuration. Credentials are
injected outside source. The explicit non-secret restore identity is
`NODE_ENV=development`, `DB_HOST=127.0.0.1`, `DB_PORT=5432`,
`DB_NAME=jupiter_r4_restore`, `DB_USER=jupiter_app`,
`DB_ADMIN_USER=postgres`, `PORT=3000`, `SB_SYNC_CRON_ENABLED=false`, and
`SB_SYNC_RUN_ON_BOOT=false`, plus the five restore roots below. Secret values
must be unique non-production values and must not enter evidence.

### Exact source and restore file roots

No file-root override is present in current configuration, so repository
fallbacks are authoritative. The two public roots exist as ordinary
directories with respectively 12 files / 2,741,361 bytes and 63 files /
2,172,687 bytes; the three private roots are absent and therefore represent
empty components. Recursive inspection found zero reparse entries.

| Purpose | Exact source root | Exact restore root |
| --- | --- | --- |
| Aircraft files | `C:\GMO\Projects\jupiter\uploads\aircraft` | `C:\Users\User\AppData\Local\Temp\jupiter-r4-3-restore\aircraft` |
| Manufacturer public files | `C:\GMO\Projects\jupiter\uploads\manufacturers` | `C:\Users\User\AppData\Local\Temp\jupiter-r4-3-restore\manufacturers` |
| Manufacturer quarantine | `C:\GMO\Projects\jupiter\.jupiter-private-uploads\manufacturer-logos` | `C:\Users\User\AppData\Local\Temp\jupiter-r4-3-restore\manufacturer-quarantine` |
| SB import quarantine | `C:\GMO\Projects\jupiter\.jupiter-private-uploads\service-bulletins` | `C:\Users\User\AppData\Local\Temp\jupiter-r4-3-restore\sb-import-quarantine` |
| SB import ephemeral work | `C:\GMO\Projects\jupiter\.jupiter-private-uploads\service-bulletin-work` | `C:\Users\User\AppData\Local\Temp\jupiter-r4-3-restore\sb-import-ephemeral` |

The exact evidence parent is
`C:\Users\User\AppData\Local\Temp\jupiter-r4-3-evidence`. Execution must
repeat absolute-path, containment and recursive reparse checks before capture
and restore. Any changed, occupied or unsafe target is a STOP.

### Writer-quiescence proof

The only repository-established background writer is the in-process Service
Bulletin scheduler started by `src/server.ts`; tests, migration commands and
operator database clients are additional possible writers. Before the RTO
start/capture, execution must:

1. stop the Jupiter source application through its `SIGINT`/`SIGTERM` graceful
   shutdown and record closure of HTTP, Sequelize and PostgreSQL pools;
2. prove no Jupiter `node.exe` process and no listener on port 3000 remains;
3. prohibit tests, migrations, seeds, imports and operator write sessions;
4. query `pg_stat_activity` and prove zero other `jupiter_test` sessions or
   transactions, excluding only the short-lived verifier connection;
5. record `SB_SYNC_CRON_ENABLED=false` and `SB_SYNC_RUN_ON_BOOT=false` for the
   restore; and
6. hash/inventory all five source roots immediately before and after capture;
   any difference aborts the backup.

At manifest resolution there were zero other `jupiter_test` sessions and no
port-3000 listener. Execution must establish fresh evidence rather than reuse
that observation.

### Application/content identity

Branch `main`, HEAD
`bad68aa8976c83e3d26cec1c2f1aceaaebfa6597`, and a dirty worktree are recorded;
HEAD alone is explicitly insufficient. The current deterministic runtime-input
set is the sorted union of tracked and non-ignored untracked regular files
under `src/` and `migrations/`, plus `package.json`, `package-lock.json` and
`tsconfig.json`. Each canonical manifest row is
`<slash-normalized-relative-path><two spaces><lowercase-SHA-256>`, UTF-8 with
LF, sorted ordinally and terminated by LF. Current identity is 749 files (451
tracked, 298 untracked; 284 dirty) with aggregate SHA-256
`978a7c0b9806adc883db4e184d838fbdf9555f77aa74ce2516ee588d6306ef18`.

Package identities are `package.json`
`57163d77af838e9a5a0885d312fa592469805dd12224b7add08f308ce48ab872`,
`package-lock.json`
`964c81ad912d79efa89e698b1901d82ac5d639e5740c2e0056cd7faedc254597`,
and `tsconfig.json`
`4eae665ed9d6c69449acb0d0326326c8b4d63b6d1f437583f6dcd1f2fa65e9ee`.
The existing `dist/` tree has 2,124 files and aggregate SHA-256
`3f88c5f74d9114c47d01fe84e76bd32ac71c7f4e818d4998bca18f2b3880e778`,
but it is not a standalone immutable artifact.

At execution, regenerate the canonical runtime manifest and require the exact
aggregate above. Then archive exactly that manifest-listed content into the
unique evidence directory, hash the archive and its manifest, and use only a
manifest-matching extracted copy for restored startup. Dependency identity is
the exact lockfile hash above. Any content/hash drift, missing manifest member,
extra runtime input, failed archive verification or startup outside the
manifest-matching copy is a STOP; do not rebuild or silently refresh it.

### Migration 582-603 SHA-256 contract

```text
582 802db29c25c8553223adabda91e4c7382bf596584fc41fda09becc1567977c83
583 f785536f0ca336bb8779adc87a8f9382f8e65da92fa30db7bf2e44f10cb8ffde
584 7983f0269e88645658288bc9f5301c2ad22e210d5c33990c67667c0a57ac13cb
585 80581bdd6825323f295e4281f33efcbeaacdd6b0e8a1ee25da1a8bb92ce40086
586 430a9c39932e7c033b4bdd6ebc9b4a262b7698ef7011e48485a533e899a112ef
587 cbd20aa73048fe06b714efda3eb874d4fe7a04fe155c86156dfd536fe4f593fe
588 cd97720881e728c62923b724ea65b15db3e9b84630696277686e40d20e7ef333
589 e9578b70e26cb32058b10b78cbb340f2cda05f3ebec1efa254f8175ac2aed72a
590 bd7a301aedc28c3d6b1acfb179d3f5048bf721399b84fbac3d4511e361f43edb
591 572a6a87e1f9386c20565fb84ba484f30e6f3a05badb3195137bafd154a22264
592 2bcf230df518af9eccd33ece7ce1b9b128eef26407f817b7973c1420daee0265
593 8f8d3af4318f709292368845d6a1ed024add4de3c557a96719199e6b6c3d58a5
594 e56cc2840e0c9839b5fb9144f51644eccb385d8b4a64858a034317394722bb6f
595 1e7069d25ef5247ebf047b5a8b293f2fefeccbb6a6c6cecabf6b6b9b7ec33c5d
596 d44f49259eef61614a01a2f3eeaf8ae06e4816ddc18fc61f6ab1a406dda0cce9
597 cc2ad7765b9ea6e2604182813f8f591074bdb6c1ae47af195e8ab5be4ed4e8f9
598 17e6b692af0625c7dac72cf22e885718649bbfdccc6960fc1e2bc6ca156f09ce
599 543972a026de9008ee987e405e6ead3651fb791c6a11c6256c98dccbaa69faba
600 f27aa83fd86f5cc96bc6aea1bd73872352071d53d79fe51a4d84026216d4de90
601 6304d6ade488f4aa1944cd31faf5ceca7867ab5efee7dbe1a2fded81229ffa29
602 a84c5f2aa3cc5b11a25978560c67a71c4d3804037c8545a2254225174d947548
603 20572bc475764f94b02b4ee0f15cbc7038ae1b732524885a2f6b44786565ea13
```

### Backup-set identity and global STOP conditions

The deterministic unique format is
`MP2-R4-3-<UTC-YYYYMMDDTHHMMSSZ>-978a7c0b9806`. The next execution
authorization must instantiate and approve one exact value; its directory must
not pre-exist below the evidence parent. The timestamp is the recorded RTO
start, in UTC to whole seconds.

STOP before mutation on any endpoint, database, role, ledger, migration,
content, tool, configuration, root, reparse, target-occupancy, secret-class,
writer-quiescence or backup-set mismatch. Also STOP if `postgres` cannot create
and own the isolated database while preserving archive owners, if runtime is
not exact non-superuser `jupiter_app`, if current `.env` would be loaded, or if
production/development/source resources could be affected.

All values required for a new target-specific execution authorization are now
established without guessing. Cleanup remains separately gated.

## 11. Controlled execution attempt

Execution attempt `MP2-R4-3-20260916T183650Z-978a7c0b9806` stopped at the
pre-mutation gate. The endpoint, source identity, local `postgres`
administrative authority, absent restore/evidence targets, 749-file aggregate,
117-entry ledger/head 603 and migration 582-603 hashes matched. The external
test password and the separately stored local test-admin password both failed
to authenticate the required `jupiter_app` restore runtime role (`28P01`). The
only other configured `jupiter_app` credential belongs to the repository
`.env`, which is marked `NODE_ENV=production` and is prohibited by this
manifest and the execution authorization.

No backup/evidence directory, fixture, database, file copy, restore, process
shutdown or application startup occurred. The instantiated ID is reserved for
this blocked attempt and must not be replaced unless the attempt is formally
abandoned and a new execution is separately authorized. The exact next gate is
Project Owner authorization after an external non-production `jupiter_app`
credential is safely established and its availability can be proven without
using or changing the production-marked `.env`. Cleanup is not applicable
because no rehearsal residue was created.

## 12. Dedicated restore-runtime role alternative

Read-only investigation proved that mounted application runtime does not
require literal PostgreSQL login `jupiter_app`. The exact safe, database-local
authority design and disposable lifecycle for `jupiter_r4_app` are fixed in
[`MP2_R4_3_DEDICATED_RESTORE_RUNTIME_ROLE_DEFINE.md`](MP2_R4_3_DEDICATED_RESTORE_RUNTIME_ROLE_DEFINE.md).
No role, credential, grant, database, file or application mutation occurred.
The shared `jupiter_app` login remains untouched. The exact next gate is Project
Owner authorization for a newly identified R4-3 execution using the dedicated
role design; the prior blocked backup-set ID must not be reused.

## 13. Dedicated-role re-execution attempt

Execution attempt `MP2-R4-3-20260916T192859Z-978a7c0b9806` stopped before any
mutation because the approved representative fixture set was absent. The live
source had 402 tenants, all `ACTIVE`, but zero tenant memberships, membership
roles, Customer Portal identities, platform principals, platform capability
grants, platform audit rows and membership-authority audit rows. It therefore
had no Tenant A/Tenant B ADMIN boundary, no `SUSPENDED` lifecycle evidence, no
test System Owner, no bounded scheduler SERVICE authority and no required
immutable platform/membership audit evidence.

The endpoint/source identity, 749-file content identity and 117-entry ledger
through migration 603 matched. No `jupiter_r4_app` role, DPAPI secret,
`jupiter_r4_restore` database, backup/evidence directory, fixture, file copy or
restore was created. The normal `jupiter_app` and `jupiter_db` remained
untouched. The exact next gate is a separately bounded Project Owner
authorization to create the preflight-defined disposable fixtures in
`jupiter_test`, including safe source-fixture cleanup authority, before another
newly identified rehearsal execution. This blocked ID must not be reused.

## 14. Disposable fixture creation attempt

Fixture-set identifier `MP2-R4-3-FIXTURE-20260916T193141Z` was reserved, but
no fixture was created. Read-only repository inspection established that the
source has zero platform principals and grants. Every authoritative principal,
scheduler and tenant-lifecycle mutation requires repository-issued HUMAN
authority resolved from an already active principal and capability grant. The
only repository-supported first-authority path is the guarded initial System
Owner bootstrap. This fixture authorization expressly prohibited executing
that bootstrap.

Direct principal/grant inserts exist only inside rollback-isolated guarded
database tests; persisting that setup would bypass the authoritative first-
principal creation/audit chain and would not satisfy the fixture contract.
Fake direct audit insertion is also prohibited. Creation therefore stopped
before any database, credential, file or cleanup-manifest mutation. The exact
next gate is a Project Owner decision and bounded authorization either for a
disposable guarded initial System Owner bootstrap in exact `jupiter_test`, or
for an explicitly defined, independently verified fixture-root provisioning
mechanism. R4-3 execution remains blocked and R4-4 has not begun.

## 15. Disposable guarded System Owner bootstrap

The explicitly authorized guarded bootstrap completed against exact
`jupiter_test`. Fixture root `MP2-R4-3-FIXTURE-20260916T193141Z` now has one
uniquely marked active test user, one active HUMAN platform principal, exactly
the canonical `PLATFORM_AUTHORITY_MANAGE` and `PLATFORM_AUDIT_VIEW` grants, and
one immutable `SYSTEM_OWNER_BOOTSTRAPPED` audit. Repository resolution issued
HUMAN authority and independently authorized both capabilities.

The operation preserved all 402 pre-existing tenants, created no membership,
and left the ledger at 117 entries/head 603. No schema, migration, scheduler,
tenant fixture, backup, restore or other rehearsal action occurred. Exact
non-secret identifiers and later cleanup constraints are recorded in
[`MP2_R4_3_FIXTURE_CLEANUP_MANIFEST.md`](MP2_R4_3_FIXTURE_CLEANUP_MANIFEST.md).
This is a disposable `jupiter_test` prerequisite, not a real or production
System Owner bootstrap. The exact next gate is Project Owner authorization for
the remaining bounded disposable recovery fixture set. R4-4 has not begun.
