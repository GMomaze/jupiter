# Phase 6.6 — Issued Workpack Edit Rules

Defined ✅
Implemented ⬜
Verified ⬜

---

# 1. GOAL

Define when an ISSUED workpack may still be changed by Planner/Admin.

This phase prevents planning mistakes from locking a workpack too early, while still protecting maintenance records once execution has started.

---

# 2. RULE

An ISSUED workpack may be edited only if execution has not started.

---

# 3. EDITS ALLOWED BEFORE EXECUTION STARTS

If workpack.status = ISSUED and execution has not started, Planner/Admin may:

- add tasks
- remove tasks
- add tasks from templates
- correct planning mistakes

---

# 4. EDITS BLOCKED AFTER EXECUTION STARTS

Once execution has started, Planner/Admin must NOT change the issued workpack.

Execution is considered started if any of the following exist:

- any task is IN_PROGRESS or later
- any execution record has captured work/finding data
- any measurement has been captured
- any signature exists
- any certification action has occurred

---

# 5. RULES

- No schema changes
- No lifecycle changes
- No compliance changes
- No document changes
- Do not allow edits to certified/released/closed workpacks
- Do not weaken execution integrity

---

# 6. SUCCESS CRITERIA

Phase is PASS if:

- ISSUED workpacks can be edited before execution starts
- ISSUED workpacks cannot be edited after execution starts
- DRAFT workpack behaviour remains unchanged
- CERTIFIED / RELEASED / CLOSED workpacks remain locked
- Backend validation enforces the rule

---

# 7. STATUS

Defined ✅
Implemented ⬜
Verified ⬜