Phase 2.1 — Compliance data model

2.1.1 Define required tables

Defined ✅
Implemented ⬜
Verified ⬜

Goal:
Create the minimum database structure needed for AD/SB compliance tracking.

Tables needed:
- compliance_items
- aircraft_compliance
- workpack_compliance

Design decisions locked:
- Reuse service_bulletins as SB source data
- Add generic compliance_items for AD/SB tracking
- Add aircraft_compliance for aircraft-level compliance status
- Add workpack_compliance for workpack-level compliance execution
- Do not delete or replace legacy tables yet

Final adjustments:
- aircraft_compliance.status:
  - DUE
  - IN_PROGRESS
  - COMPLIANT
  - NOT_APPLICABLE

- compliance_items unique rule:
  - unique(item_type, code)
  - revision is descriptive only

- Due logic:
  - next_due_hours must be evaluated against aircraft.total_time_hours
  - next_due_at must be evaluated against date logic in application layer

Rules:
- Do not modify existing workpack flow yet
- Do not generate tasks yet
- Do not change close/certification rules yet
- Design first, migration second

2.1.2 Create compliance migrations

Defined ✅
Implemented ✅
Verified ✅

Result:
- compliance_items exists
- aircraft_compliance exists
- workpack_compliance exists
- constraints correct
- indexes correct
- no backfill yet