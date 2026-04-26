Phase 5.4 — Snag Pattern Highlighting

Defined ⬜
Implemented ⬜
Verified ⬜

---

# 1. GOAL

Highlight possible recurring snags directly in the execution workflow.

Make engineers aware of patterns at the moment of work.

---

# 2. BEHAVIOUR

---

## 2.1 Highlight in execution page

When showing snags:

If a snag matches a detected pattern:

- visually highlight it
- add label:
  "Possible recurring issue"

---

## 2.2 Matching rule

A snag is considered part of a pattern if:

- its normalised description matches a pattern group
- occurrence_count >= 2

---

## 2.3 Visual style

- subtle highlight (not blocking)
- no alerts
- no popups

---

# 3. RULES

- No schema changes
- No workflow changes
- No blocking behaviour
- No alerts
- No automation
- No lifecycle changes
- Read-only enhancement only

---

# 4. EXCLUSIONS

Do NOT:
- block workpack
- create tasks automatically
- notify users
- modify snag records

---

# 5. STATUS

Defined ⬜
Implemented ⬜
Verified ⬜
