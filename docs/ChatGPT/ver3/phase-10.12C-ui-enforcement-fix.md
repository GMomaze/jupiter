# Phase 10.12C - UI Enforcement Fix

## Phase

- Active Phase: 10.12C - UI Enforcement Fix
- Mode: IMPLEMENT
- Execution Type: READ-ONLY documentation phase

## Scope

This phase defines the required UI enforcement fix for the execution-page gaps identified as failing in Phase 10.12.

This phase does not change:

- code
- schema
- migrations
- models
- services
- controllers

This phase defines UI-enforcement corrections only.

## Files Checked

- `docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md`
- `docs/ChatGPT/ver3/phase-10.11-execution-ui-hardening.md`
- `docs/ChatGPT/ver3/phase-10.12-execution-system-final-verification.md`

## 1. Failure Confirmed in Phase 10.12

Phase 10.12 confirmed that the active execution UI is not fully aligned with the approved UI-hardening rules.

Confirmed UI failures:

- close/finalize readiness is based on every task being exactly `CERTIFIED_BY_ENGINEER`
- `LOCKED` tasks do not satisfy the current execution-page close gate
- no lock action is exposed in the execution page even though `LOCKED` is part of the approved lifecycle

Meaning:

- the UI partially enforces the lifecycle, but not the approved terminal-state and readiness rules
- the UI currently reflects older close-readiness assumptions

## 2. Approved UI Rule to Restore

The approved UI rule from Phase 10.11 is:

- the execution UI must show only valid actions for the current lifecycle state
- the UI must clearly display `LOCKED` as a final read-only task state
- the UI must reflect approved close and certification readiness rules

This is the rule the execution UI must be brought back into alignment with.

## 3. Required Fix Scope

The UI-enforcement fix must address only the execution-page behavior gap confirmed in Phase 10.12.

Required fix scope:

- treat `LOCKED` as a valid visible terminal task state
- treat `LOCKED` tasks as valid close-ready terminal tasks where the approved readiness rules allow them
- expose only approved lifecycle actions for visible task states
- preserve read-only behavior for locked tasks
- preserve role-aware action visibility

This phase does not define service-logic changes.

## 4. Close-Readiness UI Fix

Current failing behavior:

- execution-page close readiness requires every task to be exactly `CERTIFIED_BY_ENGINEER`

Required corrected behavior:

- execution-page close readiness must treat both of the following as valid terminal task states:
  - `CERTIFIED_BY_ENGINEER`
  - `LOCKED`

Meaning:

- a locked task must count as close-ready in the UI
- the UI must not visually block close when the approved rules say the task state is acceptable

## 5. Locked-State Visibility Fix

Current failing behavior:

- `LOCKED` exists in the lifecycle but is not fully reflected in the page-level readiness behavior

Required corrected behavior:

- the UI must explicitly present `LOCKED` as:
  - final
  - read-only
  - certification-complete at task level
  - valid for later workpack close readiness

Meaning:

- the UI must not make `LOCKED` look like an invalid or incomplete state
- users should understand that a locked task is terminal, not pending

## 6. Lock-Action Visibility Fix

Current failing behavior:

- no execution-page lock action is exposed even though the approved lifecycle includes `CERTIFIED_BY_ENGINEER -> LOCKED`

Required corrected behavior:

- if lock remains part of the approved active lifecycle, the UI must expose the lock action only when:
  - task status is `CERTIFIED_BY_ENGINEER`
  - the current user has the required lock authority

If lock is intentionally handled elsewhere, the execution page must still avoid implying that `LOCKED` is unsupported.

Meaning:

- the UI must either support the approved lock step or clearly reflect where that step belongs
- the execution page must not silently omit a valid lifecycle action without explanation

## 7. Role-Aware Control Preservation

The UI-enforcement fix must preserve approved role-based action visibility.

Rules:

- mechanic actions remain visible only to authorized mechanic users
- engineer certification remains visible only to authorized engineer users
- lock controls remain visible only to authorized lock-capable users if shown in the execution page

Meaning:

- the UI fix must not weaken authorization presentation
- the UI must continue to align with service-side role enforcement

## 8. Read-Only Terminal-State Preservation

The UI-enforcement fix must preserve the approved terminal-state protections.

Rules:

- `CERTIFIED_BY_ENGINEER` remains non-editable unless the approved next action is lock
- `LOCKED` remains fully read-only
- locked tasks show no edit actions
- locked tasks show no reverse-transition actions

Meaning:

- the fix must not re-open terminal tasks
- the fix must improve enforcement visibility, not weaken it

## 9. Blocking Feedback Preservation

The UI-enforcement fix must preserve clear user feedback for blocked actions and readiness states.

The UI should still communicate blockers such as:

- tasks still `OPEN`
- tasks still `IN_PROGRESS`
- tasks still `COMPLETED_BY_MECHANIC`
- missing engineer certification
- open snags
- incomplete compliance where shown in execution context

Meaning:

- the UI must distinguish true blockers from valid `LOCKED` terminal tasks
- blocked close should only reflect real blockers

## 10. Data-Presentation Integrity

The UI-enforcement fix must preserve these presentation integrity rules:

- `LOCKED` must never imply `workpack_executions.status = LOCKED`
- UI state labels must remain consistent with the approved lifecycle
- close-readiness presentation must match the approved task terminal states
- visible actions must remain a subset of approved actions only

## 11. Out of Scope for This Fix

This UI-enforcement fix does not itself resolve:

- backend workpack certification validation
- backend close-enforcement validation
- schema changes
- model changes
- service-logic changes

Those remain separate backend concerns documented in other Phase 10.12 fix documents.

## 12. UI Enforcement Fix Summary

- restore the approved UI rule that treats `LOCKED` as a valid visible terminal task state
- update close-readiness presentation so `LOCKED` tasks count as close-ready where approved
- expose the lock action only if it remains part of the approved execution-page lifecycle and only for authorized users
- preserve read-only locked-task behavior and role-aware control visibility
- keep the fix limited to execution UI enforcement and presentation alignment

## Verification

- UI failure from Phase 10.12 identified: PASS
- approved UI target behavior restated: PASS
- close-readiness UI fix defined: PASS
- locked-state visibility fix defined: PASS
- lock-action visibility fix defined: PASS
- role-aware control preservation defined: PASS
- read-only terminal-state preservation defined: PASS
- boundaries enforced: PASS
