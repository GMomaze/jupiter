# PHASE 9.4D - WORKPACK GENERATION SCHEMA COMPATIBILITY DECISION

**Status:** Completed (READ-ONLY Compatibility Decision Phase)  
**Date:** 2026-05-02  
**Purpose:** Decide whether the current Jupiter schema can support the corrected Phase 9.4A / 9.4B workpack generation persistence model without schema changes.

---

## 1. Scope

This phase is read-only.

It does not perform:

- schema changes
- migrations
- model edits
- service code changes
- implementation fixes

This document records a compatibility decision only.

---

## 2. Sources Inspected

Documents inspected:

- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `docs/ChatGPT/ver3/phase-9.4A-correct-workpack-generation-persistence.md`
- `docs/ChatGPT/ver3/phase-9.4B-correct-workpack-generation-service-implementation.md`

Schema and model objects inspected:

- `workpacks` table and `src/models/core/Workpack.ts`
- `workpack_tasks` table and `src/models/core/WorkpackTask.ts`
- `workpack_executions` table and `src/models/core/WorkpackExecution.ts`
- `task_templates` table and `src/models/core/TaskTemplate.ts`
- `compliance_items` table and `src/models/ComplianceItem.ts`
- `supplemental_inspection_documents` table and `src/models/SupplementalInspectionDocument.ts`

Live database metadata inspected:

- column lists and nullability for:
  - `workpacks`
  - `workpack_tasks`
  - `workpack_executions`
  - `task_templates`
  - `compliance_items`
  - `supplemental_inspection_documents`
- current `rf_workpack_status` codes

---

## 3. Required Compatibility Checks

The corrected implementation requires:

1. `workpacks` supports:
   - `id`
   - `aircraft_id`
   - `status`
   - `created_by`
   - `created_at`
2. `workpack_tasks` supports:
   - `workpack_id`
   - `sequence_no`
   - `is_required`
   - `notes`
   - `task_template_id`
   - `compliance_item_id`
   - `sid_id`
3. `workpack_executions` supports:
   - `workpack_task_id`
   - `status`
   - `attempt_no`
4. Foreign-key, nullability, and insert compatibility must allow one table to represent:
   - `STANDARD_TASK`
   - `COMPLIANCE_ITEM`
   - `SID`

---

## 4. Findings

### 4.1 `workpacks`

Current live columns:

- `id`
- `work_order_number`
- `status_id`
- `aircraft_id`
- `version`
- `created_at`
- `updated_at`
- `qa_required`
- `certified_by`
- `certified_at`
- `qa_reviewed_by`
- `qa_reviewed_at`
- `released_by`
- `released_at`

Result against required shape:

- `id`: present
- `aircraft_id`: present
- `status`: missing
- `created_by`: missing
- `created_at`: present

Compatibility outcome:

- incompatible with the corrected required shape

Important note:

- the live schema uses normalized `status_id` through `rf_workpack_status`
- current live status codes are `CERTIFIED`, `DRAFT`, `IN_PROGRESS`, `ISSUED`, `QA_REVIEW`, `RELEASED`
- no `OPEN` workpack status exists in `rf_workpack_status`

### 4.2 `workpack_tasks`

Current live columns:

- `workpack_id`
- `task_id`

Result against required shape:

- `workpack_id`: present
- `sequence_no`: missing
- `is_required`: missing
- `notes`: missing
- `task_template_id`: missing
- `compliance_item_id`: missing
- `sid_id`: missing

Compatibility outcome:

- incompatible with the corrected required shape

Important note:

- current schema is only a junction between `workpacks` and `task_cards`
- there is no polymorphic source representation in `workpack_tasks`

### 4.3 `workpack_executions`

Current live columns:

- `id`
- `workpack_id`
- `task_id`
- `attempt_no`
- `status`
- `started_by`
- `completed_by`
- `certified_by`
- `started_at`
- `completed_at`
- `certified_at`
- `notes`
- `failure_reason`
- `version`
- `created_at`
- `updated_at`

Result against required shape:

- `workpack_task_id`: missing
- `status`: present
- `attempt_no`: present

Compatibility outcome:

- incompatible with the corrected required shape

Important note:

- execution linkage is currently to `task_id`
- unique constraint is `UNIQUE (workpack_id, task_id, attempt_no)`
- this is not the same as execution linkage to a generated `workpack_task` row

### 4.4 Source Tables

Source tables do exist:

- `task_templates`: present
- `compliance_items`: present
- `supplemental_inspection_documents`: present in live DB metadata

However:

- there is no compatible destination structure in `workpack_tasks` for direct source mapping to:
  - `task_template_id`
  - `compliance_item_id`
  - `sid_id`

---

## 5. Foreign Key And Nullability Review

### 5.1 Required FK Columns Present

Required source-link columns on `workpack_tasks`:

- `task_template_id`: missing
- `compliance_item_id`: missing
- `sid_id`: missing

Required execution-link column on `workpack_executions`:

- `workpack_task_id`: missing

Result:

- required FK columns are not present

### 5.2 Nullable FK Requirement For Polymorphic Use

For one row shape to represent `STANDARD_TASK`, `COMPLIANCE_ITEM`, and `SID`, the non-selected source FK columns would need to be nullable.

Current state:

- those source FK columns do not exist at all on `workpack_tasks`

Result:

- nullable polymorphic-use review cannot pass because the required columns are absent

### 5.3 Conflicting NOT NULL Constraints

Current constraints that conflict with the corrected model:

- `workpacks.status_id` is `NOT NULL`, while required clarified shape expects direct `status`
- `workpack_tasks.task_id` is `NOT NULL`, forcing linkage to `task_cards`
- `workpack_executions.task_id` is `NOT NULL`, forcing linkage to `task_cards`

Result:

- current `NOT NULL` constraints enforce the old task-card-based pattern and conflict with the clarified source-linked workpack generation model

---

## 6. Insert Feasibility

### Can `workpack_tasks` represent `STANDARD_TASK`, `COMPLIANCE_ITEM`, and `SID`?

- No

Reason:

- the table has only `workpack_id` and `task_id`
- it cannot store `task_template_id`, `compliance_item_id`, or `sid_id`
- it cannot store `sequence_no`, `is_required`, or `notes`

### Are all required FK columns present?

- No

Missing columns:

- `workpacks.created_by`
- `workpack_tasks.task_template_id`
- `workpack_tasks.compliance_item_id`
- `workpack_tasks.sid_id`
- `workpack_tasks.sequence_no`
- `workpack_tasks.is_required`
- `workpack_tasks.notes`
- `workpack_executions.workpack_task_id`

### Are FK columns nullable as required?

- No

Reason:

- the required polymorphic source columns on `workpack_tasks` do not exist
- the current mandatory `task_id` pattern points to `task_cards`, not to source items

### Is `workpack_executions` correctly linked?

- No

Reason:

- it links to `task_id`, not to `workpack_task_id`
- execution history is currently built around `task_cards`

### Will inserts succeed without violating constraints?

- No

Reason:

- corrected 9.4A / 9.4B inserts require columns that do not exist
- current required columns force the older `task_cards` persistence pattern
- current status persistence also cannot satisfy direct `status = OPEN` on `workpacks`

### Is any schema ambiguity present?

- Yes

Ambiguities:

- live `supplemental_inspection_documents` exists, but is not represented in the inspected inventory docs
- current workpack design in live schema is task-card-centric, while corrected 9.4A / 9.4B design is source-link-centric
- model layer drift further increases uncertainty because runtime models omit several live columns and still assume old linkage patterns

---

## 7. Compatibility Decision

**BLOCK IMPLEMENTATION**

---

## 8. Justification

Implementation must be blocked because the current schema does not support the corrected persistence contract.

Blocking reasons:

- `workpacks` does not have `created_by`
- `workpacks` does not have direct `status`
- current normalized workpack status set does not include `OPEN`
- `workpack_tasks` cannot store source-linked polymorphic rows for `STANDARD_TASK`, `COMPLIANCE_ITEM`, and `SID`
- `workpack_tasks` cannot store `sequence_no`, `is_required`, or `notes`
- `workpack_executions` is linked to `task_id`, not `workpack_task_id`
- current `NOT NULL` constraints enforce the old `task_cards`-based design
- inserts for the corrected model would fail or require writing outside the approved persistence model

Because this phase forbids schema changes, migrations, model edits, and implementation fixes, the only correct compatibility decision is to block implementation.

---

## 9. Conclusion

The current Jupiter workpack schema supports the older task-card-driven workpack flow, not the corrected 9.4A / 9.4B source-linked workpack generation model.

Under current constraints:

- current schema cannot correctly persist the clarified design
- corrected generation inserts cannot succeed safely
- implementation should not proceed until schema design is explicitly approved in a later schema phase

---

**END OF PHASE 9.4D WORKPACK GENERATION SCHEMA COMPATIBILITY DECISION**
