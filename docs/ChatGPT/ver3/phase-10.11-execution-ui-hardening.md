# Phase 10.11 - Execution UI Hardening

## Phase

- Active Phase: 10.11 - Execution UI Hardening
- Mode: IMPLEMENT
- Execution Type: READ-ONLY documentation phase

## Scope

This phase defines how the Jupiter execution UI must be hardened to reflect the approved execution rules.

This phase does not change:

- code
- schema
- migrations
- models
- services
- controllers
- UI implementation

## Files Checked

- `docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md`
- `docs/ChatGPT/ver3/phase-10.3D-status-rules-reverification.md`
- `docs/ChatGPT/ver3/phase-10.6-task-lock-enforcement.md`
- `docs/ChatGPT/ver3/phase-10.10-execution-audit-trail.md`

## 1. UI Hardening Purpose

The execution UI must reflect the approved lifecycle and must not encourage or permit invalid task actions.

The UI must:

- show the true current state
- show only valid next actions
- hide or disable invalid actions
- clearly indicate terminal states
- support traceable execution behavior

Meaning:

- the UI must help prevent user error
- the UI must not expose controls that contradict service rules
- service-side enforcement still remains mandatory even when the UI is hardened

## 2. Approved Lifecycle Visibility

The execution UI must visually reflect the approved task lifecycle:

- `OPEN`
- `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`
- `LOCKED`

The execution UI must also reflect the execution-row rule:

- `workpack_executions.status` never becomes `LOCKED`

Meaning:

- the UI may show locked tasks as a task-card final state
- the UI must not imply that execution rows become `LOCKED`

## 3. Valid Action Exposure

The UI must expose only valid forward actions for the current state.

### 3.1 OPEN

Allowed UI action:

- `Start Task`

Forbidden UI actions:

- complete
- certify
- lock
- post-completion edit controls

### 3.2 IN_PROGRESS

Allowed UI actions:

- complete mechanic work
- save work performed
- save measurements

Forbidden UI actions:

- certify
- lock
- reverse to `OPEN`

### 3.3 COMPLETED_BY_MECHANIC

Allowed UI action:

- engineer certification

Forbidden UI actions:

- start again
- mechanic completion again
- lock before certification
- normal mechanic editing if the approved flow blocks it

### 3.4 CERTIFIED_BY_ENGINEER

Allowed UI action:

- lock task, if lock is part of the approved workflow

Forbidden UI actions:

- edit work performed
- edit measurements
- uncertify
- reverse to mechanic states

### 3.5 LOCKED

Allowed UI behavior:

- view only
- reporting visibility
- inclusion in workpack closure readiness

Forbidden UI actions:

- any edit control
- any status transition control
- any execution mutation control
- any certification or recertification control

## 4. Role-Aware UI Controls

The UI must reflect approved role authority.

Rules:

- mechanic-only actions must not be shown to unauthorized users
- engineer certification actions must be shown only to authorized engineer users
- lock controls must be shown only to authorized users if lock authority is role-restricted

Meaning:

- the UI should not invite unauthorized attempts
- the UI must align with server-side role enforcement

## 5. Locked-State Presentation

Locked tasks must be visually obvious.

The UI should make clear that:

- `LOCKED` is final
- the task is read-only
- execution remains certified underneath the locked task

The UI must not present a locked task as still actively editable or in-progress.

## 6. Certification Clarity

The UI must clearly distinguish:

- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`
- `LOCKED`

Meaning:

- mechanic completion must not look like final certification
- engineer certification must be visually distinct from mechanic completion
- lock must be visually distinct from certification

## 7. Blocking and Error Feedback

When the user attempts an invalid action, the UI must surface clear blocking feedback.

Blocking feedback must be clear for cases such as:

- task not in eligible state
- user lacks required role
- task already locked
- workpack not in a valid execution state

Meaning:

- the UI must not silently fail
- user feedback should explain why the action is unavailable or rejected

## 8. Audit Visibility Support

The UI must support the audit-trail model by keeping visible state and actions understandable.

The UI should avoid:

- ambiguous labels
- hidden meaning for status transitions
- controls that obscure what audit event will result

Meaning:

- user-visible actions should correspond cleanly to auditable lifecycle changes
- the UI should reinforce traceable behavior

## 9. Close and Certification Readiness Visibility

The execution UI should make it clear when a workpack is not ready for later certification or close steps.

The UI should visibly communicate blockers such as:

- tasks still `OPEN`
- tasks still `IN_PROGRESS`
- tasks still `COMPLETED_BY_MECHANIC`
- tasks not yet `LOCKED` if lock is required by the current presentation logic
- open snags
- incomplete compliance where shown in execution context

Meaning:

- users should understand why later workflow steps remain unavailable
- readiness visibility should reduce invalid close or certification attempts

## 10. Boundaries

This phase defines UI-hardening requirements only.

This phase does not approve:

- lifecycle changes
- schema changes
- migration changes
- model changes
- retry logic
- `attempt_no > 1`
- bypass of service-side enforcement

## UI Hardening Summary

- the execution UI must show only valid actions for the current lifecycle state
- the UI must clearly display `LOCKED` as a final read-only task state
- the UI must distinguish mechanic completion, engineer certification, and lock
- unauthorized or invalid actions must be hidden, disabled, or clearly blocked
- UI behavior must align with the approved lifecycle, lock rules, and audit-trail expectations

## Verification

- lifecycle visibility rules defined: PASS
- valid action exposure defined: PASS
- role-aware control rules defined: PASS
- locked-state presentation defined: PASS
- certification clarity defined: PASS
- blocking feedback rules defined: PASS
- audit visibility support defined: PASS
- boundaries enforced: PASS
