# MP2-R1A Identity, Admin Continuity and Offboarding — DEFINE

**Document ID:** JUPITER-MP2-R1A-IDENTITY-ADMIN-OFFBOARDING

**Revision:** 1.21

**Status:** MP2-R1A-1 COMPLETE / VERIFIED

**Reviewed:** 2026-09-15

## Fixed contract

There is no public registration. The System Owner establishes the first Company
Administrator during authoritative tenant provisioning. Afterwards, an active
same-tenant ADMIN may invite staff only into that tenant. Multiple active
Company Administrators are permitted, but normal tenant administration may not
disable, remove, demote, or otherwise incapacitate the last active ADMIN.
Employee offboarding changes only the tenant membership and preserves the
global identity, other memberships, operational history, attribution, and audit
evidence. Disabled membership may be reinstated. No identity, membership,
tenant data, history, or audit deletion is part of this work.

System Owner remains the single initial emergency tenant lockout/reinstatement
authority. Company-admin recovery is a separate, exact Platform HUMAN command;
it is not general tenant-data or identity-discovery authority. Material actions
require immutable audit. Production topology, secret manager, RPO/RTO, and
alert delivery are deferred to the operational-readiness contract.

## Evidence classification

| Required behaviour | Current evidence | Classification |
| --- | --- | --- |
| User identity creation | Globally unique lower-cased email, password hash, active flag, login, and inactive-user rejection exist; no mounted creation or staff credential-establishment flow exists. | **NEEDS EXTENSION** |
| Tenant membership creation | `tenant_memberships` provides unique tenant/user membership and lifecycle metadata; authoritative provisioning creates the first membership. No tenant-admin membership-create command exists. | **NEEDS EXTENSION** |
| Staff invitation/onboarding | No public registration and no mounted staff invitation/acceptance path were found. Customer Portal invitation fields are a separate identity domain and are not reusable as staff authority. | **MISSING** |
| Membership activation | `INVITED` and `ACTIVE` states and their database lifecycle shapes exist; first-admin activation exists. No invited-staff acceptance transition exists. | **NEEDS EXTENSION** |
| Membership disable/reinstatement | `DISABLED` metadata and runtime denial exist; no authoritative disable/reinstate commands exist. | **NEEDS EXTENSION** |
| ADMIN grant/revocation | Active same-tenant ADMIN can toggle roles for active same-tenant staff; revoked assignments are retained. Immutable material-change audit is required. Last-active-ADMIN enforcement is deferred by Project Owner decision. | **NEEDS EXTENSION; LAST-ADMIN ENFORCEMENT DEFERRED** |
| First-admin assignment | `TENANT_PROVISION` requires an existing active user and atomically creates ACTIVE membership plus ADMIN role under Platform HUMAN authority and audit. | **ALREADY SATISFIED** |
| System Owner recovery/replacement | Authentic HUMAN platform authority, transactional revalidation, immutable platform audit, and exclusive tenant coordination exist. No exact recovery capability/command exists. | **MISSING** |
| Historical attribution | Tenant records, membership identity, revoked role history, restrictive user references, tenant deletion prohibition, and absence of offboarding deletion support retention. Membership lifecycle changes lack a dedicated database-immutable audit ledger. | **NEEDS EXTENSION** |
| Disable/session invalidation | Every mounted tenant request revalidates ACTIVE membership and tenant state under the shared tenant lifecycle lock and clears stale tenant context on failure. A disable command does not yet acquire the matching exclusive lock. | **ALREADY SATISFIED at access; NEEDS EXTENSION at mutation** |

## Exact missing implementation boundary

### MP2-R1A-1 — Consolidated identity/membership administration foundation and commands

One additive migration and one bounded command surface shall implement the
shared persistence, authority, coordination, and audit boundary:

1. Add locked HUMAN-only `TENANT_ADMIN_RECOVER`; it is never derivable from a
   tenant or legacy role. Seed no grant and perform no bootstrap.
2. Add a staff-invitation table containing tenant, membership, normalized email
   snapshot, cryptographic token hash (never plaintext), expiry, consumed/
   revoked metadata, inviter, and whether the global identity was created by
   this invitation. Permit at most one live invitation per membership.
3. Add an append-only tenant-membership authority audit table with actor,
   tenant, membership, action, reason, correlation, and authoritative before/
   after values; enforce database immutability and INSERT/SELECT-only runtime
   privilege. System Owner recovery additionally uses `platform_global_audit_log`.
4. Database and application enforcement preventing loss of the last active
   ADMIN is **DEFERRED** by Project Owner decision and is not an MP2-R1A-1
   runtime guarantee. Migration DOWN remains guarded against invitation, audit,
   grant, or dependent evidence.
5. Extend the authenticated `/auth/staff` surface with same-tenant ADMIN
   commands for opaque invite/create-or-attach, invitation activation,
   membership disable/reinstate, and explicit role grant/revoke. Derive tenant
   and actor solely from freshly revalidated server authority. Never expose a
   global lookup/search endpoint or reveal whether an email already exists.
6. For a new email, create an inactive global staff identity with unusable
   credentials and activate it only through one-time invitation credential
   establishment. For an existing identity, require that identity's
   authentication to accept; an invitation must never reset or disclose its
   global credentials. Raw tokens must not be logged or returned outside a
   guarded test path; production delivery is an operational dependency.
7. Disable/reinstate only the selected tenant membership. Never change global
   `users.is_active`, another membership, historical assignments, records, or
   attribution. Reinstatement updates the existing membership.
8. Add exact `/platform/tenants/:publicId/admin-recovery` Platform HUMAN command
   requiring fresh `TENANT_ADMIN_RECOVER`. It may create/attach, reinstate, and
   grant ADMIN only for the named tenant and exact identity; it provides no
   tenant-data browse, general identity search, or tenant-local application
   authority. Use immutable before/after platform audit.
9. All implemented membership/ADMIN mutations acquire the existing exclusive tenant
   lifecycle lock, revalidate actor and target inside one transaction, apply
   state/role and audit atomically, and roll back fully on failure. The mounted
   shared access lock then provides prompt, race-safe disabled-member rejection.

No membership removal, user deletion, global-user disable, invitation email
provider, Provider hierarchy, parent/subsidiary sharing, RLS, bootstrap,
SERVICE provisioning, production activation, or TS2352 repair is included.

### MP2-R1A-2 — Formal focused verification

Independently verify exact authority, opaque identity handling, invitation
token secrecy/replay/expiry, transitions, absence of deferred last-ADMIN
enforcement, disable/access and reinstate/access ordering, rollback/audit atomicity,
System Owner recovery confinement, two-tenant non-interference, other-
membership preservation, record attribution, guarded migration UP/DOWN/reapply,
privileges, and zero fixtures. Reuse verified foundations; no broad suite.

## Proposed components

- additive migration `602` and invitation/membership-audit models;
- `staff.routes.ts`, `staff-tenant.service.ts`, and
  `staff-tenant.repository.ts` extensions and focused tests;
- bounded staff invitation credential routes/service and delivery interface;
- bounded Platform tenant-admin recovery route/repository using existing
  platform mutation evidence and audit machinery;
- focused migration, concurrency, rollback, access, and preservation tests.

## Risks and controls

Principal risks are cross-tenant email enumeration, invitation takeover of an
existing identity, the explicitly deferred last-ADMIN continuity guarantee, stale-session access,
recovery becoming tenant-data access, and audit/state divergence. Opaque
responses, hashed one-time tokens, identity-aware acceptance, exclusive tenant
locking for implemented mutations, shared access revalidation, exact capability
scope, and atomic immutable audit are mandatory controls.

## Historical implementation gate (satisfied)

**Project Owner authorization required for MP2-R1A-1 — Consolidated Identity,
Membership Administration and Admin-Recovery Foundation IMPLEMENT.**

That gate does not authorize MP2-R1A-2 verification, operational activation,
bootstrap, SERVICE provisioning, production action, RLS, or TS2352 repair.

## Completion record

MP2-R1A-1 is **COMPLETE / VERIFIED** on 2026-09-14. The first VERIFY failure,
additive migration 603 repair, first RE-VERIFY failure, and bounded bootstrap
reconciliation remain valid historical evidence in canonical current-state
governance. Database last-active-ADMIN enforcement remains explicitly deferred.
That MP2-R2 DEFINE / RECONCILE gate subsequently completed. The current next
gate was Project Owner authorization for **MP2-R2 focused IMPLEMENT**. That
implementation and formal verification are now complete. MP2-R3A focused
IMPLEMENT subsequently completed, its first VERIFY found one onboarding-runbook
defect, and bounded repair and RE-VERIFY completed. MP2-R3A is COMPLETE /
VERIFIED, and MP2-R3B subsequently completed formal VERIFY. MP2-R3C bounded
implementation and formal VERIFY also completed, followed by MP2-R3 governance
closeout. MP2-R3 is COMPLETE / VERIFIED with all recorded gaps preserved. The
MP2-R4 DEFINE / readiness reconciliation subsequently completed;
implementation and verification remain NOT STARTED. The current next gate is
MP2-R4-1 decisions and prerequisites subsequently completed. The current next
MP2-R4-2A Scheduler Principal Recovery focused IMPLEMENT subsequently
completed. Its formal VERIFY found the exact-one principal defect; bounded
fail-closed repair is COMPLETE / READY FOR FORMAL RE-VERIFY. The current next
gate was satisfied by formal RE-VERIFY; MP2-R4-2A is COMPLETE / VERIFIED. The
MP2-R4-2B bounded repair focused IMPLEMENT subsequently completed with a clean
build, and formal focused VERIFY subsequently passed. MP2-R4-2B is COMPLETE /
VERIFIED. MP2-R4-3 preflight/DEFINE subsequently completed. The current next
gate is target-specific Project Owner authorization for **MP2-R4-3 controlled
non-production Recovery Rehearsal execution**.
