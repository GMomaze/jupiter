Phase 5.3 — Snag Pattern Refinement

Defined ✅
Implemented ✅
Verified ✅

---

# 1. GOAL

Improve the quality of snag pattern grouping.

Current issue:
- grouping is too literal
- small wording differences split patterns

Example:
- "oil leak left wing"
- "oil leak left wing root"

These should be grouped.

---

# 2. APPROACH

Refine normalisation only.

NO AI.
NO fuzzy libraries.

---

# 3. NORMALISATION RULES

Enhance existing normalisation:

- lowercase
- trim whitespace
- collapse spaces

Add:

- remove punctuation
- remove common filler words:
  (e.g. "the", "a", "on", "at", "of")
- standardise common terms:
  e.g.
  "l/h" → "left"
  "r/h" → "right"

---

# 4. OUTPUT

Still return:

- normalised_description
- occurrence_count
- latest_created_at
- open_count
- closed_count

---

# 5. RULES

- Read-only
- No schema changes
- No ML/AI
- No workflow impact
- No automatic grouping overrides
- Only improve grouping quality

---

# 6. EXCLUSIONS

Do NOT:
- auto-merge records
- modify existing snags
- create new tables
- introduce external libraries

---

# 7. STATUS

Defined ⬜
Implemented ⬜
Verified ⬜