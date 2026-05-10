# Phase 12.1A - Implement Audit System Stabilization

## Status

DEFINE ONLY

This phase defines the minimal implementation required to close the audit-system gaps identified during the Phase 12.1 gap check.

This phase does not implement code, change schema, alter lifecycle behavior, or modify the locked behavior of Phase 10.12 or Phase 11.

## Purpose

Phase 12.1 established the target audit model. Phase 12.1A defines the minimum implementation scope needed to stabilize the existing audit system without unnecessary redesign or duplicate structures.

This phase exists to close the known implementation gaps while preserving the current working lifecycle and snag behavior.

## Known Gaps To Close

The following gaps are accepted as the current implementation gaps:

1. per-workpack audit UI is incomplete
2. audit immutability is only partially enforced
3. generic `audit_log` is not hash-chained
4. independent snag audit is only generic, while linked snag lifecycle uses `workpack_snag_audit_log`
5. `workpack_execution_audit_log` does not exist by that exact name; execution/task audit currently uses `workpack_audit_log`

These are the only gaps this phase is intended to address at the definition level.

## Implementation Principle

The implementation must be minimal.

The goal is to stabilize the existing audit architecture, not to redesign the audit system.

This phase therefore prefers:

- extending visibility of existing audit data
- strengthening integrity protections on existing audit paths
- avoiding unnecessary new audit tables
- preserving current lifecycle and execution behavior

## Existing Tables Preservation Rule

Existing audit tables must be preserved unless an explicit later phase approves otherwise.

This means:

- keep `audit_log`
- keep `workpack_audit_log`
- keep `workpack_snag_audit_log`

This phase does not approve replacing them with a new parallel audit model.

## No Unnecessary Duplication Rule

Audit tables must not be duplicated unnecessarily.

This means:

- do not create new audit tables just to rename an existing responsibility
- do not split a functioning audit table unless there is a demonstrated domain need
- do not introduce parallel logs that record the same lifecycle event twice without purpose

The stabilization goal is clarity and integrity, not audit-table proliferation.

## Accepted Execution Audit Table Decision

`workpack_audit_log` remains the accepted execution/task audit table.

`workpack_execution_audit_log` is not required merely because the name does not exist.

This phase explicitly accepts the current design choice that:

- execution and task-level workpack audit continues to live in `workpack_audit_log`

The implementation requirement is therefore:

- stabilize and document `workpack_audit_log` as the canonical execution/task audit table
- do not create a duplicate `workpack_execution_audit_log` unless a later approved phase establishes a real structural need

## Workpack Audit Table Role

For stabilization purposes, `workpack_audit_log` is the canonical append-only audit stream for:

- workpack-linked execution activity
- task lifecycle activity inside workpack execution context
- task-related before/after execution changes recorded at the workpack level

This role must be preserved and made explicit in implementation and documentation.

## Snag Audit Table Role

For stabilization purposes, `workpack_snag_audit_log` remains the canonical append-only audit stream for:

- linked snag lifecycle actions
- linked snag change history inside a workpack context

This table must remain the primary specialized snag audit log for workpack-linked snags.

## Generic Audit Log Role

`audit_log` remains the generic cross-entity audit ledger.

Its role includes:

- generic entity creation and status events
- coverage for entities or actions not fully represented in specialized chain logs
- support for independent snag creation and other generic audit cases

This phase does not remove or replace `audit_log`.

## Independent Snag Audit Requirement

Independent snag audit must remain supported.

Because independent snags do not necessarily belong to a workpack, they may continue to use the generic `audit_log` as their base audit path unless a later approved schema extension provides a better specialized design.

The required implementation direction is:

- preserve generic audit coverage for independent snags
- do not force independent snags into `workpack_snag_audit_log` when no valid `workpack_id` exists
- ensure audit visibility can still surface independent snag history where relevant

This phase does not require inventing a new dedicated independent-snag audit table.

## Minimal Immutability Protection Requirement

The audit system must implement minimal immutability protections.

This phase defines the minimum acceptable stabilization target as:

- audit rows must be treated as append-only by application behavior
- edit and delete operations must not be exposed through normal application UI or service workflows
- specialized chain logs must retain sequence and hash continuity protections
- generic audit usage must avoid update-in-place behavior

## Immutability Protection Scope

Minimal immutability protections must be applied to:

- `workpack_audit_log`
- `workpack_snag_audit_log`
- `audit_log`

This does not require a full redesign of all audit storage, but it does require that the application clearly treat audit as non-editable history.

## Hash-Chain Stabilization Requirement

The existing specialized hash-chained audit tables must be preserved and treated as authoritative integrity-aware logs.

This means:

- preserve `hash`
- preserve `previous_hash`
- preserve ordered `sequence`
- preserve append-only insertion semantics

This phase does not require immediate duplication of hash-chaining into all audit structures unless separately approved, but it does require retaining the existing integrity model where it already exists.

## Generic Audit Log Stabilization Requirement

The generic `audit_log` is accepted as non-hash-chained in the current architecture, but its role must be stabilized.

Minimal stabilization for `audit_log` means:

- keep it append-only in application behavior
- do not expose edit/delete workflows
- keep actor, timestamp, entity, and before/after capture where applicable

This phase does not require replacing `audit_log` with a new chained table.

## Per-Workpack Audit Visibility Requirement

Per-workpack audit visibility must be implemented as a required stabilization outcome.

This means a user reviewing a workpack must be able to see a chronological audit view that covers the workpack context.

At minimum, this visibility must surface:

- workpack lifecycle audit events
- task execution/lifecycle audit events associated with the workpack
- linked snag audit events associated with the workpack

## Per-Workpack Audit View Behavior

The per-workpack audit view must:

- be reachable from the workpack context
- present audit entries chronologically
- identify entity type clearly
- identify actor clearly
- show action clearly
- show before/after changes where available

This phase does not prescribe a specific visual layout, only the required visibility behavior.

## Chronological Traceability Requirement

Audit visibility must preserve chronological traceability across the workpack context.

Users must be able to reconstruct:

- what happened first
- what followed
- who performed each action
- which entity was affected

Chronology is required even when events originate from different audit sources.

## Cross-Source Audit Presentation Rule

Because audit currently lives in more than one store, the implementation may unify presentation without duplicating stored events.

This means:

- the UI may aggregate entries from `audit_log`, `workpack_audit_log`, and `workpack_snag_audit_log`
- aggregation is acceptable at the read/presentation layer
- duplication of storage is not required to achieve per-workpack audit visibility

This is the preferred minimal stabilization approach.

## Explicit Non-Requirements

Phase 12.1A does not require:

- a new `workpack_execution_audit_log` table
- replacing `workpack_audit_log`
- replacing `workpack_snag_audit_log`
- redesigning the generic `audit_log`
- changing task behavior
- changing snag behavior
- changing workpack lifecycle behavior

## Lifecycle Protection Rule

No lifecycle changes are allowed under this phase.

This means audit stabilization must not:

- alter workpack lifecycle transitions
- alter task lifecycle transitions
- alter snag lifecycle transitions
- alter certification gates
- alter close-validation rules

Audit remains observational and traceability-focused only.

## Snag Behavior Protection Rule

No snag behavior changes are allowed under this phase.

This means audit stabilization must not:

- alter snag creation rules
- alter snag execution visibility rules
- alter recurring snag behavior
- alter snag close blocking rules

The stabilization work may record these events better, but it must not change their business behavior.

## Implementation Deliverables

The minimal implementation defined by this phase is:

1. stabilize `workpack_audit_log` as the accepted execution/task audit table
2. preserve and continue using `workpack_snag_audit_log` for linked snag lifecycle audit
3. preserve `audit_log` for generic audit coverage, including independent snags
4. add or complete per-workpack audit visibility across workpack, task, and linked snag events
5. enforce minimal application-level immutability protections for all audit paths
6. preserve append-only behavior and specialized hash-chain integrity where already implemented

## Invariants

The following invariants are established by Phase 12.1A:

- existing audit tables are preserved unless explicitly re-approved for change
- unnecessary duplicate audit tables are forbidden
- `workpack_audit_log` remains the accepted execution/task audit table
- `workpack_execution_audit_log` is not required by name alone
- `workpack_snag_audit_log` remains the linked snag specialized audit table
- independent snag audit may remain generic in `audit_log`
- audit visibility must be available per workpack
- audit presentation must be chronologically traceable
- minimal immutability protections must be enforced
- audit stabilization must not change lifecycle behavior
- audit stabilization must not change task behavior
- audit stabilization must not change snag behavior

## Final Statement

Phase 12.1A defines the minimal implementation plan for audit stabilization as preserving and formalizing the current audit table structure, accepting `workpack_audit_log` as the canonical execution/task audit table, preserving `workpack_snag_audit_log` for linked snag audit and `audit_log` for generic coverage including independent snags, adding complete per-workpack chronological audit visibility, and enforcing minimal append-only immutability protections without introducing duplicate audit tables or changing any lifecycle or snag behavior.
