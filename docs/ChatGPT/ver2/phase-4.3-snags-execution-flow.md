Phase 4.3 — Snags in Execution Flow

Defined ✅
Implemented ✅
Verified ✅

Result:
- createExecutionSnag(...) exists
- Delegates to SnagService.createSnag(...)
- Retrieval delegates added
- No task/execution/workpack/compliance logic changed

---

# 1. GOAL

Allow snags to be created and used during task execution.

This makes snags part of real maintenance workflow.

---

# 2. BEHAVIOUR

---

## 2.1 CREATE DURING EXECUTION

A snag can be created while executing a task.

Trigger:
- execution screen / service layer

Implementation (service level only):
- call createSnag(...)
- must require:
  - workpack_id
  - aircraft_id
  - description
  - user_id

---

## 2.2 CONTEXT AWARE (NO SCHEMA CHANGE)

A snag may originate from a task.

For this phase:
- DO NOT persist task_id
- DO NOT change schema
- task context is temporary only

---

## 2.3 RETRIEVE DURING EXECUTION

Execution layer must be able to:

- fetch all snags for workpack
- fetch open snags

Use existing:
- getSnagsForWorkpack(...)
- getOpenSnagsForWorkpack(...)

---

## 2.4 EXECUTION SAFETY

Creating a snag must:
- NOT change task status
- NOT change execution state
- NOT auto-resolve anything

---

## 2.5 BLOCKING CONFIRMATION

Already enforced:

Workpack cannot close if:
status != CLOSED

Do NOT modify.

---

# 3. RULES

- No schema changes
- No lifecycle changes
- No UI work
- No compliance changes
- No task lifecycle changes

---

# 4. EXCLUSIONS

Do NOT:
- auto-link snags to tasks
- auto-create tasks from snags
- add assignment logic
- add notifications

---

# 5. STATUS

Defined ⬜
Implemented ⬜
Verified ⬜