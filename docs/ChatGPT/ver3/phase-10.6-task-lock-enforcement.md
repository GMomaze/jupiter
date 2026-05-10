# Phase 10.6 - Task Lock Enforcement

## Phase

- Active Phase: 10.6 - Task Lock Enforcement
- Mode: IMPLEMENT
- Execution Type: READ-ONLY rules definition

## Scope

This phase defines how task lock enforcement must behave in Jupiter.

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

## 1. Lock Eligibility

A task is eligible for lock only when:

- `task_cards.status = CERTIFIED_BY_ENGINEER`

Meaning:

- `OPEN` is not lockable
- `IN_PROGRESS` is not lockable
- `COMPLETED_BY_MECHANIC` is not lockable
- `LOCKED` is already final and cannot be locked again

## 2. Lock Action

The lock action is:

- `task_cards.status -> LOCKED`

Meaning:

- lock changes the task-card state only
- lock does not create a new lifecycle branch
- lock is a finalization action applied after engineer certification

## 3. Lock Enforcement Must Prevent

Once `task_cards.status = LOCKED`, the system must prevent all further task execution mutation.

### 3.1 Prevent Further Status Transitions

Locked tasks must not transition to any other task status.

Prevent:

- `LOCKED -> OPEN`
- `LOCKED -> IN_PROGRESS`
- `LOCKED -> COMPLETED_BY_MECHANIC`
- `LOCKED -> CERTIFIED_BY_ENGINEER`

### 3.2 Prevent Execution Status Changes

Locked tasks must not trigger further `workpack_executions.status` changes.

Meaning:

- execution state remains fixed at certified completion state
- no post-lock execution transition is allowed

### 3.3 Prevent Execution Data Modification

Locked tasks must not allow modification of execution-linked data.

Prevent:

- editing execution notes
- editing execution metadata
- editing execution timestamps through normal task flow

### 3.4 Prevent Measurements Modification

Locked tasks must not allow:

- adding measurements
- editing measurements
- replacing measurements
- deleting measurements through task execution flow

### 3.5 Prevent Work Performed Modification

Locked tasks must not allow:

- adding work performed content
- editing work performed content
- replacing work performed content

### 3.6 Prevent Signature Modification

Locked tasks must not allow:

- adding signatures through normal task execution flow
- editing existing signature records through task execution flow
- replacing certification/sign-off evidence through task execution flow

### 3.7 Prevent Adding or Modifying Snags Via Task Context

Locked tasks must not allow task-context mutation that changes defect tracking for that locked task.

Prevent:

- adding task-context snags as if execution were still active
- modifying task-context snag linkage through locked task execution flow

## 4. Allowed Behavior After Lock

Locked tasks must still allow:

- viewing
- reporting
- inclusion in workpack closure

Meaning:

- locked tasks remain visible
- locked tasks remain reportable in workpack outputs
- locked tasks may count toward close validation

## 5. Consistency Rule

If:

- `task_cards.status = LOCKED`

Then:

- `workpack_executions.status = CERTIFIED_BY_ENGINEER`

Meaning:

- locked tasks must remain backed by a certified execution record
- execution rows must not diverge into any non-certified state after lock

## 6. Forbidden Lock Conditions

The system must forbid:

- locking before certification
- unlocking
- editing locked data
- creating new execution attempts

### 6.1 Locking Before Certification

A task must not lock unless:

- `task_cards.status = CERTIFIED_BY_ENGINEER`

### 6.2 Unlocking

There must be no normal lifecycle path from:

- `LOCKED` to any editable state

### 6.3 Editing Locked Data

Once locked, the task must not allow edits to:

- task execution state
- execution-linked content
- measurements
- work performed
- signatures

### 6.4 Creating New Execution Attempts

Lock must prevent creation of new execution attempts for that task/workpack context.

Meaning:

- no new attempt row should be created after lock
- no retry execution flow should start from a locked task

## 7. Data Integrity Rules

Task lock enforcement must preserve the following integrity guarantees.

### 7.1 LOCKED Only Exists on task_cards

`LOCKED` is valid only on:

- `task_cards.status`

### 7.2 Execution Status Must Never Be LOCKED

`workpack_executions.status` must never be:

- `LOCKED`

Execution rows must remain at:

- `CERTIFIED_BY_ENGINEER`

when the related task card is locked.

### 7.3 Lock Must Not Create Partial State

Lock must not leave the task in a partially updated state.

Meaning:

- lock validation must run before lock
- if lock is not allowed, no status mutation may occur

### 7.4 Lock Must Preserve Closure Compatibility

A locked task must still satisfy workpack close rules as a terminal task-card state, provided:

- task status is `LOCKED`
- related execution is `CERTIFIED_BY_ENGINEER`
- all other workpack close requirements remain satisfied

## 8. Enforcement Summary

Task lock enforcement must behave as follows:

1. allow lock only if `task_cards.status = CERTIFIED_BY_ENGINEER`
2. set `task_cards.status -> LOCKED`
3. leave `workpack_executions.status = CERTIFIED_BY_ENGINEER`
4. prevent all further task execution mutation
5. allow viewing, reporting, and workpack close inclusion only
6. forbid unlock and forbid new execution attempts

## Verification

- lock eligibility defined: PASS
- lock action defined: PASS
- post-lock prevention rules defined: PASS
- allowed post-lock behavior defined: PASS
- task/execution consistency rule defined: PASS
- forbidden lock conditions defined: PASS
- data integrity rules defined: PASS
