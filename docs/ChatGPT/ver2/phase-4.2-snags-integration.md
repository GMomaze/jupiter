Phase 4.2 — Snag Integration into Workpack Execution

Phase 4.2 — Snag Integration into Workpack Execution

Defined ✅
Implemented ✅
Verified ✅

Result:
- getSnagsForWorkpack(workpackId) exists
- getOpenSnagsForWorkpack(workpackId) exists
- Both methods are read-only
- Existing snag lifecycle methods unchanged
- No schema/UI/controller/route changes

---

# 1. GOAL

Integrate snags into real workpack execution flow.

Snags must become:
- visible
- actionable
- part of execution workflow

---

# 2. BEHAVIOUR

---

## 2.1 CREATE FROM EXECUTION

A snag can be created while executing a task.

Trigger:
- workpack execution screen

Result:
- createSnag(...) is called
- snag linked to workpack + aircraft

(No UI implementation in this phase)

---

## 2.2 TASK CONTEXT (READ-ONLY)

Snag may optionally be linked to:
- task_id (future)

For this phase:
- DO NOT persist task_id
- DO NOT change schema

---

## 2.3 VISIBILITY (SERVICE LEVEL)

Provide method:

getSnagsForWorkpack(workpackId)

Must:
- return all snags for the workpack
- include status
- include description
- include created_by
- include created_at

---

## 2.4 ACTIVE SNAGS

Provide method:

getOpenSnagsForWorkpack(workpackId)

Must return:
- snags where status != CLOSED

---

## 2.5 BLOCKING RULE (CONFIRMATION)

Already enforced:

Workpack cannot close if any snag:
status != CLOSED

Do NOT modify this rule.

---

# 3. SERVICE METHODS

Add:

getSnagsForWorkpack(...)
getOpenSnagsForWorkpack(...)

---

# 4. RULES

- No schema changes
- No changes to lifecycle rules
- No UI work
- No compliance changes
- No task lifecycle changes

---

# 5. EXCLUSIONS

Do NOT:
- add filtering logic beyond status
- add pagination
- add assignment logic

---

# 6. STATUS

Defined ✅
Implemented ⬜
Verified ✅