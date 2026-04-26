Phase 2.5 — Record compliance completion

Phase 2.5.1 — Mark workpack_compliance complete on task certification

Defined ✅
Implemented ✅
Verified ✅

Result:
- Compliance-linked task certification updates workpack_compliance
- status becomes COMPLETED
- completed_at is set
- aircraft_compliance not updated yet
- task lifecycle unchanged
- execution model unchanged
- close rules unchanged

Goal:
When a task linked to a compliance item is certified, update the matching workpack_compliance row.

Trigger:
Task status changes to CERTIFIED_BY_ENGINEER.

Rules:
- Only apply when task_cards.compliance_item_id is not null
- Update matching workpack_compliance by task_id
- Set:
  - status = COMPLETED
  - completed_at = now
- Do not update aircraft_compliance yet
- Do not change task lifecycle


2.5.2 Update aircraft_compliance after compliance task certification

Defined ✅
Implemented ✅
Verified ✅

Result:
- Runs only when task has compliance_item_id
- Finds aircraft_compliance by aircraft_id + compliance_item_id
- Sets status = COMPLIANT
- Sets last_complied_at
- Sets last_complied_hours from aircraft.total_time_hours
- Does NOT calculate recurrence yet
- Does NOT modify next_due_hours / next_due_at
- Workpack compliance logic unchanged
- Task lifecycle unchanged

Goal:
When a compliance task is engineer certified, update the aircraft_compliance record.

Trigger:
Task status = CERTIFIED_BY_ENGINEER AND task has compliance_item_id

Rules:
- Find matching aircraft_compliance by:
  aircraft_id + compliance_item_id
- Update:
  - status = COMPLIANT
  - last_complied_at_date = current timestamp
  - last_complied_at_hours = aircraft.total_time_hours
- Recalculate next_due:
  - if recurring → next_due_hours / next_due_at
  - if not recurring → leave null
- Do not change task lifecycle
- Do not change workpack lifecycle