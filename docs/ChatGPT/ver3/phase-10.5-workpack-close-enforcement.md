# Phase 10.5 - Workpack Close Enforcement

## Phase

- Active Phase: 10.5 - Workpack Close Enforcement
- Mode: IMPLEMENT
- Execution Type: READ-ONLY rules definition

## Scope

This phase defines how workpack close enforcement must behave in Jupiter.

This phase does not change:

- code
- schema
- migrations
- models
- services
- controllers
- UI

## Files Checked

- `docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md`
- `docs/ChatGPT/ver3/phase-10.4-execution-completion-rules.md`
- `docs/ChatGPT/ver3/phase-10.3D-status-rules-reverification.md`

## 1. Enforcement Entry Point

Workpack close enforcement must enter through:

- `closeWorkpack(workpackId, userId)`

Meaning:

- closure validation must be centralized
- no alternate close path may bypass this entry point
- the close decision must be made immediately before any status update

## 2. Required Validation

All validation rules below must pass before a workpack may close.

### 2.1 Task Status Validation

All related `task_cards` must be:

- `CERTIFIED_BY_ENGINEER`
- or `LOCKED`

### 2.2 Execution Status Validation

All related `workpack_executions` must be:

- `CERTIFIED_BY_ENGINEER`

Execution rows must not be treated as complete if they are:

- `OPEN`
- `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC`

### 2.3 Compliance Validation

All applicable compliance items must be:

- `COMPLETED`

If no applicable compliance items exist, this validation passes as not applicable.

### 2.4 Snag Validation

All related snags must be:

- `CLOSED`

No workpack may close while any snag remains:

- `OPEN`
- `IN_PROGRESS`
- `RESOLVED`

## 3. Blocking Conditions

Workpack close must be blocked if any of the following exist.

### 3.1 Task Blocking Conditions

- any `task_cards.status = OPEN`
- any `task_cards.status = IN_PROGRESS`
- any `task_cards.status = COMPLETED_BY_MECHANIC`

### 3.2 Execution Blocking Conditions

- any `workpack_executions.status != CERTIFIED_BY_ENGINEER`

### 3.3 Compliance Blocking Conditions

- any applicable compliance item is incomplete

### 3.4 Snag Blocking Conditions

- any snag is not `CLOSED`

## 4. Validation Result Contract

Close validation must return a structured result containing:

- `can_close`
- `blocking_errors`

### 4.1 can_close

- `true` only if every required validation passes
- `false` if any blocking condition exists

### 4.2 blocking_errors

`blocking_errors` must contain clear machine-safe and user-display-safe close blockers such as:

- tasks still open
- tasks still in progress
- tasks awaiting engineer certification
- executions not certified
- compliance incomplete
- snags not closed
- certification metadata missing

## 5. Success Rule

If all validation passes:

- `workpack.status -> CLOSED`

Meaning:

- close is allowed only after successful immediate pre-close validation
- closure should occur only after the final decision result confirms `can_close = true`

## 6. Failure Rule

If validation fails:

- do not close the workpack
- return or display `blocking_errors`

Meaning:

- no partial close state is allowed
- no status update is allowed on failed validation

## 7. Certification Requirement

Workpack close enforcement must also verify certification evidence exists.

Required certification metadata:

- `certified_by` exists
- `certified_at` exists

Meaning:

- workpack close must not rely on status text alone
- close must require actual engineer certification evidence

## 8. Data Integrity Rules

Workpack close enforcement must preserve the following integrity guarantees.

### 8.1 No Partial Closure

- closure must not partially update the workpack
- if validation fails, nothing about closure state may be committed

### 8.2 Immediate Validation Before Close

- validation must run immediately before close
- earlier preview or earlier UI checks are not sufficient on their own

### 8.3 No Bypass Allowed

- no controller shortcut may bypass validation
- no service shortcut may bypass validation
- no direct status update may bypass `closeWorkpack(workpackId, userId)`

### 8.4 Execution Integrity

- execution rows must remain `CERTIFIED_BY_ENGINEER`
- execution rows must never become `LOCKED`

### 8.5 Status Integrity

- task-card terminal states accepted for close:
  - `CERTIFIED_BY_ENGINEER`
  - `LOCKED`
- execution terminal state accepted for close:
  - `CERTIFIED_BY_ENGINEER`

## 9. Enforcement Summary

The close gate must behave as follows:

1. enter through `closeWorkpack(workpackId, userId)`
2. validate tasks
3. validate executions
4. validate compliance
5. validate snags
6. validate certification evidence
7. return `{ can_close, blocking_errors }`
8. close only if `can_close = true`
9. otherwise do not close and surface blockers

## Verification

- enforcement entry point defined: PASS
- required validations defined: PASS
- blocking conditions defined: PASS
- validation result contract defined: PASS
- success rule defined: PASS
- failure rule defined: PASS
- certification requirement defined: PASS
- data integrity rules defined: PASS
