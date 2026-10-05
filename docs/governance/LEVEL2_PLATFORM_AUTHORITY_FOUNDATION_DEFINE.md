# Level 2 — Platform Authority Foundation DEFINE

**Document ID:** JUPITER-L2-PLATFORM-AUTHORITY-FOUNDATION-DEFINE

**Revision:** 1.2

**Status:** REPAIR COMPLETE / READY FOR RE-VERIFY

**Reviewed:** 2026-09-12

## Authorized outcome

L2-1 establishes an independently persisted, fail-closed platform authority
foundation for human and service principals. It does not convert or authorize
any shared-master mutation route. Tenant authority continues to govern
tenant-owned resources; platform authority governs intentionally shared
resources; neither is inherited from the other.

## Persistence design

Propose additive migration `598_create_platform_authority_foundation.ts` with
these public tables:

1. `platform_principals`: UUID `id`; `principal_type` constrained to `HUMAN` or
   `SERVICE`; nullable `user_id` FK to `users` (`RESTRICT/RESTRICT`); nullable
   normalized `service_code`; `display_name`; status constrained to `ACTIVE` or
   `DISABLED`; created/disabled timestamps and human actor FKs. A check requires
   exactly one identity column appropriate to the type. Active human `user_id`
   and normalized service code are unique.
2. `platform_capabilities`: UUID `id`; immutable unique normalized `code`;
   label, description, domain, active/system-locked flags. Initial foundation
   codes are `PLATFORM_AUTHORITY_MANAGE` and `PLATFORM_AUDIT_VIEW`. Later slices
   add granular domain/action capabilities; there is no wildcard curator code.
3. `platform_capability_grants`: UUID `id`; principal and capability FKs;
   `granted_by_principal_id`, `granted_at`, reason; nullable revocation actor,
   time, and reason. A partial unique index permits only one unrevoked grant per
   principal/capability. Grant rows are append/revoke history, never deleted or
   reactivated.
4. `platform_global_audit_log`: UUID `id`; platform principal FK; immutable
   snapshots of principal type/code and capability code; action, resource type,
   nullable resource ID as text, correlation ID, source/provenance JSONB,
   before/after JSONB, outcome, reason, and server timestamp. Update/delete are
   denied by triggers. Tenant IDs may occur only as contextual provenance, not
   as audit ownership or authorization roots.

Indexes cover active principal resolution, active grants by principal and
capability, resource/correlation lookup, actor, action, and time. FKs use
`RESTRICT`; audit actor snapshots preserve meaning if a principal is later
disabled. `jupiter_app` receives only the least privileges required by the
approved repository operations; it receives no delete privilege on grants or
global audit. DOWN must refuse once any non-seed principal, grant, or audit row
exists; populated authority/audit evidence is not destructively reversible.

`rf_role`, `rf_permission`, `rf_role_permissions`, `user_roles`,
`tenant_memberships`, and `tenant_membership_roles` remain unchanged. They are
not platform-authority sources.

## System Owner and bootstrap

A human platform principal with active `PLATFORM_AUTHORITY_MANAGE` is a System
Owner for authority administration. The initial System Owner is created by a
dedicated guarded CLI, not login, tenant administration, a seeder, or automatic
legacy-role conversion. It accepts an explicit existing active user UUID and
expected normalized email, exact database identity, and a one-time confirmation
token; locks the zero-owner state; refuses ambiguity, an existing owner, wrong
database/ledger, inactive user, or mismatched identity; creates the principal,
grant, and global audit atomically. It prints no secrets and is idempotent only
by refusing a second bootstrap. Subsequent owners/curators are granted through
the same authority service after an authenticated System Owner path is
separately authorized.

Recovery is not a tenant-admin operation. Loss of all active System Owners
requires a separately authorized database-administrator recovery procedure with
the same identity proof and durable audit; it is not implemented in L2-1.

## Human grants, service principals, and capabilities

- Human principal resolution starts from the authenticated active `users.id`,
  then independently resolves an ACTIVE platform principal and its current,
  unrevoked, active capabilities. Tenant context and passport roles are ignored.
- Only a current human principal holding `PLATFORM_AUTHORITY_MANAGE` may grant,
  revoke, enable, or disable platform authority. A service principal can never
  manage grants. Self-grant, self-revocation of the last active System Owner,
  duplicate grants, fabricated capability codes, and inactive targets fail
  closed.
- Service principals are persisted identities with explicit grants. Internal
  jobs resolve a configured service code through a dedicated resolver; a string
  or environment value alone is not authority. HTTP/user sessions cannot claim
  service identity. Secrets or external machine authentication are outside this
  internal scheduler foundation and require later definition if needed.
- Grant revocation is checked again inside the same transaction as every future
  protected write. Previously issued authority objects therefore cannot survive
  revocation.

Future capability families are granular by domain and action: reference/RBAC,
manufacturer/model/maintenance, regulatory/applicability, task/template,
life-limit governance, file replacement, import, synchronization, and audit
view. Ordinary maintenance has no mandatory dual control. Existing life-limit
separation is preserved until its later slice.

## Authentication and authority boundary

Add a branded, non-client-constructible `PlatformAuthority` value containing
principal identity, type, and resolved capabilities. A resolver repository is
the only constructor. Route middleware performs an early capability check, but
future mutation repositories must re-resolve principal and grant state under
transaction before writing. Missing, malformed, inactive, disabled, revoked,
stale, fabricated, tenant-derived, legacy-role-derived, or wrong-principal-type
authority fails closed without lookup leakage or mutation.

Do not add capabilities to `req.user.roles`, session state, tenant context, or
client claims. Passport continues authenticating human identity and preserving
existing shared reads. L2-1 may expose middleware factories and services for
later slices but mounts no new route and changes no existing shared route.

## Global audit foundation

The foundation repository atomically records successful bootstrap, principal
creation/status changes, grant, and revoke operations in
`platform_global_audit_log`, including actor, authority, action, target,
timestamp, reason, correlation, and before/after evidence. Failed attempts are
recorded only where doing so cannot weaken transaction atomicity; application
security logging for pre-transaction failures is retained separately. Tenant
authority cannot write, update, or delete this table. Later shared-resource
repositories must use this same transactional audit port.

## Exact IMPLEMENT boundary

Expected files:

- migration `598_create_platform_authority_foundation.ts`;
- models and `src/models/index.ts` / `associations.ts` only as required for the
  four new tables;
- a new `src/modules/platform-authority/` authority type, repository interface
  and live adapter, resolver, grant/revoke service, audit port, and middleware
  factory;
- a guarded initial-System-Owner bootstrap script and focused safety module;
- request typing only if the unmounted middleware requires it;
- focused DB-free, static, and guarded exact-`jupiter_test` tests.

No existing `/library`, `/reference`, `/service-bulletins`, `/sb`, upload,
life-limit, tenant, staff, Customer Portal, or operational route is converted or
mounted. No UI, public API, broad shared-master audit conversion, cron conversion,
file lifecycle change, tenant RBAC change, RLS, production action, or legacy
role cleanup is included.

## Legacy compatibility

Existing `ADMIN`, `LIBRARY_EDIT`, reference roles, permissions, and
`user_roles` remain untouched in L2-1 so existing shared reads and pre-conversion
behavior are not broken. They create no platform principal or grant, are never
read by the platform resolver, and are not grandfathered. Their global mutation
effect is removed only route family by route family in later authorized slices;
until then the documented exposure remains. The initial System Owner must be
explicitly bootstrapped even if that user has legacy `ADMIN`.

## Verification plan

DB-free/static tests must prove schema/model constraints, no tenant/legacy-role
authority source, branded-constructor exclusivity, middleware ordering,
human/service separation, least-privilege database grants, immutable/no-delete
audit, no mounted route change, and no Level-1 boundary regression.

Guarded exact-`jupiter_test` verification must snapshot database identity,
migration ledger, relevant privileges/triggers, users, tenants, memberships,
legacy RBAC, and all new-table totals; apply 598 only through the guarded runner;
then prove bootstrap success and all refusal cases, capability resolution,
grant/revoke, immediate stale-authority denial, last-owner protection, service
principal constraints, transactional audit, concurrency/duplicate resistance,
and tenant-admin/legacy-ADMIN non-authority. Test transactions/fixtures must be
rolled back or explicitly removed, leaving zero principal/grant/audit residue
apart from migration-owned capability definitions. Existing tenant and shared
read behavior must remain unchanged.

Migration verification must prove clean UP, guarded empty DOWN/re-UP, populated
DOWN refusal, exact ledger state, constraints/indexes/triggers, and privilege
boundaries. Production is untouched. Build and scoped diff checks are required.

## Risks and required Project Owner inputs

Primary risks are bootstrapping the wrong user/database, leaving zero active
System Owners, revocation races, privilege leakage, treating configured service
codes as authority, destructive DOWN, and accidentally mounting the new boundary
before route-family conversion.

Multiple concurrent System Owners are authorized while removal of the last
active owner remains prohibited. Actual bootstrap still requires separate
Project Owner authorization naming the exact user UUID/email, database, and
confirmation authority. External service authentication and global-audit
retention remain later decisions and do not block this internal foundation.

## Implementation state

The authorized L2-1 foundation is implemented. Migration 598, four models, the
repository-issued authority boundary, transactional human/service resolution,
principal creation/deactivation, grant/revoke with concurrent last-System-Owner
protection, immutable global audit, unmounted middleware, and guarded bootstrap
tooling are present. Multiple active System Owners are supported. Bootstrap was
not executed and no environment received platform authority. No shared-master
route was converted or mounted.

The failed formal VERIFY identified public authority issuance, absent bootstrap
ledger validation, and non-durable replay detection. The bounded repair removes
the public issuer, validates exact database/ledger/schema state, and uses the
immutable `SYSTEM_OWNER_BOOTSTRAPPED` global-audit event as durable one-time
evidence. Isolated and guarded repair tests passed; no real bootstrap ran.

Next gate: Project Owner authorization for **formal re-VERIFY of L2-1 Platform
Authority Foundation**. No bootstrap or later Level-2 slice is authorized.
