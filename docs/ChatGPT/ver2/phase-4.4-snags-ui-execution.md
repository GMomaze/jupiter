Phase 4.4 — Snag UI / Execution Screen Integration

Defined ✅
Implemented ✅
Verified ✅

Goal:
Allow users to create and view snags from the workpack execution workflow.

Scope:
- UI/controller integration only
- Use existing SnagService / TaskExecutionService methods
- No new schema
- No recurrence detection
- No analytics

Requirements:
1. Show snags for the current workpack on the execution page.
2. Show open snags clearly.
3. Add a form/button to create a snag from execution page.
4. Creating a snag must require:
   - workpack_id
   - aircraft_id
   - description
   - user_id
5. Creating a snag must NOT change:
   - task status
   - execution status
   - workpack status
6. Existing workpack close blocking remains unchanged.

Rules:
- No schema changes
- No task lifecycle changes
- No compliance changes
- No document/PDF changes
- No customer portal work