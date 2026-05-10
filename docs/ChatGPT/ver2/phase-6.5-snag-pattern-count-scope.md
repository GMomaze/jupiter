# Phase 6.5 — Snag Pattern Count Scope

Defined ✅
Implemented ⬜
Verified ⬜

---

# 1. GOAL

Define the intended scope of recurring snag pattern counting for:

- occurrence_count

This phase clarifies whether recurring snag suggestions should count:

- current workpack only
OR
- full aircraft history across all workpacks

---

# 2. CURRENT OBSERVED BEHAVIOUR

On the execution page, the current workpack shows 3 visible snags:

- RH Tyre worn
- R/H tyre worn
- right tyre worn

But the suggestion block shows:

- rh tyre worn
- 5 occurrences

This indicates the current recurring pattern query is counting matching snag patterns across the aircraft history, not only the currently open workpack.

---

# 3. DECISION

The expected behaviour for occurrence_count is:

- Use full aircraft history across all workpacks for the same aircraft

This means occurrence_count is not limited to the current workpack.

---

# 4. RATIONALE

Using full aircraft history is the preferred behaviour because:

- recurring defects are aircraft-level maintenance signals
- the same issue may repeat across multiple workpacks over time
- limiting counts to one workpack can hide meaningful recurrence patterns
- engineers need historical context to identify repeat faults reliably

---

# 5. EXPECTED SYSTEM BEHAVIOUR

## 5.1 Counting scope

When generating recurring snag pattern suggestions:

- group by normalised_description
- count all matching snags for the same aircraft
- include snags from all workpacks linked to that aircraft

## 5.2 Meaning of occurrence_count

occurrence_count must mean:

- total number of occurrences of this normalised snag pattern on this aircraft

It must not mean:

- count within the current workpack only

---

# 6. UI WORDING REQUIREMENT

To avoid ambiguity, the UI should make the counting scope explicit.

Recommended future wording:

"5 occurrences on this aircraft"

This wording is preferred over:

- "5 occurrences"

because it clearly communicates that the count includes aircraft history.

---

# 7. RULES

- DEFINE only
- No implementation code
- No schema changes
- No UI changes yet
- No service changes yet

---

# 8. EXCLUSIONS

Do NOT define this phase as:

- current workpack-only counting
- per-page visible snag counting
- fuzzy or estimated recurrence detection

Do NOT change:

- normalised_description shape
- latest_created_at meaning
- occurrence_count calculation logic in this phase

---

# 9. SUCCESS CRITERIA

Phase is PASS if:

- the scope of occurrence_count is defined unambiguously
- the expected behaviour is full aircraft history across all workpacks
- future UI wording is specified to make the scope clear

---

# 10. STATUS

Defined ✅
Implemented ⬜
Verified ⬜
