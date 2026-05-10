# Phase 10.9 - Workpack Certification State

## Phase

- Active Phase: 10.9 - Workpack Certification State
- Mode: IMPLEMENT
- Execution Type: READ-ONLY documentation phase

## Scope

This phase defines the workpack-level certification state for Jupiter.

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
- `docs/ChatGPT/ver3/phase-10.5-workpack-close-enforcement.md`

## 1. Workpack Certification State

The workpack certification state is:

- `CERTIFIED`

Meaning:

- `CERTIFIED` is the workpack-level state that confirms execution and certification requirements have passed
- `CERTIFIED` is reached before final workpack close
- workpack certification is separate from individual task lock state

## 2. Certification Gate

A workpack may become `CERTIFIED` only when all Phase 10.4 completion rules pass.

Required gate conditions:

- all related `task_cards.status` values are `CERTIFIED_BY_ENGINEER` or `LOCKED`
- all related `workpack_executions.status` values are `CERTIFIED_BY_ENGINEER`
- all applicable compliance items are completed
- all related snags are `CLOSED`

Meaning:

- no workpack may become `CERTIFIED` early
- task mechanic completion alone is not sufficient
- partial certification is not allowed

## 3. Status Transition

The certification transition is:

- `workpack.status -> CERTIFIED`

This transition is allowed only after immediate validation confirms the certification gate has passed.

The transition must not occur when:

- any task remains `OPEN`
- any task remains `IN_PROGRESS`
- any task remains `COMPLETED_BY_MECHANIC`
- any execution remains `OPEN`
- any execution remains `IN_PROGRESS`
- any execution remains `COMPLETED_BY_MECHANIC`
- any required compliance item is incomplete
- any snag is not `CLOSED`

## 4. Certification Metadata

When a workpack becomes `CERTIFIED`, the system must store:

- `certified_by`
- `certified_at`

Meaning:

- certification must record who performed the workpack-level certification
- certification must record when the workpack-level certification occurred
- status alone is not sufficient without certification evidence

## 5. Validation Result

Workpack certification validation must produce:

- `can_certify`
- `blocking_errors`

### 5.1 can_certify

- `true` only when all certification gate rules pass
- `false` if any blocker exists

### 5.2 blocking_errors

`blocking_errors` must clearly identify why certification is blocked, including:

- uncertified tasks
- uncertified executions
- incomplete compliance
- open snags
- missing certification metadata requirements

## 6. Failure Rule

If certification validation fails:

- do not change workpack status
- do not set certification metadata
- return or display `blocking_errors`

Meaning:

- no partial certification state is allowed
- no workpack may appear certified without complete supporting data

## 7. Relationship to Task and Execution States

Workpack certification depends on lower-level execution state but does not replace it.

Rules:

- tasks remain `CERTIFIED_BY_ENGINEER` or `LOCKED`
- executions remain `CERTIFIED_BY_ENGINEER`
- `LOCKED` exists only on `task_cards`
- `workpack_executions` never become `LOCKED`

Meaning:

- workpack certification confirms the whole pack is ready at a system level
- task and execution records keep their own final valid states

## 8. Relationship to Workpack Close

`CERTIFIED` is not the same as `CLOSED`.

Interpretation:

- a workpack first becomes `CERTIFIED` when completion rules pass
- the later close flow may use the certified state as a prerequisite or enforced checkpoint
- close enforcement must still run immediate validation before final close

## 9. Data Integrity Rules

Workpack certification must preserve these integrity rules:

- certification validation must run immediately before the status update
- no bypass path may set `workpack.status = CERTIFIED` directly
- no partial updates may occur
- `certified_by` must exist when `workpack.status = CERTIFIED`
- `certified_at` must exist when `workpack.status = CERTIFIED`
- certification must not modify compliance state, task status, or execution status beyond approved certification rules

## 10. Workpack Certification Summary

- workpack certification state is `CERTIFIED`
- certification is allowed only when all Phase 10.4 completion rules pass
- certification must set `certified_by` and `certified_at`
- certification must be blocked if any task, execution, compliance, or snag rule fails
- no early certification is allowed
- no partial certification is allowed

## Verification

- certification state defined: PASS
- certification gate defined: PASS
- status transition defined: PASS
- certification metadata defined: PASS
- failure rule defined: PASS
- relationship to task and execution states defined: PASS
- relationship to close defined: PASS
- data integrity rules defined: PASS
