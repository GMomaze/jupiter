# Phase 14.2 - Approval Gate

## Status

DEFINE ONLY

This phase defines the user approval gate for suspected dead-code candidates identified in Phase 14.1.

This phase does not delete files, does not modify code, does not refactor behavior, does not change schema, and does not change migrations.

This phase is approval-definition only.

## Phase Purpose

The purpose of Phase 14.2 is to define the mandatory approval boundary between investigation and removal.

Phase 14.1 identifies suspected candidates only.

Phase 14.2 defines how the user must approve, reject, or defer each candidate before any cleanup action may occur.

Phase 14.2 does not remove anything.

## Approval Rules

The following approval rules are mandatory:

- no automatic deletion
- candidate-by-candidate approval only
- each candidate must come from Phase 14.1 evidence
- approval must be explicit
- ambiguous candidates cannot be approved for removal
- Phase 14.3 may remove only approved items

### No Automatic Deletion

No file, route, service, model, migration, view, helper, utility, or document may be deleted automatically based on suspicion, age, naming, or inferred redundancy.

### Candidate-By-Candidate Approval Only

Each suspected candidate must be reviewed individually.

Batch approval of mixed candidates is not allowed unless every item in the batch is listed individually with its own evidence and status.

### Phase 14.1 Evidence Required

Every approval candidate must originate from Phase 14.1 investigation results.

No new deletion candidate may be introduced in Phase 14.2 without first being investigated under Phase 14.1 rules and evidence standards.

### Explicit Approval Required

Approval must clearly state one of:

- approved
- rejected
- deferred

Silence, omission, or partial discussion is not approval.

### Ambiguous Candidates Cannot Be Approved

If evidence is incomplete, conflicting, or uncertain, the candidate must be marked deferred or rejected.

Ambiguous candidates must not proceed to removal.

### Phase 14.3 May Remove Only Approved Items

Phase 14.3 may act only on items that have:

- Phase 14.1 evidence
- Phase 14.2 explicit approval
- no active protection rule preventing removal

## No Automatic Deletion

Phase 14.2 explicitly forbids any automatic cleanup behavior.

This includes:

- auto-removing unmounted routes
- auto-removing unreferenced files
- auto-removing duplicate docs
- auto-removing archival migration folders
- auto-removing stale views

Suspicion alone is never sufficient for deletion.

## Candidate-By-Candidate Approval Only

Each candidate must be considered independently.

The approval process must preserve the ability to:

- approve one candidate
- reject one candidate
- defer one candidate

without affecting any other candidate.

No candidate may inherit approval from another candidate, even if both appear related.

## Approved / Rejected / Deferred Categories

Phase 14.2 must use the following decision categories:

- approved
- rejected
- deferred

### Approved

`approved` means:

- the candidate was investigated in Phase 14.1
- evidence was reviewed
- the user explicitly authorizes removal in Phase 14.3
- no protection rule blocks removal

Approved does not mean removed.

Approved means eligible for Phase 14.3 removal only.

### Rejected

`rejected` means:

- the candidate must not be removed
- the candidate remains part of the system
- no Phase 14.3 action is allowed for that item

### Deferred

`deferred` means:

- the candidate is not approved
- more investigation or clarification is required
- no removal is allowed in Phase 14.3

Deferred candidates remain locked from deletion.

## Requirement That Every Approved Item Must Come From Phase 14.1 Evidence

Every approved item must include direct linkage to Phase 14.1 evidence.

Required linkage includes:

- exact file path
- category
- Phase 14.1 reason suspected
- Phase 14.1 evidence summary
- risk note

If a candidate is not present in the Phase 14.1 report, it cannot be approved in Phase 14.2.

## Requirement That Phase 14.3 May Remove Only Approved Items

Phase 14.3 must be constrained as follows:

- remove only candidates marked `approved` in Phase 14.2
- do not remove `rejected` candidates
- do not remove `deferred` candidates
- do not remove any candidate absent from the approval table

If an item is not explicitly approved, it is not removable.

## Explicitly Forbidden Removals

Phase 14.2 must explicitly forbid approval for removal of:

- active migrations
- lifecycle code
- audit integrity code
- planning integrity code
- customer access enforcement
- ambiguous candidates

### Active Migrations

Active migrations in the current executable migration chain must not be approved for removal in Phase 14.2.

Historical ambiguity, repair relationships, or age do not make active migrations removable.

### Lifecycle Code

Code that enforces workpack, task, or snag lifecycle rules must not be approved for deletion under cleanup without a separate explicit phase reopening those behaviors.

### Audit Integrity Code

Code, triggers, services, or routes that protect or implement audit behavior must not be approved for removal under dead-code cleanup unless separately reopened and re-verified.

### Planning Integrity Code

Planning validation, planning status enforcement, planning persistence integrity, and planning-to-workpack integrity code must not be approved for removal under cleanup without explicit reopening of planning phases.

### Customer Access Enforcement

Any code related to customer visibility isolation, access verification, or exposure control must not be approved for removal under cleanup without explicit separate review.

### Ambiguous Candidates

Candidates with incomplete or uncertain evidence must not be approved.

They must be deferred or rejected.

## Required Approval Table Format

Phase 14.2 approval output must use a structured approval table.

Required columns:

- candidate_id
- category
- file_path
- phase_14_1_evidence_reference
- suspicion_summary
- risk_if_removed_incorrectly
- approval_status
- approval_reason
- eligible_for_phase_14_3

### Approval Status Values

Allowed `approval_status` values:

- approved
- rejected
- deferred

### Eligibility Rule

`eligible_for_phase_14_3` must be:

- `YES` only if `approval_status = approved`
- `NO` for `rejected`
- `NO` for `deferred`

### Example Approval Table Shape

| candidate_id | category | file_path | phase_14_1_evidence_reference | suspicion_summary | risk_if_removed_incorrectly | approval_status | approval_reason | eligible_for_phase_14_3 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DC-001 | service | `src/example.ts` | Phase 14.1 candidate entry | No active imports found | Hidden runtime dependency | deferred | More verification required | NO |

## Completion Criteria

Phase 14.2 is complete only when all of the following are true:

- the approval purpose is documented
- no automatic deletion is explicitly forbidden
- candidate-by-candidate approval is required
- approved, rejected, and deferred categories are defined
- Phase 14.1 evidence dependency is defined
- Phase 14.3 is explicitly limited to approved items only
- forbidden-removal categories are defined
- approval table format is defined
- no code changes were made
- no files were deleted
- no routes were removed
- no services were removed
- no migrations were changed

## Final Statement

Phase 14.2 defines Jupiter’s cleanup approval gate as a strict user-controlled decision phase in which every suspected dead-code candidate from Phase 14.1 must be individually marked approved, rejected, or deferred based on evidence, no automatic deletion is allowed, ambiguous or protected candidates cannot be approved, and Phase 14.3 may remove only explicitly approved items.
