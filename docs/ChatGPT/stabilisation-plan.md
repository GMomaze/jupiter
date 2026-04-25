Jupiter Stabilisation Plan
Phase 0 — Freeze the rules
0.1 Create/confirm these docs
    • ✅ AI_CONTEXT.md 
    • ✅ docs/workflows.md 
    • ✅ docs/stabilisation-plan.md 
0.2 Rule
✅ No new features until Phase 1 and Phase 2 are complete.

Phase 1 — Verify the real system
1.1 Database truth
    • ✅ Export schema: 
pg_dump -h 127.0.0.1 -U postgres -d jupiter_db --schema-only -f "C:\GMO\Projects\jupiter\docs\ChatGPT\schema.sql"
    • Confirm these tables exist: 
        ◦ ✅ workpacks 
        ◦ ✅ task_cards 
        ◦ ✅ workpack_tasks 
        ◦ ✅ workpack_executions 
        ◦ ✅ workpack_measurements 
        ◦ ✅ workpack_signatures 
        ◦ ✅ workpack_snags 
        ◦ ✅ rf_workpack_status 
1.2 Compare code vs database

✅ certified_by and certified_at confirmed in DB

✅ DB structures checked for:
- task_cards
- workpack_executions
- workpack_measurements
- workpack_snags

✅ Compare model files against DB:
- src/models/core/Workpack.ts
- src/models/core/TaskCard.ts
- src/models/core/WorkpackExecution.ts
- src/models/core/WorkpackMeasurement.ts
- src/models/core/WorkpackSnag.ts

✅ For each mismatch, classify:
- model missing field
- DB missing field
- migration missing/incorrect
- intentional unused legacy field

✅ Do NOT change migrations until mismatch is classified.

✅ Update docs/workflows.md if schema proves anything different.

✅ Add/confirm docs/database.md.

Phase 2 — Remove broken/stale flows
2.1 ✅ Deal with stale execution page
File:
src/views/workpacks/execution.ejs
    • Check if any route still renders it 
    • If unused: remove route/view reference 
    • If used: update it to current routes only: 
        ◦ /start 
        ◦ /work-note 
        ◦ /complete 
        ◦ /sign 
        ◦ /lock 
Reason: Codex confirmed this page posts to routes that do not exist. 
Result:
execution.ejs is still used by:
- GET /workpacks/:id/execution
- WorkpackController.renderExecution

Confirmed current routes only:
- /start
- /work-note
- /complete
- /sign
- /close

Old stale routes removed/absent:
- /measurement
- /note
- /sign/mechanic
- /sign/engineer 

Phase 3 — Fix Data Integrity
3.1  ✅Prevent wrong-aircraft task assignment
Goal:
✅A task must not be linked to a workpack for a different aircraft.
File likely involved:
✅src/modules/workpacks/workpack.service.ts
Rule:
✅ task_cards.aircraft_id must equal workpacks.aircraft_id
Checklist:
    • ✅ Locate WorkpackService.addTask(...) 
    • ✅ Load the target workpack 
    • ✅ Load the task being added 
    • ✅ Compare: 
        ◦ ✅ workpack.aircraft_id 
        ◦ ✅ task.aircraft_id 
    • ✅ If they do not match, reject the add 
    • ✅ Return a clear error message:
      Task belongs to a different aircraft and cannot be added to this workpack.
    • ✅ Do not change template-task creation 
    • ✅ Do not change service-bulletin task creation 
    • ✅ Do not refactor unrelated workpack logic 
    • ✅Test manually: 
        ◦ create draft workpack for aircraft A 
        ◦ try add task from aircraft B 
        ◦ confirm it is blocked 
        ◦ try add task from aircraft A 
        ◦ confirm it works

Phase 4 — Fix status consistency

4.1 ✅ Confirm final task lifecycle

Task lifecycle:
OPEN
→ IN_PROGRESS
→ COMPLETED_BY_MECHANIC
→ CERTIFIED_BY_ENGINEER
→ LOCKED

Important:
LOCKED exists on task_cards.status, but NOT on workpack_executions.status.

4.2 ✅Define completion rule

Current behaviour (DO NOT CHANGE YET):
- Workpack close() requires ALL tasks = CERTIFIED_BY_ENGINEER
- LOCKED is NOT considered for closure
- UI uses CERTIFIED_BY_ENGINEER only

Target behaviour (TO IMPLEMENT LATER):
- Workpack may close when all tasks are:
  - CERTIFIED_BY_ENGINEER
  - OR LOCKED

- PDFs must include:
  - CERTIFIED_BY_ENGINEER
  - LOCKED

- UI must treat both as complete enough

Action:
- Do NOT change code in this phase

Reason:
- Avoid breaking existing behaviour during stabilisation
- LOCKED handling will be implemented after execution model is stable

4.3 ✅Decide execution status rule

Execution status should stay:
- OPEN
- IN_PROGRESS
- COMPLETED_BY_MECHANIC
- CERTIFIED_BY_ENGINEER

When a task is LOCKED:
- task_cards.status = LOCKED
- workpack_executions.status remains CERTIFIED_BY_ENGINEER

Reason:
DB constraint does not allow LOCKED in workpack_executions.status.

Phase 5 — Fix execution model
5.1 ✅ Choose execution rule

Current stabilisation rule:
- One task = one execution attempt only
- attempt_no is always 1
- No retry / rework system implemented yet

Important:
- Although DB supports multiple attempts (attempt_no),
  the system does NOT currently use it

Action:
- Do NOT implement retry logic in this phase

5.2 ✅ Make code honest

- Keep attempt_no = 1
- Do NOT create attempt_no = 2 anywhere
- Do NOT implement retry / rework logic
- Ensure all execution updates always target the latest (only) execution

- When a task is LOCKED:
  - Do NOT set workpack_executions.status = LOCKED
  - Keep execution status as CERTIFIED_BY_ENGINEER

- Ensure all code paths (start, complete, sign, note) assume a single execution record

- Document retry / multi-attempt execution as a future feature only

Reason:
- Schema supports attempt_no, but system does not implement it
- workpack_executions.status does not allow LOCKED
- Avoid partial / broken multi-attempt logic during stabilisation

Phase 5.2 verified — no changes required

Phase 6 — Fix measurements

6.1 ✅ Define short-term safe rule

Current behaviour:
- Measurements exist in two places:
  - workpack_measurements
  - [Captured Values] inside task_cards.work_performed

Decision:
- workpack_measurements must become the source of truth
- task_cards.work_performed should become note text only
- [Captured Values] may remain temporarily as transport only

6.2 ✅ Verify current measurement behaviour

Result:
- Measurements are written to workpack_measurements
- But they are derived from [Captured Values] in work_performed
- PDFs do not read workpack_measurements
- PDFs only strip [Captured Values]
- UI still uses legacy captured-values fallback

6.3 ✅ Design safe measurement migration path

Result:
- Current flow documented
- Target flow defined
- Files affected identified
- Risks identified
- Implementation order defined

6.4 Implementation order (safe)

1. Update task_row.ejs to support separate measurement submission while keeping legacy
2. Update workpack.service.ts to accept both formats
3. Update controller to prefer structured values
4. Update PDF services to use structured values
5. Later: remove legacy parsing

Phase 6.4 Step 1 — task_row.ejs dual payload

Defined ✅
Implemented ✅
Verified ✅

Result:
- Routes unchanged ✅
- Button/status logic unchanged ✅
- Layout stable (only measurement input rendering added) ✅
- Legacy [Captured Values] script still exists ✅
- Structured measurements_payload exists ✅
- Measurement inputs rendered and feeding payload ✅

Note:
Description rendering change is accepted as in-scope (required to render measurement inputs).

hase 6.4 Step 3 — workpack.controller.ts prefer structured values

Defined ✅
Implemented ✅
Verified ✅

Result:
- Structured measurements used first
- Legacy [Captured Values] fallback kept
- Extra structured rows preserved
- No unrelated controller changes

Phase 6.4 Step 4 — PDF services use structured values where needed

Defined ✅
Implemented ⬜
Verified ⬜

Goal:
- PDF services must not rely on [Captured Values] as measurement storage.
- PDFs must keep task note text clean.
- If measurement values are shown, they must come from workpack_measurements.

Files:
- src/modules/workpacks/pdf.service.ts
- src/modules/workpacks/pdf.release.ts
- src/modules/workpacks/pdf.crma.ts

Rules:
- Do not redesign PDF layout.
- Do not change PDF gating logic.
- Do not change task selection logic unless required for measurement correctness.
- Keep stripping [Captured Values] as a safety fallback for old records.

6.5 Test measurement workflow

Defined ✅
Implemented ✅
Verified ✅

Passed:
✅ workpack_measurements rows exist
✅ work_performed contains clean note text only
✅ PDFs do not show [Captured Values] — not applicable because current PDFs do not render measurement blocks

Result:
Phase 6 ✅ complete

Phase 7 — Snags stabilisation

Phase 7 — Snags stabilisation

7.1 ✅ Confirm snag lifecycle
Defined ✅
Verified ✅

Lifecycle:
OPEN → IN_PROGRESS → RESOLVED → CLOSED

7.2 ✅ Controls verification
Defined ✅
Verified ✅

Passed:
✅ workpack_snag_audit_log exists and is used
✅ open/non-closed snags block workpack close
✅ lifecycle matches current code
✅ no recurrence detection exists

Decision:
✅ Reopen snags is NOT implemented and will stay out of scope for stabilisation

Gaps:
- renderPackSnags tolerates missing workpack_snag_audit_log and retries without audit history
- docs/ChatGPT/database.md should be corrected: current snag code uses created_by / created_at more than reported_by / reported_at

Phase 8 — PDF/report alignment

8.1 ✅ PDF task inclusion

Defined ✅
Implemented ✅
Verified ✅

Result:
- PDFs include CERTIFIED_BY_ENGINEER
- PDFs include LOCKED
- No layout/design changes
- No unrelated PDF logic changes

8.2 ✅ Release PDF gate

Defined ✅
Implemented ✅
Verified ✅

Result:
- Release PDF still only available when workpack status = CERTIFIED

8.3 ✅ Scope control

Result:
- No redesign
- Only correctness fix applied

Phase 9 — Testing checklist

Defined ✅
Implemented ✅
Verified ✅

Result:
Full workflow tested end-to-end successfully

Confirmed:
- Task lifecycle works (OPEN → LOCKED)
- Measurements persist correctly (structured + clean note)
- Snags block closure until resolved
- Workpack closes correctly
- PDFs generate correctly
- LOCKED tasks included in PDFs
- No [Captured Values] anywhere

Phase 10 — Only after stabilisation
Do not start these before Phase 1–9:
    • Customer portal 
    • Recurring snag detection 
    • Productisation for other AMOs 
    • Rename Jupiter 
    • Advanced dashboards

Phase 10.1 — Controlled file decomposition

Known large files:
- src/modules/workpacks/workpack.service.ts — 1573 lines
- src/modules/library/library.service.ts — 816 lines
- src/modules/workpacks/workpack.controller.ts — 693 lines
- src/views/service-bulletins/index.ejs — 644 lines
- src/views/aircraft/view.ejs — 618 lines
- src/modules/workpacks/pdf.service.ts — 604 lines
- src/modules/library/library.routes.ts — 541 lines
- src/modules/aircraft/aircraft.service.ts — 539 lines
- src/modules/aircraft/aircraft.controller.ts — 509 lines


Large file cleanup Step 1 — extract measurement.service.ts

Defined ✅
Implemented ✅
Verified ✅

Result:
- Measurement helpers moved safely
- WorkpackService public API unchanged
- Measurement behaviour unchanged
- No unrelated logic changed


Large file cleanup Step 2 — extract workpack-audit.service.ts

Defined ✅
Implemented ✅
Verified ✅

Result:
- Audit helpers moved safely
- WorkpackService public API unchanged
- Execution audit logging unchanged
- Snag audit logging unchanged
- Hash-chain logic unchanged
- No unrelated logic changed

Large file cleanup Step 3 — extract workpack-execution.service.ts

Defined ✅
Implemented ✅
Verified ✅

Result:
- Execution helpers moved safely
- WorkpackService public API unchanged
- attempt_no = 1 rule unchanged
- LOCKED still maps to CERTIFIED_BY_ENGINEER for executions
- No unrelated logic changed

Large file cleanup Step 4 — extract snag.service.ts

Defined ✅
Implemented ✅
Verified ✅

Result:
- Snag methods moved safely
- WorkpackService public API unchanged
- Snag lifecycle unchanged
- No reopen logic added
- Snag audit still works
- Workpack close still blocks on open snags
- No unrelated logic changed


Large file cleanup Step 5 — extract task-execution.service.ts


Rule:
Do not refactor during stabilisation.
Review and split only after Phase 1–9 are complete.
