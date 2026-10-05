# Jupiter Emergency Lockout Runbook

## Purpose

Use only existing guarded Jupiter controls to contain tenant, user, platform, or
SERVICE authority. This runbook defines no kill switch and performs no recovery
or production action by itself.

## Preconditions

- Assign an incident/correlation ID and record the target, reason, UTC time,
  current authority state, and intended containment boundary.
- Authenticate through an unaffected identity and verify the exact target.
- Preserve current audits and operational events before mutation where safe.

## Authority required

One repository-issued HUMAN System Owner with the required current capability
may initiate tenant or platform containment; no dual approval is implemented.
Tenant membership disable requires an active ADMIN of that tenant. Runtime
shutdown requires separately approved process/infrastructure authority.

## Procedure

Choose only the smallest control that contains the incident:

1. **Tenant:** HUMAN `TENANT_SUSPEND` submits `POST
   /platform/tenants/<publicId>/suspend` with a reason. Reinstate later through
   `POST /platform/tenants/<publicId>/reinstate` using HUMAN
   `TENANT_REINSTATE`. Data, membership, records, files, and tenant identity are
   preserved; peer tenants must remain unaffected.
2. **Tenant user:** active Company ADMIN submits `POST
   /auth/staff/<user-id>/disable` with a reason. Reinstate through `POST
   /auth/staff/<user-id>/reinstate`. Only that tenant membership changes; the
   global user, attribution, and peer memberships remain.
3. **Platform capability:** HUMAN `PLATFORM_AUTHORITY_MANAGE` submits `POST
   /platform/grants/revoke` with target principal ID, exact capability code, and
   reason. Last-System-Owner protection refuses removal of the final active
   HUMAN `PLATFORM_AUTHORITY_MANAGE` grant.
4. **Platform principal:** where necessary, the same HUMAN authority submits
   `POST /platform/principals/disable` with target principal ID and reason.
   Last-System-Owner protection also applies.
5. **SERVICE:** revoke `SERVICE_BULLETIN_SYNC_EXECUTE` from the exact
   `SB_SYNC_SCHEDULER` principal through `POST /platform/grants/revoke`.
6. **Application-wide containment:** if narrower controls cannot bound risk,
   request graceful termination of the running Node process through the
   approved supervisor. Jupiter handles `SIGTERM` and `SIGINT`, closes the HTTP
   server and database pools, and exits. This also stops the in-process
   scheduler. The production supervisor command is not repository-defined.

## Expected result

The targeted authority fails closed, immutable platform or membership-authority
audit records the supported mutation, tenant data remains preserved, and peer
tenants are unaffected unless application-wide shutdown was explicitly chosen.

## Refusal / stop conditions

Stop on stale/missing authority, ambiguous target, missing reason, final-System-
Owner refusal, wrong lifecycle/membership state, audit failure, peer impact, or
uncertain shutdown target. Never clear tables, delete tenant/audit data, remove
files, reset the database, alter grants directly, or bypass application gates.

## Verification

- Verify the exact audit action and target through authorized `/platform` or
  membership-audit evidence access.
- Confirm the tenant, user, principal, or capability is denied as intended and
  no broader authority was granted.
- For tenant/user containment, confirm an unaffected peer remains usable.
- For shutdown, confirm listener and scheduler activity stopped and database
  connections closed; do not interpret process termination alone as incident
  resolution.

## Recovery / failure handling

Do not reverse containment until cause and scope are resolved. Use the guarded
reinstatement/regrant operations where supported and record a fresh reason.
Recover a disabled canonical scheduler principal only through `POST
/platform/scheduler/recover` with fresh HUMAN `PLATFORM_AUTHORITY_MANAGE` and an
approved reason. The operation refuses non-canonical or inconsistent state and
restores only `SERVICE_BULLETIN_SYNC_EXECUTE`. If membership-audit evidence is
needed, there is no mounted operator view; use only the separately approved
bounded authoritative evidence mechanism.

## Operational gaps

- **OPERATIONAL GAP — IMPLEMENTATION REQUIRED:** no scheduler-only stop command,
  application kill switch, or repository-defined production supervisor command.
- `NullStaffInvitationDelivery` and mounted membership-authority audit viewing
  remain open and are not completed here. Scheduler recovery implementation is
  pending its separate MP2-R4-2A formal VERIFY gate.
