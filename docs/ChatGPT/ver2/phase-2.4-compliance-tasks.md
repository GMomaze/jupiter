Phase 2.4 — Generate tasks from compliance

2.4.0 Add compliance_item_id to task_cards

Defined ✅
Implemented ✅
Verified ✅

Result:
- task_cards.compliance_item_id added
- FK to compliance_items.id correct
- Index exists
- TaskCard model updated
- No logic changed yet

2.4.1 Create tasks from workpack_compliance

Defined ✅
Implemented ✅
Verified ✅

Result:
- workpack_compliance row created
- task_id populated
- compliance task created
- task status = OPEN
- compliance_item_id linked correctly

Goal:
Create executable task_cards rows for planned compliance items attached to a workpack.

Rules:
- Source = workpack_compliance rows with status = PLANNED
- Create one task per compliance item
- Link task_cards.compliance_item_id
- Link task to workpack through workpack_tasks
- Update workpack_compliance.task_id
- Do not create duplicates
- Do not change workpack lifecycle or close rules yet

Task fields:
- workpack_id
- title = compliance code + title
- description = compliance description
- compliance_item_id (new link)
- status = OPEN

Note:
Compliance task creation failures are logged/skipped inside the current resilience catch. Accepted for now.