Phase 5.2 — Snag Pattern Visibility

Defined ✅
Implemented ⬜
Verified ✅

Goal:
Show possible recurring snag patterns in the internal UI.

Scope:
- Read-only visibility only
- Internal users only
- No customer-facing view
- No workflow blocking
- No automatic alerts

Requirements:
1. Show possible recurring snag patterns for an aircraft.
2. Use existing read-only method:
   getSnagPatternSummaryForAircraft(aircraftId)
3. Display:
   - normalised_description
   - occurrence_count
   - latest_created_at
   - open_count
   - closed_count
4. Clearly label as:
   "Possible recurring snags"
5. Do not mark anything as confirmed recurring yet.

Rules:
- No schema changes
- No snag lifecycle changes
- No workpack close-rule changes
- No compliance changes
- No task lifecycle changes
- No customer portal
- No analytics beyond display