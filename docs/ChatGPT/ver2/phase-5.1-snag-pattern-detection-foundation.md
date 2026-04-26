Phase 5.1 — Snag Pattern Detection Foundation

Defined ⬜
Implemented ⬜
Verified ⬜

---

# 1. GOAL

Create the foundation for detecting repeated / recurring snag patterns.

This phase does NOT implement full analytics.

It only prepares safe, read-only pattern visibility.

---

# 2. REQUIREMENTS

## 2.1 Basic grouping

Group historical snags by:

- aircraft_id
- normalised description text
- status

---

## 2.2 Read-only summary

Create a read-only method:

getSnagPatternSummaryForAircraft(aircraftId)

Returns:
- aircraft_id
- normalised_description
- occurrence_count
- latest_created_at
- open_count
- closed_count

---

## 2.3 Threshold

Define a basic pattern threshold:

- occurrence_count >= 2

This means:
“possible recurring snag”

---

# 3. RULES

- Read-only only
- No schema changes
- No AI/ML
- No automatic alerts
- No workflow blocking
- No customer-facing view
- No changes to snag lifecycle
- No changes to workpack close rules

---

# 4. EXCLUSIONS

Do NOT:
- auto-label recurring snags
- auto-create tasks
- notify customers
- block release
- change existing snag records

---

# 5. STATUS

Defined ⬜
Implemented ⬜
Verified ⬜