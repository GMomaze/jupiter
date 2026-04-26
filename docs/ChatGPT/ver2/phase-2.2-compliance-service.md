Phase 2.2 — Compliance service (read-only)

2.2.1 Create read-only ComplianceService

Defined ✅
Implemented ✅
Verified ✅

Result:
- ComplianceService exists
- getApplicableComplianceForAircraft(...) works
- Read-only confirmed
- Due logic confirmed
- Output shape corrected
- No workpack/task coupling introduced


2.2.2 Add safe read route/view

Defined ⬜
Implemented ⬜
Verified ⬜

Status:
Deferred — not required before Phase 2.3

2.3.1 Attach compliance items on workpack creation

Defined ✅
Implemented ✅
Verified ✅

Result:
- DUE compliance item attached automatically to new workpack
- workpack_compliance row created
- status = PLANNED
- No task generation yet
- No close/certification rule change yet

Accepted for now:
⚠️ Per-item inserts are not ideal, but acceptable for current small compliance volume


Phase 2.4 — Generate tasks from compliance


---------------------------------------------------------------------------------------------

Notes
- compliance_items.status = master item status
- aircraft_compliance.stored_status = aircraft-level DB status
- aircraft_compliance.computed_status = derived due status