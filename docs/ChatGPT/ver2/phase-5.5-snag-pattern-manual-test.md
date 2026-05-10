Phase 5.5 — Snag Pattern Manual Test

Defined ✅
Implemented ✅
Verified ✅

---

# 1. GOAL

Manually validate snag pattern detection, visibility, and highlighting in the internal execution UI.

This phase confirms that repeated snag descriptions are surfaced correctly to internal users without changing workflow behaviour.

---

# 2. TEST FLOW

1. Open a workpack execution page for an aircraft with repeated snag history.

Expected:
- the page loads normally
- the aircraft workpack execution screen is visible

2. Verify the section:
- "Possible recurring snags"

Expected:
- section is visible on the internal execution page
- section is clearly informational only

3. Verify pattern rows display:
- normalised_description
- occurrence_count
- latest_created_at
- open_count
- closed_count

Expected:
- each visible pattern row includes all required fields

4. Verify only repeated snag groups appear.

Expected:
- only patterns with occurrence_count >= 2 are shown

5. Verify repeated left/right wording is normalised.

Examples to check if data exists:
- l/h, lh, left-hand → left
- r/h, rh, right-hand → right

Expected:
- equivalent snag descriptions appear grouped together under the same normalised pattern

6. Verify filler and punctuation normalization if matching data exists.

Examples:
- "the left flap crack"
- "left flap crack"
- "left flap, crack"

Expected:
- these appear as the same normalised recurring pattern where applicable

7. Verify snag highlighting in the execution snag list.

Expected:
- snags matching a displayed recurring pattern show:
  - "Possible recurring issue"

8. Verify highlight style is non-blocking.

Expected:
- highlight is subtle
- no popup
- no alert
- no forced action

9. Verify non-matching snags are not highlighted.

Expected:
- only matching repeated-pattern snags show the recurring marker

10. Verify no workflow change occurred.

Expected:
- snag create still works
- snag start still works
- snag resolve still works
- snag close still works
- workpack close rules remain unchanged

---

# 3. RULES

- No code changes during test
- Record PASS / FAIL per step
- Capture any false-positive or false-negative matches
- Capture any normalisation mismatch examples

---

# 4. STATUS

Defined ✅
Implemented ⬜
Verified ⬜
