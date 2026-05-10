JUPITER — MASTER EXECUTION PLAN VER3
0. CORE RULE

Jupiter is rebuilt in this order:

CONTROL → AUDIT → MASTER LIBRARY → APPLICABILITY → TEMPLATES → WORKPACKS → EXECUTION → DOCUMENTS → CUSTOMER VISIBILITY → CLEANUP

Workpacks must not be the source of truth.

The source of truth is:

Standard Tasks
ADs
SBs
SIDs
Applicability
Templates
1. EXECUTION DISCIPLINE

Every item follows:

DEFINE → IMPLEMENT → VERIFY
ChatGPT Role
 Design only
 Produce phase documents
 Produce Codex instructions
 Verify implementation
 No direct implementation code unless explicitly requested
Codex Role
 Inspect current code
 Inspect existing migrations
 Implement approved phase only
 Preserve existing logic unless approved
 Report files changed
 Report files removed
 Report migrations added
User Role
 Provide input CSV/Excel formats
 Approve schema changes
 Approve deletion/removal
 Decide ambiguous aviation rules
2. SESSION START FORMAT

Every new session starts with:

Jupiter system — strict execution.

Use:
docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md

Rules:
- Single phase only
- DEFINE → IMPLEMENT → VERIFY
- ChatGPT designs and verifies
- Codex implements
- Full files only if code is ever returned
- No refactoring unless approved
- No file deletion unless approved
- Check existing migrations before creating new ones
- Check existing files before replacing anything
- Schema changes must be explicit
- Verify with PASS/FAIL only

Active Phase:
Mode: DEFINE / IMPLEMENT / VERIFY
3. PHASE 0 — CONTROL AND FREEZE
Goal

Stop random rebuilding.

0.1 Confirm Tool Roles
DEFINE
 Confirm ChatGPT does design and verification.
 Confirm Codex does implementation.
 Confirm no direct coding in DEFINE.
 Confirm no phase mixing.
IMPLEMENT — Codex Instruction
Do not modify code.
Create or update documentation only if requested.
Confirm current project rules.
VERIFY
 PASS if no code changed.
 PASS if rules are documented.
 FAIL if implementation happened.
0.2 Create VER3 Folder
DEFINE
 Create plan path:
docs/ChatGPT/ver3/
 Store master plan there.
IMPLEMENT — Codex Instruction
Create folder docs/ChatGPT/ver3 if missing.
Create MASTER_EXECUTION_PLAN_VER3.md.
Do not modify application code.
VERIFY
 File exists.
 No source files changed.
 No migrations changed.
0.3 Freeze Current System State
DEFINE
 Define audit output folder:
docs/ChatGPT/ver3/audit/
 Define current date snapshot.
 No fixes yet.
IMPLEMENT — Codex Instruction
Create docs/ChatGPT/ver3/audit/system-freeze.md.
Record:
- current branch
- current npm scripts
- current migration folder
- current Sequelize config
- current DB name if visible
- current application entry point
Do not modify code.
VERIFY
 Freeze doc exists.
 No source files changed.
 No migrations changed.
4. PHASE 1 — SYSTEM AUDIT
Goal

Know exactly what exists before building.

1.1 Migration Inventory
DEFINE
 Identify migration directory.
 Confirm Sequelize migrations only unless project proves otherwise.
 Check for:
 duplicate table creation
 duplicate indexes
 duplicate enum/reference data
 dropped/renamed tables
 audit trigger dependencies
 gen_random_uuid() dependencies
IMPLEMENT — Codex Instruction
Inspect all migration files.

Produce:
docs/ChatGPT/ver3/audit/migration-inventory.md

For every migration list:
- filename
- creates table
- alters table
- drops table
- creates index
- creates function
- creates trigger
- inserts seed/reference data
- risk notes

Do not modify migrations.
Do not delete files.
VERIFY
 All migrations listed.
 Duplicate risks listed.
 No migration modified.
 No migration deleted.
1.2 Table Inventory
DEFINE
 List actual DB tables.
 List columns.
 List indexes.
 List foreign keys.
 List missing expected tables.
IMPLEMENT — Codex Instruction
Inspect database schema using available project commands or SQL.

Produce:
docs/ChatGPT/ver3/audit/table-inventory.md

Do not change schema.
VERIFY
 Tables listed.
 Columns listed.
 Foreign keys listed.
 No schema changed.
1.3 Model Inventory
DEFINE
 List Sequelize models.
 Map model to table.
 Find models without tables.
 Find tables without models.
IMPLEMENT — Codex Instruction
Inspect src/models and related model registrations.

Produce:
docs/ChatGPT/ver3/audit/model-inventory.md

Do not change models.
VERIFY
 Models listed.
 Model/table mismatch listed.
 No model changed.
1.4 Route and View Inventory
DEFINE
 List routes.
 List controllers.
 List EJS views.
 Map feature to route/view/controller.
IMPLEMENT — Codex Instruction
Inspect Express routes, controllers, and views.

Produce:
docs/ChatGPT/ver3/audit/route-view-inventory.md

Do not modify files.
VERIFY
 Routes listed.
 Views listed.
 Controllers listed.
 No code changed.
1.5 Existing Feature Map
DEFINE

Map existing features:

 Workpacks
 Task cards
 Compliance
 AD import
 SB import
 Snags
 CRS
 CRMA
 Aircraft
 Components
 Users/RBAC
IMPLEMENT — Codex Instruction
Produce:
docs/ChatGPT/ver3/audit/feature-map.md

For each feature list:
- routes
- services
- models
- tables
- views
- known risks
- whether reusable for VER3

Do not modify code.
VERIFY
 Every feature mapped.
 Reusable/broken/unknown marked.
 No code changed.
5. PHASE 2 — MASTER LIBRARY SHELL
Goal

Create one central admin area for maintenance source data.

2.1 Maintenance Library Route
DEFINE
 Route:
/maintenance-library
 Admin only.
 Empty page first.
IMPLEMENT — Codex Instruction
Add route and page for Maintenance Library only.
Do not add import logic yet.
Do not change workpacks.
VERIFY
 Route opens.
 Admin can access.
 Non-admin blocked.
 Workpacks unchanged.
2.2 Library Dashboard Sections
DEFINE

Dashboard cards:

 Standard Tasks
 ADs
 SBs
 SIDs
 Applicability
 Templates
 Import Jobs
IMPLEMENT — Codex Instruction
Add dashboard cards only.
Each card may link to placeholder route.
No DB changes unless required for navigation.
VERIFY
 Cards visible.
 Links do not crash.
 No workpack changes.
6. PHASE 3 — STANDARD TASK MASTER
Goal

Import and manage reusable standard tasks independent of workpacks.

3.1 Standard Task Schema Decision
DEFINE
 Check if task_templates exists.
 Check if it is usable.
 Decide:
 reuse existing table
 create standard_tasks
 migrate old data later
IMPLEMENT — Codex Instruction
Inspect existing tables, models, migrations, and usage around task_templates and task cards.

Produce:
docs/ChatGPT/ver3/phase-3.1-standard-task-schema-decision.md

Do not modify code.
Do not create migration.
VERIFY
 Existing tables checked.
 Recommendation documented.
 No code changed.
3.2 Standard Task Migration
DEFINE

Only after 3.1 is approved.

Minimum fields:

 id
 code
 title
 description
 category
 default_interval_hours
 default_interval_months
 is_active
 source
 created_at
 updated_at
IMPLEMENT — Codex Instruction
Create idempotent Sequelize migration only if approved.
Check existing migrations first.
Do not duplicate an existing table.
VERIFY
 Migration exists.
 Migration is idempotent.
 Existing data not destroyed.
 App starts.
3.3 Standard Task Model
DEFINE
 Model maps to chosen table.
 No workpack dependency.
IMPLEMENT — Codex Instruction
Create or update StandardTask model.
Do not change workpack task logic.
VERIFY
 Model loads.
 Table mapping correct.
 No workpack break.
3.4 Standard Task CSV Preview
DEFINE
 Upload CSV.
 Parse rows.
 Show preview.
 No database write.
IMPLEMENT — Codex Instruction
Implement CSV upload preview only.
No insert/update/delete.
VERIFY
 CSV uploads.
 Preview displays.
 No DB rows inserted.
3.5 Standard Task Column Mapping
DEFINE

Map CSV columns to:

 code
 title
 description
 category
 interval_hours
 interval_months
IMPLEMENT — Codex Instruction
Add mapping UI for standard task import.
Persist mapping only if existing safe config pattern exists.
Otherwise keep mapping in request flow.
VERIFY
 User can map columns.
 Required fields marked.
 No import yet.
3.6 Standard Task Import Commit
DEFINE
 Insert valid rows.
 Skip duplicates.
 Report failed rows.
 Report imported count.
IMPLEMENT — Codex Instruction
Implement import commit for standard tasks.
Use transaction.
Do not create workpack tasks.
VERIFY
 Valid rows inserted.
 Invalid rows rejected.
 Duplicate rows skipped.
 No workpack rows created.
3.7 Standard Task Admin List
DEFINE
 List tasks.
 Search.
 Active/inactive filter.
IMPLEMENT — Codex Instruction
Add standard task list page.
No edit yet unless specified.
VERIFY
 List loads.
 Search works.
 Filter works.
3.8 Standard Task Edit/Deactivate
DEFINE
 Edit title/description/category.
 Toggle active/inactive.
 Do not delete.
IMPLEMENT — Codex Instruction
Implement edit and deactivate only.
Do not hard delete records.
VERIFY
 Edit works.
 Deactivate works.
 Inactive records retained.
7. PHASE 4 — AD MASTER
Goal

Import ADs as master compliance source items.

4.1 AD Schema Decision
DEFINE

Check existing:

 compliance_items
 AD import tables
 workpack compliance tables
 service tables
 migrations
IMPLEMENT — Codex Instruction
Inspect current AD/compliance structures.

Produce:
docs/ChatGPT/ver3/phase-4.1-ad-schema-decision.md

No code changes.
VERIFY
 Existing AD structures documented.
 Reuse/new decision proposed.
 No code changed.
4.2 AD Master Migration
DEFINE

Minimum ad_items:

 id
 ad_number
 revision
 title
 authority
 effective_date
 ad_type
 summary
 recurring
 interval_hours
 interval_months
 is_active

Minimum ad_applicability:

 id
 ad_id
 applies_to_type
 manufacturer_id
 model_id
 component_model_id
 raw_applicability_text
IMPLEMENT — Codex Instruction
Create approved AD migrations.
Check for existing equivalent tables first.
Use transactions where supported.
Do not touch workpack compliance yet.
VERIFY
 Tables exist.
 FKs valid.
 No workpack change.
4.3 AD CSV/API Preview
DEFINE
 Load AD source.
 Show preview.
 No DB write.
IMPLEMENT — Codex Instruction
Implement AD preview only.
Do not insert records.
VERIFY
 Preview works.
 No rows inserted.
4.4 AD Import Commit
DEFINE
 Insert AD master rows.
 Skip duplicates.
 Log failures.
IMPLEMENT — Codex Instruction
Implement AD import commit.
Use transaction.
Do not generate workpack compliance.
VERIFY
 ADs inserted.
 Duplicates skipped.
 No workpack rows created.
4.5 AD Applicability Capture
DEFINE

Supported first:

 ALL
 manufacturer
 model
 component model

Not yet:

 complex serial ranges
 engine installation logic
 partial applicability automation
IMPLEMENT — Codex Instruction
Implement simple AD applicability records.
Store raw applicability text.
Do not attempt complex aviation parsing yet.
VERIFY
 Applicability records created.
 Raw text stored.
 No false complex parser.
4.6 AD List and Detail Pages
DEFINE
 AD list.
 AD detail.
 Show applicability.
 Show active/inactive.
IMPLEMENT — Codex Instruction
Add AD list and detail pages under Maintenance Library.
VERIFY
 List loads.
 Detail loads.
 Applicability visible.
8. PHASE 5 — SB MASTER
Goal

Import manufacturer SBs into one internal structure.

5.1 SB Schema Decision
DEFINE

Check existing:

 service bulletin module
 Veryon import
 manufacturer tables
 model tables
 compliance tables
IMPLEMENT — Codex Instruction
Inspect current SB module.

Produce:
docs/ChatGPT/ver3/phase-5.1-sb-schema-decision.md

No code changes.
VERIFY
 Existing SB code documented.
 Reuse/new decision proposed.
 No code changed.
5.2 SB Adapter Design
DEFINE

Adapters:

 Generic CSV
 Veryon CSV
 Piper CSV/PDF later
 Cessna later

Internal normalized SB object:

 manufacturer
 sb_number
 revision
 title
 issue_date
 category
 model
 raw_row
IMPLEMENT — Codex Instruction
Create adapter design document only.
No implementation unless phase is approved.
VERIFY
 Adapter contract documented.
 No code changed.
5.3 SB Migration
DEFINE

Minimum sb_items:

 id
 manufacturer_id
 sb_number
 revision
 title
 issue_date
 category
 recurring
 interval_hours
 interval_months
 is_active

Minimum sb_applicability:

 id
 sb_id
 manufacturer_id
 model_id
 component_model_id
 raw_applicability_text
IMPLEMENT — Codex Instruction
Create approved SB migrations.
Check existing tables first.
Do not duplicate current SB tables without approval.
VERIFY
 Tables exist.
 FKs valid.
 No workpack changes.
5.4 SB Preview
DEFINE
 Upload CSV.
 Select adapter.
 Preview normalized rows.
 No DB write.
IMPLEMENT — Codex Instruction
Implement SB preview only.
No insert/update/delete.
VERIFY
 Preview works.
 Adapter used.
 No DB rows inserted.
5.5 SB Import Commit
DEFINE
 Insert SB rows.
 Insert applicability.
 Missing model goes to unresolved list.
IMPLEMENT — Codex Instruction
Implement SB import commit.
Use transaction.
Do not generate workpack tasks.
VERIFY
 SB rows inserted.
 Applicability inserted.
 Missing models reported.
5.6 Missing Model Resolution
DEFINE
 Show missing model names.
 Link to existing model or create new.
 Reprocess unresolved applicability.
IMPLEMENT — Codex Instruction
Implement missing model resolution for SB imports.
Do not silently create incorrect models.
VERIFY
 Missing model visible.
 User can resolve.
 Resolved link stored.
9. PHASE 6 — SID MASTER
Goal

Import SIDs once and link them to multiple models.

6.1 SID Schema Decision
DEFINE

Check existing:

 SID tables
 task templates
 compliance items
 manufacturer/model structures
IMPLEMENT — Codex Instruction
Inspect existing SID-related structures.

Produce:
docs/ChatGPT/ver3/phase-6.1-sid-schema-decision.md

No code changes.
VERIFY
 Existing structures documented.
 No code changed.
6.2 SID Migration
DEFINE

Minimum sid_items:

 id
 sid_reference
 title
 description
 inspection_area
 source_document
 recurring
 interval_hours
 interval_months
 is_active

Minimum sid_applicability:

 id
 sid_id
 manufacturer_id
 model_id
 raw_applicability_text
IMPLEMENT — Codex Instruction
Create approved SID migrations.
Check existing tables first.
VERIFY
 Tables exist.
 One SID can link to many models.
 No workpack changes.
6.3 SID Import Preview
 Upload CSV.
 Preview only.
 No DB write.
6.4 SID Import Commit
 Insert SID rows.
 Insert model applicability.
 Report unresolved models.
6.5 SID List and Detail Pages
 List SIDs.
 Detail page.
 Show models applicable.
10. PHASE 7 — APPLICABILITY ENGINE
Goal

Answer:

What maintenance items apply to this aircraft?
7.1 Aircraft Resolution
DEFINE

Given aircraft_id, resolve:

 aircraft
 aircraft model
 manufacturer
 installed engine components
 installed propeller components
 other tracked components
IMPLEMENT — Codex Instruction
Create read-only aircraft applicability resolver.
No DB writes.
VERIFY
 Aircraft resolves.
 Model resolves.
 Components resolve.
 No data changed.
7.2 AD Applicability Query
 Match ALL.
 Match manufacturer.
 Match aircraft model.
 Match component model.
7.3 SB Applicability Query
 Match manufacturer.
 Match aircraft model.
 Match component model if supported.
7.4 SID Applicability Query
 Match aircraft model.
 Match manufacturer if general.
7.5 Standard Task Applicability

First version:

 Standard tasks are manually selected into templates.
 Not automatically applicable unless assigned later.
7.6 Unified Applicability Output

Output item shape:

 source_type
 source_id
 reference
 title
 interval_hours
 interval_months
 recurring
 applicability_reason
7.7 Applicability Preview Page
 Select aircraft.
 Show applicable ADs.
 Show applicable SBs.
 Show applicable SIDs.
 Show reason matched.
11. PHASE 8 — TEMPLATE SYSTEM
Goal

Build model-level maintenance templates.

8.1 Template Schema Decision

Check existing:

 task_templates
 workpack templates
 compliance templates
 current model-level logic
8.2 Template Migration

Minimum maintenance_templates:

 id
 model_id
 name
 template_type
 interval_hours
 interval_months
 is_active

Minimum maintenance_template_items:

 id
 template_id
 source_type
 source_id
 required
 sort_order
 notes

Allowed source types:

 STANDARD_TASK
 AD
 SB
 SID
8.3 Template Builder Page
 Select manufacturer.
 Select model.
 Create template.
 Select template type:
 MPI
 50 Hour
 100 Hour
 Annual
 Custom
8.4 Add Standard Tasks to Template
 Search standard tasks.
 Add to template.
 Reorder.
 Remove from template.
 Mark required/optional.
Note:
Phase 8.4 Admin List was added as a read-only safety/visibility phase.
Template Builder Page now continues the original VER3 Template System flow.
8.5 Add ADs to Template
 Show applicable ADs for model.
 Add selected ADs.
 Do not add non-applicable ADs unless override approved.
8.6 Add SBs to Template
 Show applicable SBs.
 Add selected SBs.
 Mark optional/recommended/mandatory if supported.
8.7 Add SIDs to Template
 Show applicable SIDs.
 Add selected SIDs.
8.8 Template Preview
 Show complete template.
 Group by source type.
 Show intervals.
 Show applicability source.
12. PHASE 9 — WORKPACK GENERATION
Goal

Generate workpacks from templates and applicable maintenance items.

9.1 Workpack Creation Entry
 Select aircraft.
 Select workpack type:
 MPI
 50 Hour
 100 Hour
 Annual
 Snag
 Custom
9.2 Template Selection
 Show templates matching aircraft model.
 User selects template.
 Preview before creation.
9.3 Generate Workpack Tasks

For each template item:

 Create workpack task.
 Copy title/description.
 Store source_type.
 Store source_id.
 Store template_id.
 Store generated timestamp.
9.4 Generate Compliance Links

For AD/SB/SID items:

 Create workpack compliance record if needed.
 Link to source item.
 Do not duplicate existing active compliance item.
9.5 Workpack Preview Before Commit
 Display tasks to be created.
 Display compliance items.
 Display warnings.
 User confirms.
9.6 Commit Workpack
 Use transaction.
 Create workpack.
 Create tasks.
 Create execution records if current system requires.
 Create compliance links.
 Roll back on failure.
13. PHASE 10 — EXECUTION COMPATIBILITY
Goal

Existing execution page must work with generated tasks.

10.1 Current Execution Audit
 Inspect execution page.
 Inspect task status flow.
 Inspect measurement handling.
 Inspect signatures.
 Inspect snags.
10.2 Generated Task Compatibility
 Generated standard tasks open correctly.
 Generated AD tasks open correctly.
 Generated SB tasks open correctly.
 Generated SID tasks open correctly.
10.3 Status Rules

Keep current rule unless explicitly changed:

OPEN
→ IN_PROGRESS
→ COMPLETED_BY_MECHANIC
→ CERTIFIED_BY_ENGINEER
→ LOCKED

Execution records do not become LOCKED.

10.4 Completion Gate

Workpack can close only if:

 all tasks certified/locked
 compliance completed
 snags closed
 required signatures complete
14. PHASE 11 — SNAG WORKPACK
Goal

Snag workpacks are independent from maintenance templates.

11.1 Snag Workpack Type
 Add or confirm workpack type SNAG.
 No template required.
 No AD/SB/SID required.
11.2 Snag Lifecycle
 OPEN
 IN_PROGRESS
 RESOLVED
 CLOSED
11.3 Snag Reporting Foundation
 Store aircraft.
 Store component if available.
 Store defect text.
 Store resolution text.
 Store recurring flag later.
15. PHASE 12 — DOCUMENT GENERATION
Goal

Documents must consume completed workpack data.

12.1 CRS Design Check
 CRS is regulatory certification document.
 Generated only when workpack is certified.
 Uses completed tasks.
 Uses completed compliance.
 Uses closed snags.
 Uses certifying engineer.
12.2 Compliance Summary
 ADs completed.
 SBs completed.
 SIDs completed if applicable.
 Standard tasks completed.
12.3 CRMA
 Separate from CRS.
 Only applicable where needed.
 No automatic generation unless approved.
16. PHASE 13 — CUSTOMER VISIBILITY
Goal

Later, customers see their aircraft only.

13.1 Customer Aircraft Scope
 Customer user can only see assigned aircraft.
 No internal admin data.
 No other customer data.
13.2 Customer Dashboard

Show:

 Aircraft details.
 Current workpack status.
 Upcoming maintenance preview.
 AD/SB/SID due summary.
 Snags summary if approved.
13.3 Customer Risk

Important:

 Customer may use information to shop around.
 But transparency can improve retention.
 Show enough to create trust, not expose internal costing logic.
17. PHASE 14 — CLEANUP AND LOCK
Goal

Only clean once new structure works.

14.1 Cleanup Candidate List

Codex must list:

 unused routes
 unused controllers
 unused views
 unused services
 duplicate migrations
 obsolete imports
 broken old features

No deletion yet.

14.2 User Approval
 User approves each deletion.
 Anything uncertain remains.
14.3 Controlled Removal
 Remove only approved files.
 Run tests.
 Run app.
 Verify core flows.
18. PHASE 15 — SYSTEM LOCK
Goal

Prevent future session drift.

15.1 Update AI Context
 Update docs/ChatGPT/AI_CONTEXT.md.
 Reflect actual system.
 Remove outdated assumptions.
15.2 Update Workflow Docs
 Update docs/workflows.md.
 Document actual flows:
 import standard tasks
 import ADs
 import SBs
 import SIDs
 build template
 create workpack
 execute workpack
 certify workpack
15.3 Update Session Boot
 Update docs/ChatGPT/SESSION_BOOT.md.
 Point to VER3 plan.
 Enforce single phase.
19. IMMEDIATE NEXT STEP

Start with this:

Active Phase: 0.1 — Confirm Tool Roles
Mode: DEFINE

Expected output:

docs/ChatGPT/ver3/phase-0.1-confirm-tool-roles.md