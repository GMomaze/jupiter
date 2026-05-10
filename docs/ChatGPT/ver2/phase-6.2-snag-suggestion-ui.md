Phase 6.2 — Snag Suggestion UI

Defined ✅
Implemented ✅
Verified ✅

---

# 1. GOAL

Show a non-intrusive suggestion to the engineer when a recurring snag pattern is detected.

This is guidance only — not action.

---

# 2. BEHAVIOUR

## 2.1 When to show

If a pattern exists:

- occurrence_count >= 2

---

## 2.2 What to show

Display a suggestion block:

Title:
"Possible recurring issue detected"

Content:
- normalised_description
- occurrence_count
- latest_created_at

Suggestion text:
"Consider creating a recurring inspection or maintenance task."

---

## 2.3 Where to show

On:
- workpack execution page

Near:
- snag section / pattern section

---

## 2.4 Visual style

- subtle box / muted color
- no popup
- no alert
- no modal

---

# 3. RULES

- Read-only only
- No buttons
- No task creation
- No workflow changes
- No lifecycle changes
- No compliance changes

---

# 4. EXCLUSIONS

Do NOT:
- add "create task" button
- auto-create tasks
- link to templates
- notify users
- block workpack

---

# 5. STATUS


Defined ✅
Implemented ✅
Verified ✅