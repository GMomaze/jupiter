# Jupiter Active Work Registry

**Document ID:** JUPITER-ACTIVE-WORK

**Revision:** 1.0

**Status:** Canonical

**Reviewed:** 2026-08-17

This is the single canonical registry for active and paused programme work. It
records authorization state; it does not itself authorize the next phase.

## Active work

### Governance Modernisation

- G1 — `COMPLETE / APPROVED`
- G2 — `IMPLEMENTED`
- Original G3 — `FAILED VERIFICATION` due to narrow documentation inconsistencies
- G3R — `IMPLEMENTED`
- Repeat G3 — `FAILED VERIFICATION` because the canonical current-state
  documents had not advanced after G3R
- G3R2 — `IMPLEMENTED`
- G3R2 focused VERIFY — `FAILED VERIFICATION` because canonical state still
  described G3R2 implementation as active
- G3R3 — `STATE-MODEL REPAIR IMPLEMENTED`
- Last completed governance step: `G3R3 — IMPLEMENT`
- Governance verification status: `NOT YET VERIFIED`
- Commit readiness: `NOT YET COMMIT READY`
- Next authorized gate: focused independent `G3R3 — VERIFY`
- Completion of G3R3 authorizes no development work. The only authorized next
  operation is focused `G3R3 — VERIFY`.
- If verification passes, Governance Modernisation scoped commit preparation is
  the next operation requiring separate Project Owner authorization; commit is
  not currently authorized.

## Paused approved work

### Component Management Unified Workspace

- Plan: [`../JUPITER_COMPONENT_MANAGEMENT_UNIFIED_WORKSPACE_PHASED_TASK_PLAN.md`](../JUPITER_COMPONENT_MANAGEMENT_UNIFIED_WORKSPACE_PHASED_TASK_PLAN.md)
- Phase 1 — approved
- Phase 2 — approved
- Phase 3 — approved
- Investigation/definition through Phase 3 — approved
- Implementation — paused pending completion and verification of Governance Modernisation
- No implementation slice is currently authorised

## Deferred programme work

- Jupiter SaaS / Multi-Tenant Foundation: `FUTURE / NEXT PRIORITY`; not yet
  started or authorized for implementation. It must begin with a separately
  owner-authorized `MT-0 — INVESTIGATE` after Governance Modernisation is
  verified and committed, followed by its own approved lifecycle.
- CI and release workflow hardening: evidence exists, but DEFINE/IMPLEMENT/VERIFY
  authorization has not been granted.
- Component lifecycle-intake initialization: domain authority is unresolved and
  remains deferred.
- Component install/baseline/remove permission hardening: role grants remain
  unresolved and no implementation is authorized.
- Jupiter multi-tenant productisation and isolation work not already
  independently authorized remains deferred.
