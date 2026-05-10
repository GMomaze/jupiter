Jupiter Recovery Plan — Master Maintenance Library First
Core Rule

Workpacks must consume approved maintenance library items.

They must not be the place where ADs, SBs, SIDs, or standard tasks are first created.

Phase 0 — Freeze and Audit Current System
Goal

Stop going backwards before adding anything new.

Tickable Steps
 Freeze current schema and code state.
 Codex checks existing migrations.
 Codex checks existing models.
 Codex checks existing routes/controllers/views.
 Identify duplicate or conflicting migration files.
 Identify tables already existing for:
 task templates
 ADs
 SBs
 compliance items
 workpack tasks
 aircraft models
 components
 Produce a short “current state report”.
 Do not remove or replace anything until listed and approved.
Output

docs/ChatGPT/ver2/phase-0-system-audit.md

Phase 1 — Maintenance Library Structure
Goal

Create one central area/page for all maintenance source items.

This area is not linked to a workpack yet.

Library Sections
Standard Tasks
Airworthiness Directives
Service Bulletins
SIDs
Applicability Rules
Maintenance Templates
Tickable Steps
 Define database design.
 Check existing tables before creating new ones.
 Decide what can be reused.
 Decide what must be migrated.
 Codex confirms migration safety.
 Create page: Maintenance Library
 Add navigation entry.
 No workpack changes yet.
Output

docs/ChatGPT/ver2/phase-1-maintenance-library.md

Phase 2 — Standard Task Import
Goal

Standard tasks must exist independently from workpacks.

Example:

50-hour inspection task
100-hour inspection task
MPI task
lubrication task
operational check
remove/inspect/refit task
Proposed Table Concept

standard_tasks

Fields likely needed:

id
task_code
title
description
category
interval_type
default_hours
default_months
is_active
source
created_at
updated_at
Tickable Steps
 User provides standard task CSV format.
 Codex checks existing task/template tables.
 Design import mapping.
 Create/import into master table only.
 Validate duplicates.
 Validate required fields.
 Add import preview page.
 Add import confirm step.
 Add standard task list page.
 Add edit/deactivate option.
 No workpack generation yet.
Output

docs/ChatGPT/ver2/phase-2-standard-task-import.md

Phase 3 — AD Master Import
Goal

ADs must be imported into a master AD table and linked by applicability.

ADs can apply to:

all aircraft
manufacturer
aircraft model
engine
propeller
component
Proposed Table Concept

ad_items

Fields likely needed:

id
ad_number
revision
title
authority
effective_date
source_url
ad_type
summary
action_required
interval_hours
interval_months
recurring
is_active

Applicability table:

ad_applicability

id
ad_id
applies_to_type
manufacturer_id
model_id
component_model_id
notes
Tickable Steps
 User provides AD import format.
 Codex checks existing AD/compliance tables.
 Confirm whether existing tables are reused or replaced.
 Design AD import mapping.
 Import AD master records.
 Import applicability records.
 Add duplicate protection.
 Add AD list page.
 Add AD detail page.
 Add applicability display.
 No workpack generation yet.
Output

docs/ChatGPT/ver2/phase-3-ad-master-import.md

Phase 4 — SB Master Import
Goal

SBs must be loaded independently from workpacks.

Different manufacturers may have different CSV formats, but they must map into one internal structure.

Proposed Table Concept

sb_items

Fields likely needed:

id
manufacturer_id
sb_number
revision
title
issue_date
source_document
category
compliance_type
interval_hours
interval_months
recurring
is_active

Applicability table:

sb_applicability

id
sb_id
manufacturer_id
model_id
component_model_id
notes
Tickable Steps
 User provides first SB CSV format.
 Codex checks existing SB tables/files.
 Design manufacturer-specific adapter.
 Map CSV into one internal format.
 Import SB master records.
 Import applicability records.
 Add duplicate protection.
 Add SB list page.
 Add SB detail page.
 Add missing-model handling.
 No workpack generation yet.
Output

docs/ChatGPT/ver2/phase-4-sb-master-import.md

Phase 5 — SID Master Import
Goal

SIDs must exist as reusable inspection items.

Same SID can apply to multiple models.

Proposed Table Concept

sid_items

Fields likely needed:

id
sid_reference
title
description
inspection_area
interval_hours
interval_months
recurring
source_document
is_active

Applicability table:

sid_applicability

id
sid_id
manufacturer_id
model_id
notes
Tickable Steps
 User provides SID input format.
 Codex checks existing SID/task/compliance tables.
 Design SID import mapping.
 Import SID master records.
 Import SID applicability records.
 Add duplicate protection.
 Add SID list page.
 Add SID detail page.
 No workpack generation yet.
Output

docs/ChatGPT/ver2/phase-5-sid-master-import.md

Phase 6 — Applicability Engine
Goal

Jupiter must answer:

“For this aircraft/model/component, which tasks, ADs, SBs, and SIDs apply?”

Tickable Steps
 Define applicability rules.
 Support aircraft model applicability.
 Support manufacturer applicability.
 Support component applicability.
 Support general applicability.
 Support engine ADs.
 Support propeller ADs.
 Support airframe ADs.
 Add applicability preview page.
 Select aircraft/model and show applicable items.
 No workpack generation yet.
Output

docs/ChatGPT/ver2/phase-6-applicability-engine.md

Phase 7 — Maintenance Templates
Goal

Create reusable templates per aircraft model.

Example:

Cessna 172 template:

MPI / 100 hour / 12 month
50 hour
annual
special inspection
Proposed Table Concept

maintenance_templates

Fields:

id
model_id
template_name
template_type
interval_hours
interval_months
is_active

Template items:

maintenance_template_items

id
template_id
source_type
source_id
required
sort_order
notes

Source type can be:

STANDARD_TASK
AD
SB
SID
Tickable Steps
 Define template types.
 Create model-level templates.
 Add items from standard tasks.
 Add applicable ADs.
 Add applicable SBs.
 Add applicable SIDs.
 Allow user to tick what belongs to MPI.
 Allow user to tick what belongs to 50-hour.
 Add template preview.
 No workpack generation yet.
Output

docs/ChatGPT/ver2/phase-7-maintenance-templates.md

Phase 8 — Workpack Creation From Template
Goal

Only after the library and templates are stable, workpacks consume them.

Tickable Steps
 Create workpack from aircraft.
 Select template.
 Preview generated tasks.
 Confirm creation.
 Copy selected library items into workpack tasks.
 Preserve traceability back to source item.
 Do not edit master library data from workpack.
 Add generated compliance items.
 Verify workpack execution still works.
Output

docs/ChatGPT/ver2/phase-8-workpack-from-template.md

Phase 9 — Snag Workpack
Goal

Snag workpacks are separate and do not need maintenance templates.

Tickable Steps
 Define snag workpack type.
 Allow workpack with only snags.
 No AD/SB/SID template needed.
 Allow defects to be opened.
 Allow defects to be resolved.
 Allow recurring snag reporting later.
Output

docs/ChatGPT/ver2/phase-9-snag-workpack.md

Phase 10 — Cleanup and Lock
Goal

Remove confusion only after the new structure is working.

Tickable Steps
 Codex lists unused routes.
 Codex lists unused views.
 Codex lists old/duplicate migrations.
 Codex lists old task/compliance logic.
 User approves cleanup list.
 Remove only approved files.
 Final verification.
Output

docs/ChatGPT/ver2/phase-10-cleanup-lock.md

Execution Rule Going Forward

For each phase:

DEFINE

ChatGPT produces only the phase design document.

IMPLEMENT

Codex implements only that phase.

VERIFY

ChatGPT verifies only that phase with PASS/FAIL.