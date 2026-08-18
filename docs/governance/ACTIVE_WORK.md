# Jupiter Active Work Registry

**Document ID:** JUPITER-ACTIVE-WORK

**Revision:** 1.1

**Status:** Canonical

**Reviewed:** 2026-08-18

This is the lightweight canonical registry for current, paused, and next
programme work.

It records programme state and authorization boundaries. Historical programme
detail belongs in the roadmap and programme records and is not loaded through
this registry by default.

## Completed governance baseline

### Governance Modernisation

Status: `COMPLETE / VERIFIED / COMMITTED`

Canonical baseline commit:

`8b5cd409e8f50c3b9dbf112729983b7726d53231`

No Governance Modernisation phase remains active.

## Next priority

### Jupiter SaaS / Multi-Tenant Foundation

Status: `PLANNING NEXT — NOT IMPLEMENTED`

The objective is to evolve the existing working Jupiter system into a
multi-tenant SaaS AMMS while preserving its existing functionality and data.

Locked programme boundaries:

- Existing working Jupiter functionality must remain operational and must not be
  damaged by the SaaS conversion.
- Existing Jupiter data, IDs, relationships, history, and audit evidence must be
  preserved through controlled migration.
- Tenants and their private data must ultimately be invisible and
  non-discoverable to other tenants.
- Tenant isolation must be enforced beyond UI visibility.
- Jupiter Platform Administrator authority must remain separate from tenant
  administrator authority.
- The Platform Administrator must ultimately be able to suspend and reinstate a
  tenant without deleting, corrupting, transferring, resetting, or recreating
  that tenant's data.
- Suspension is an access/lifecycle control, not deletion.
- Jupiter's multi-tenant architecture must be established from Jupiter's own
  requirements and evidence. QA-MAN and SAFETYMAN are not architectural
  authorities for this programme.
- No blind `tenant_id` conversion is authorized.
- PostgreSQL RLS is not pre-authorized; its use requires an approved Jupiter
  architecture decision.
- No tenant-isolation claim may be made before applicable adversarial isolation
  and regression verification passes.

Next authorized programme step:

`MT-P0 — CREATE JUPITER SAAS / MULTI-TENANT FOUNDATION PHASED TASK PLAN`

MT-P0 is documentation/planning only.

It does not authorize:

- application implementation;
- schema changes;
- migrations;
- `tenant_id` additions;
- RLS;
- tenant-context middleware;
- membership implementation;
- Platform Administrator implementation;
- data conversion.

After the MT-P0 plan is created and approved, investigation must proceed through
the approved MT-0 investigation slices before architecture or implementation is
authorized.

## Paused approved work

### Component Management Unified Workspace

Plan:

[`../JUPITER_COMPONENT_MANAGEMENT_UNIFIED_WORKSPACE_PHASED_TASK_PLAN.md`](../JUPITER_COMPONENT_MANAGEMENT_UNIFIED_WORKSPACE_PHASED_TASK_PLAN.md)

Status:

- Phase 1 — approved
- Phase 2 — approved
- Phase 3 — approved
- Implementation — `PAUSED`
- No implementation slice is currently authorized

Component Management remains paused while the Jupiter SaaS / Multi-Tenant
Foundation is prioritized.

## Deferred work

- CI and release workflow hardening
- Component lifecycle-intake initialization
- Component install/baseline/remove permission hardening
- Other programme work not explicitly activated by the Project Owner

## Context rule

For ordinary work, read only the active plan and evidence required for the
authorized phase or slice.

Do not load historical governance, historical `docs/ChatGPT/ver*` directories,
unrelated feature plans, or unrelated application domains by default.
