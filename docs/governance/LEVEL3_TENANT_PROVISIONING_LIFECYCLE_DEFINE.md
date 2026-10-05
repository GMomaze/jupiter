# Level 3 — Tenant Provisioning and Lifecycle Administration DEFINE

**Document ID:** JUPITER-L3-TENANT-LIFECYCLE-DEFINE

**Revision:** 1.0

**Status:** Canonical DEFINE / INVESTIGATE complete

**Reviewed:** 2026-09-14

## 1. Objective and established foundation

Level 3 provides the shortest safe path for a repository-authorized HUMAN
Platform/System Owner to provision, activate, suspend, and reinstate a tenant.
Suspension is an access and execution boundary, never deletion: tenant-owned
rows, identifiers, history, relationships, files, memberships, and audit
evidence remain in place and other tenants remain unaffected and unaware.

Reuse without reopening Level 1 or Level 2:

- `tenants` already has immutable identity, `PROVISIONING`, `ACTIVE`,
  `SUSPENDED`, and reserved `ARCHIVED` states, suspension metadata, and
  restrictive ownership foreign keys;
- tenant memberships and roles, active-tenant selection, fresh per-request
  tenant/membership revalidation, route-local tenant authority, tenant-scoped
  repositories, and mounted Level-1 gates already exist;
- Customer Portal identity resolution already joins the owning tenant and
  requires `tenants.status = 'ACTIVE'` on every authority resolution;
- tenant-owned upload delivery already depends on active tenant authority and
  leaves persisted files in place when access is denied;
- Level 2 already supplies repository-issued HUMAN/SERVICE principals,
  granular persisted grants, transaction-time capability revalidation,
  immutable platform-global audit, and guarded one-time System Owner bootstrap;
- shared SB synchronization is platform-global and remains unaffected;
  dormant maintenance/projection writers remain fail closed.

The existing first-organisation provisioning repository is useful transaction,
normalization, locking, and conflict evidence, but is not a Level-3 authority
boundary: it creates a tenant directly as `ACTIVE`, creates no initial tenant
role, uses user identity rather than PlatformAuthority, and writes legacy audit.
It must be replaced or narrowly adapted behind the Level-3 boundary, not exposed
as an alternate writer.

## 2. Exact scope and lifecycle contract

Level 3 includes:

1. Platform listing/detail sufficient to identify a tenant and see lifecycle
   state without exposing another tenant's operational data.
2. Transactional provisioning of a `PROVISIONING` tenant, one existing active
   initial staff user, an ACTIVE membership, and an active tenant-local ADMIN
   membership role. Provisioning does not grant platform authority and does not
   make the tenant accessible.
3. Activation only from `PROVISIONING`, after revalidating the tenant,
   initial active ADMIN membership/role, required schema, and uniqueness.
4. Suspension only from `ACTIVE`, with mandatory nonblank reason and server
   time/actor metadata. It preserves all tenant data and denies new tenant work.
5. Reinstatement only from `SUSPENDED`, clearing current suspension metadata
   while retaining immutable before/after platform audit history. Memberships
   retain their individual states; reinstatement does not reactivate a disabled
   or suspended membership.
6. A single lifecycle command repository/service and mounted Platform/System
   Owner administration boundary using exact transition operations, live
   capability revalidation, tenant-keyed serialization, atomic mutation/audit,
   neutral unavailable/conflict responses, and idempotent retry semantics.
7. Suspension enforcement for staff, tenant ADMIN, Customer Portal, tenant file
   delivery/mutation, and any tenant-scoped scheduled/background execution.

Canonical transitions are:

`PROVISIONING -> ACTIVE -> SUSPENDED -> ACTIVE`

No other transition is authorized. `ARCHIVED` remains a reserved fail-closed
state and is not a Level-3 command. A suspended tenant cannot be selected, issue
tenant authority, use tenant ADMIN powers, authenticate into Customer Portal,
read or mutate tenant files/data, or start tenant background work. Existing
staff/customer session records may remain, but every subsequent protected
request revalidates current tenant state and is denied; stale staff context is
cleared by the existing middleware. Reinstatement permits eligible users to
authenticate/select again and never silently restores a membership state.

Suspension becomes authoritative at commit. To prevent an in-flight tenant
request from crossing that boundary, all mounted tenant work, Customer Portal
work, tenant file delivery, and tenant-scoped jobs must participate in one
tenant-keyed shared/exclusive advisory-lock protocol: tenant work holds a shared
lock for its protected execution; a lifecycle transition takes the exclusive
transaction lock. Suspension therefore waits for earlier work, commits only
after it drains, and later work observes the non-ACTIVE state. Rollback releases
the lock and leaves state/audit unchanged.

## 3. Exclusions and deferred features

- tenant deletion, purge, destructive archival, or data erasure;
- entering or restoring `ARCHIVED`;
- tenant transfer, ownership/custody movement, mergers, splits, or reassignment
  of any operational root; these require a separate data-movement programme;
- tenant limits, billing, metering, storage/user quotas, plans, or entitlements;
- invitations, user creation, email delivery, password policy, or identity-
  provider provisioning; the initial staff user must already exist and be active;
- tenant-local membership lifecycle redesign or role-definition changes;
- Platform Principal/grant UI expansion beyond the lifecycle surface;
- RLS, which remains a later defence-in-depth stage because the verified
  application/repository isolation and proposed lifecycle gate are sufficient;
- changes to shared/reference-master access, global SB synchronization, or
  dormant writers;
- real System Owner bootstrap, SERVICE provisioning, production migration,
  deployment, or tenant creation as part of implementation/verification.

## 4. Authority and capabilities

Add four locked, active capabilities with HUMAN-only fixed operations:

| Capability | Exact operation |
|---|---|
| `TENANT_PROVISION` | `TENANT_PROVISION` |
| `TENANT_ACTIVATE` | `TENANT_ACTIVATE` |
| `TENANT_SUSPEND` | `TENANT_SUSPEND` |
| `TENANT_REINSTATE` | `TENANT_REINSTATE` |

Each mounted/direct command requires authentication, an active repository-
issued HUMAN PlatformAuthority, the exact grant, a nonblank reason, correlation
and source evidence, transaction-time revalidation, and atomic immutable
platform-global before/after audit. SERVICE principals, tenant memberships,
tenant-local ADMIN, legacy `user_roles`, request fields, and fabricated objects
cannot derive lifecycle authority. `PLATFORM_AUTHORITY_MANAGE` may grant/revoke
these capabilities but does not itself execute lifecycle commands.

## 5. Schema and migration requirements

One additive migration is required:

- seed the four locked capabilities, refusing conflicts or partial state;
- install an unconditional `BEFORE DELETE` tenant trigger that raises
  `TENANT_DELETION_PROHIBITED`, including for an empty tenant;
- replace/extend the tenant lifecycle trigger so only the canonical Level-3
  transitions and their required metadata shapes can occur, while allowing
  non-lifecycle tenant edits that preserve identity/status metadata;
- add no cascade and no tenant-owned-row rewrite;
- make DOWN refuse once any new capability grant/audit evidence exists and
  refuse removal of deletion/transition protection when tenant state is not
  provably compatible.

No ownership column, membership schema, session-table rewrite, file move, RLS,
or lifecycle-version column is required. Serialization uses the existing tenant
UUID and PostgreSQL advisory locks; immutable history uses the existing
platform-global audit table. Application database privileges must grant only
the exact tenant/membership/role reads and tenant insert/update operations used
by the authoritative repository, never tenant DELETE.

## 6. Shortest safe implementation slices and dependencies

### L3-1 — Lifecycle Capability, Persistence, and Coordination Foundation

Implement the migration, fixed lifecycle operation policy, shared/exclusive
tenant lock helper, lifecycle transition contracts, runtime privilege checks,
and focused migration/policy/lock tests. No route or tenant transition is
activated. This is the dependency for every later slice.

### L3-2 — Authoritative Provisioning and Lifecycle Command Boundary

Consolidate provisioning, activation, suspension, and reinstatement in one
repository/service/router because they share authority, tenant persistence,
locking, and atomic audit. Provisioning atomically creates the PROVISIONING
tenant plus initial active ADMIN membership/role. Transition commands lock and
re-read the tenant, reject invalid/stale transitions neutrally, and commit one
state change with immutable platform audit. Remove or close every alternate
provisioning/lifecycle write path. Depends on L3-1.

### L3-3 — Complete Suspension Enforcement Boundary

Extend the common active-tenant, Customer Portal, tenant-file, and tenant-job
entry boundaries to participate in the shared lock and revalidate ACTIVE state
before protected work. Preserve existing session records/data but deny and
clear/redirect as appropriate. Inventory all mounted tenant routes and actual
tenant-scoped background entry points; prove no bypass. Shared global services
and other tenants remain unchanged. Depends on L3-1 and L3-2.

### L3-4 — Final Level-3 Adversarial Verification

No implementation unless verification identifies a separately authorized
defect. Depends on verified L3-1 through L3-3.

## 7. Focused verification strategy

- DB-free/static: exact HUMAN capability mapping; fabricated/stale/wrong-type/
  tenant-role denial; route order; alternate-writer inventory; transition
  matrix; status metadata; neutral errors; shared/exclusive lock contracts;
  mounted staff/ADMIN/portal/file/job gate inventory; no RLS/delete/cascade.
- Guarded exact `jupiter_test`: migration UP/DOWN/reapply and populated-DOWN
  refusal; unconditional tenant DELETE rejection; atomic provisioning with one
  initial ADMIN; all valid/invalid transitions; immutable audit before/after;
  revoked-grant and disabled-principal races; same-tenant concurrent commands;
  suspension racing active tenant work; rollback and idempotent retry; no
  partial tenant/membership/role/audit residue.
- Two-tenant mounted adversarial: after A is suspended, A staff including ADMIN,
  existing/stale sessions, fresh login/selection/switch, Customer Portal,
  uploads/files, direct service calls, and tenant jobs are denied; A data/files
  and membership states remain byte/logically unchanged; B remains fully
  operational and cannot discover A; reinstatement restores access only for
  independently eligible A identities.
- Regression: focused Level-1 isolation and Level-2 platform-authority/audit/
  revocation/concurrency/file suites. Broad tests or build run only if a focused
  result establishes the need.
- Recovery: injected failures before mutation, after mutation before audit, and
  during provisioning prove transaction rollback; process interruption leaves
  no durable partial command, advisory locks release on connection/transaction
  end, and an identical retry reaches one auditable result.

No real bootstrap, SERVICE provisioning, production migration, or production
tenant lifecycle action occurs during verification.

## 8. Completion criteria

Level 3 is complete only when L3-1 through L3-3 are implemented and formally
verified, L3-4 passes, and canonical governance closeout records that:

- only authorized HUMAN Platform principals can execute each exact lifecycle
  command and tenant/legacy roles cannot derive that authority;
- provisioning is atomic and activation is explicit;
- suspension is race-safe, preserves all tenant data/files/identity/history,
  and blocks every tenant staff, ADMIN, portal, file, and job boundary until
  reinstatement;
- reinstatement preserves individual membership/user state;
- other tenants remain operational, isolated, and unaware;
- deletion is prohibited at the database boundary;
- every successful command has atomic immutable platform audit and every failed
  command leaves no partial state;
- no transfer, quota, archive/delete, RLS, bootstrap, SERVICE provisioning, or
  production action was absorbed into Level 3.

## 9. Exact first IMPLEMENT gate

Project Owner authorization is required for **L3-1 — Lifecycle Capability,
Persistence, and Coordination Foundation IMPLEMENT**.

That gate authorizes only the additive migration, lifecycle operation policy,
tenant advisory-lock helper/contracts, runtime privilege evidence, and focused
tests described in L3-1. It does not authorize routes, tenant provisioning or
state changes, real bootstrap, SERVICE provisioning, production migration,
deployment, staging, commit, or push.
