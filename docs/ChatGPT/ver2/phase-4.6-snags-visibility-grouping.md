Phase 4.6 — Snag Visibility + Grouping

Defined ✅
Implemented ✅
Verified ✅

---

# 1. GOAL

Improve snag visibility so workpack users can quickly understand:

- open snags
- closed snags
- snag status distribution
- which snags still block workpack closure

This prepares for future recurring snag detection but does NOT implement recurrence yet.

---

# 2. REQUIREMENTS

## 2.1 Workpack snag summary

Show a summary for the current workpack:

- total snags
- open / active snags
- resolved snags
- closed snags

---

## 2.2 Blocking visibility

Clearly show:

- which snags block workpack close
- why workpack cannot close if snags remain open

---

## 2.3 Grouping

Group snags by status:

- OPEN
- IN_PROGRESS
- RESOLVED
- CLOSED

---

# 3. RULES

- No schema changes
- No recurrence detection
- No analytics
- No compliance changes
- No task lifecycle changes
- No workpack close-rule changes
- UI/read-only improvement only

---

# 4. EXCLUSIONS

Do NOT:
- add recurring snag detection
- add customer-facing snag views
- add notifications
- add assignment logic

---

# 5. STATUS

Phase 4.6 — Snag Visibility + Grouping

Defined ✅
Implemented ✅
Verified ✅
