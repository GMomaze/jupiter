Phase 4.1 — Snag Lifecycle

Defined ✅
Implemented ✅
Verified ✅

Result:
- SnagService exists
- createSnag creates OPEN snags
- startSnag: OPEN → IN_PROGRESS
- resolveSnag: IN_PROGRESS → RESOLVED
- closeSnag: RESOLVED → CLOSED
- Invalid transitions blocked
- No schema changes
- No compliance/task/workpack lifecycle changes
- Service now only operates on workpack_snags

Note:
task_id support deferred because workpack_snags has no task_id column.

---

# 1. GOAL

Introduce a proper snag lifecycle that integrates into daily maintenance workflow.

Snags must:
- Represent defects / issues
- Be linked to workpacks and aircraft
- Be trackable from open to closure
- Prevent incorrect workpack closure

---

# 2. ENTITY

Table: workpack_snags

Already exists.

---

# 3. STATUS MODEL (LOCKED)

Snag status:

OPEN
→ IN_PROGRESS
→ RESOLVED
→ CLOSED

Rules:
- OPEN: newly created snag
- IN_PROGRESS: actively being worked
- RESOLVED: fix completed, awaiting confirmation
- CLOSED: verified complete

No other statuses allowed.

---

# 4. CREATION

A snag must be creatable:

- From workpack execution
- Linked to:
  - workpack_id
  - aircraft_id
  - (optional) task_id

Fields required:
- description
- created_by
- created_at

---

# 5. LIFECYCLE RULES

---

## 5.1 TRANSITIONS

Allowed transitions:

OPEN → IN_PROGRESS  
IN_PROGRESS → RESOLVED  
RESOLVED → CLOSED  

No backward transitions.

---

## 5.2 BLOCKING RULE

Already enforced (Phase 2.6):

Workpack cannot close if any snag:

status != CLOSED

This must remain unchanged.

---

## 5.3 OWNERSHIP

- created_by must be stored
- optional assigned_to (future)

---

# 6. SERVICE METHODS

Define:

createSnag(...)
startSnag(...)
resolveSnag(...)
closeSnag(...)

---

# 7. UI REQUIREMENTS (HIGH LEVEL ONLY)

- Show snags on workpack page
- Show status
- Allow transition buttons

(No UI implementation in this phase)

---

# 8. RULES

- No changes to compliance logic
- No changes to workpack lifecycle rules
- No changes to task lifecycle
- No schema changes unless absolutely required

---

# 9. EXCLUSIONS

Do NOT:
- implement analytics
- implement recurrence
- implement notifications

---

# 10. STATUS

Defined ✅
Implemented ⬜
Verified ⬜