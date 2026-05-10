# PHASE 8.2 — TEMPLATE SCHEMA DEFINITION

Status: Defined ✅

---

## 1. PURPOSE

Define the exact schema for Jupiter’s reusable maintenance template system based on Phase 8.1.

This phase converts the template schema decision into precise table definitions before migrations or models are created.

---

## 2. DEPENDENCY

Depends on:

`docs/ChatGPT/ver3/phase-8.1-template-system-schema-decision.md`

Proceed only if Phase 8.1 selected:

`CREATE NEW TEMPLATE SYSTEM SCHEMA`

---

## 3. REQUIRED OUTPUT

Create:

`docs/ChatGPT/ver3/template_schema_definition.md`

---

## 4. TABLE: `maintenance_templates`

Template header table.

Fields:

- `id` UUID primary key
- `name` string NOT NULL
- `description` text nullable
- `template_type` string NOT NULL
  - allowed:
    - `MPI`
    - `ANNUAL`
    - `CUSTOM`
- `model_id` UUID nullable
- `interval_hours` integer nullable
- `interval_months` integer nullable
- `is_active` boolean default true
- `created_at` timestamp
- `updated_at` timestamp

---

## 5. TABLE: `maintenance_template_items`

Template item table.

Fields:

- `id` UUID primary key
- `template_id` UUID NOT NULL
- `item_type` string NOT NULL
  - allowed:
    - `STANDARD_TASK`
    - `COMPLIANCE_ITEM`
    - `SID`
- `item_id` UUID NOT NULL
- `sequence_no` integer nullable
- `is_required` boolean default true
- `notes` text nullable
- `created_at` timestamp
- `updated_at` timestamp

---

## 6. RELATIONSHIPS

- `maintenance_template_items.template_id`
  - references `maintenance_templates.id`

- `maintenance_templates.model_id`
  - references `component_models.id`

Source references:

- `STANDARD_TASK` → `task_templates.id`
- `COMPLIANCE_ITEM` → `compliance_items.id`
- `SID` → `supplemental_inspection_documents.id`

Because `item_id` is polymorphic, no direct FK is required for source records in this phase.

---

## 7. CONSTRAINTS

### `maintenance_templates`

- `name` NOT NULL
- `template_type` NOT NULL
- `template_type IN ('MPI', 'ANNUAL', 'CUSTOM')`

### `maintenance_template_items`

- `template_id` NOT NULL
- `item_type` NOT NULL
- `item_id` NOT NULL
- `item_type IN ('STANDARD_TASK', 'COMPLIANCE_ITEM', 'SID')`

Duplicate prevention:

- no duplicate item in the same template:
  - `template_id`
  - `item_type`
  - `item_id`

---

## 8. INDEXES

### `maintenance_templates`

- `template_type`
- `model_id`
- `is_active`

### `maintenance_template_items`

- `template_id`
- `item_type`
- `item_id`
- `sequence_no`

---

## 9. WORKPACK BOUNDARY

Templates do NOT:

- create workpacks
- create task cards
- create workpack_tasks
- create workpack_executions
- certify compliance

Templates only define reusable planning structure.

Workpack generation happens in a later phase.

---

## 10. RULES

- DEFINE only
- NO migrations
- NO schema changes
- NO models
- NO services/controllers/routes/UI changes
- NO workpack/task generation

---

## 11. SUCCESS CRITERIA

PASS if:

- `template_schema_definition.md` exists
- `maintenance_templates` is defined
- `maintenance_template_items` is defined
- fields are complete
- constraints are defined
- indexes are defined
- source reference rules are clear
- workpack boundary is enforced

---

## 12. FAILURE CONDITIONS

FAIL if:

- templates are confused with task_templates
- item source references are vague
- workpack/task generation is included
- schema/code changes are made
- polymorphic item references are incorrectly forced into FKs

---

## 13. HANDOFF TO IMPLEMENT

Codex must create/update only:

`docs/ChatGPT/ver3/template_schema_definition.md`

Return:

- Files checked
- Files created/modified
- PASS/FAIL