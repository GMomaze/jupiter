# Phase 6.3 — Snag Suggestion Manual Test

Defined ✅
Implemented ✅
Verified ✅

---

# 1. GOAL

Manually verify that the Snag Suggestion UI (Phase 6.2) behaves correctly in the browser.

This phase confirms that:
- Suggestions appear only when expected
- The UI is read-only
- No unintended actions occur

---

# 2. TEST SCENARIOS

## 2.1 No pattern (should NOT show)

Condition:
- occurrence_count < 2

Steps:
1. Open a workpack execution page
2. Ensure snags exist but no recurring pattern

Expected:
- No suggestion block is visible

---

## 2.2 Pattern detected (should show)

Condition:
- occurrence_count >= 2

Steps:
1. Open a workpack execution page with recurring snags
2. Navigate to snag section

Expected:
- Suggestion block is visible
- Title: "Possible recurring issue detected"
- Shows:
  - normalised_description
  - occurrence_count
  - latest_created_at

---

## 2.3 Visual behaviour

Steps:
1. Observe suggestion block

Expected:
- Subtle / muted styling
- No popup
- No modal
- No alert behaviour

---

## 2.4 Read-only enforcement

Steps:
1. Inspect suggestion block

Expected:
- No buttons
- No clickable actions
- No links to create tasks
- No interaction possible

---

## 2.5 No workflow impact

Steps:
1. Complete tasks / interact with execution page

Expected:
- No change to:
  - task lifecycle
  - snag lifecycle
  - compliance
  - workpack status

---

# 3. RULES

- Manual verification only
- No code changes
- No database changes
- No UI modifications during this phase

---

# 4. SUCCESS CRITERIA

Phase is PASS if:

- Suggestions appear only when occurrence_count >= 2
- Suggestions do NOT appear when occurrence_count < 2
- UI is read-only
- No workflow or system behaviour is affected

---
Phase 6.3 — Verification Result

PASS

Summary block visible ✅
Correct title ✅
Shows normalised description ✅
Shows occurrence count ✅
Shows latest occurrence date ✅
No per-snag recurring labels ✅
No buttons/actions added ✅
No workflow impact shown ✅

-------

# 5. STATUS

Defined ✅
Implemented ✅
Verified ✅