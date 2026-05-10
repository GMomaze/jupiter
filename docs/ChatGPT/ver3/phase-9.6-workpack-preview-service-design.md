# PHASE 9.6 - WORKPACK PREVIEW SERVICE DESIGN

**Status:** Completed (READ-ONLY DESIGN)  
**Date:** 2026-05-02  
**Purpose:** Define the service contract for read-only workpack preview before any commit or generation logic runs.

---

## 1. Scope

This phase is design only.

It does not perform:

- implementation code
- schema changes
- migrations
- model changes
- service changes
- controller changes
- route changes
- UI changes
- database writes
- workpack generation
- task creation
- compliance mutation

This phase defines the read-only service interface and expected behavior only.

---

## 2. Service Location

Planned service file:

- `src/modules/workpacks/services/workpack-preview.service.ts`

This service is responsible only for building a preview response.

It is not responsible for creating workpacks or executing commit logic.

---

## 3. Service Method

Required method:

```ts
getWorkpackPreview(params: { templateId: string; aircraftId: string })
```

Input parameters:

- `templateId`
- `aircraftId`

Both inputs are required.

---

## 4. Result Shape

The service must return a read-only preview result with this conceptual shape:

- `can_generate`
- `blocking_errors`
- `template`
- `aircraft`
- `summary`
- `items`

### 4.1 `can_generate`

Boolean.

Meaning:

- `true` only when all blocking validations pass
- `false` when any blocking validation or source-resolution failure exists

### 4.2 `blocking_errors`

Array of blocking validation messages/codes.

Examples:

- `TEMPLATE_NOT_FOUND`
- `TEMPLATE_INACTIVE`
- `AIRCRAFT_NOT_FOUND`
- `TEMPLATE_MODEL_MISMATCH`
- `TEMPLATE_HAS_NO_ITEMS`
- `SOURCE_RECORD_MISSING`

### 4.3 `template`

Read-only template summary object.

Minimum content:

- `id`
- `name`
- `model_id`
- `template_type`
- `is_active`

### 4.4 `aircraft`

Read-only aircraft summary object.

Minimum content:

- `id`
- `registration`
- `model_id`
- `model_name`

### 4.5 `summary`

Summary object containing:

- `total_items`
- `standard_task_count`
- `compliance_item_count`
- `sid_count`

### 4.6 `items`

Ordered array of preview items.

Each item must contain:

- `sequence_no`
- `item_type`
- `source_id`
- `source_reference`
- `title`
- `description`
- `is_required`
- `notes`
- `validation_status`
- `validation_errors`

---

## 5. Summary Rules

The summary is calculated from resolved template items only.

Required counts:

- `total_items`
  Number of template items included in preview order.

- `standard_task_count`
  Number of items resolved as `STANDARD_TASK`.

- `compliance_item_count`
  Number of items resolved as `COMPLIANCE_ITEM`.

- `sid_count`
  Number of items resolved as `SID`.

If template-level validation fails before item resolution:

- counts may be `0`
- `blocking_errors` must explain why preview cannot proceed

---

## 6. Item Shape Rules

Each preview item represents one maintenance template item in read-only form.

Required fields:

- `sequence_no`
  Derived from template item ordering.

- `item_type`
  One of:
  - `STANDARD_TASK`
  - `COMPLIANCE_ITEM`
  - `SID`

- `source_id`
  The referenced source record id from the template item.

- `source_reference`
  Human-readable source identifier from the resolved source record.

- `title`
  Source title intended for later generation mapping.

- `description`
  Source description intended for later generation mapping.

- `is_required`
  Preserved from the template item required flag.

- `notes`
  Preserved from the template item notes.

- `validation_status`
  Read-only readiness state.

- `validation_errors`
  Array of item-specific blocking issues.

Allowed conceptual validation states:

- `READY`
- `BLOCKED`

---

## 7. Validation Rules

The service must apply these blocking validations:

- template exists
- template is active
- aircraft exists
- template model matches aircraft model
- template has items
- every source record exists

Validation order:

1. validate template existence
2. validate template active state
3. validate aircraft existence
4. validate template model against aircraft model
5. validate template contains at least one item
6. validate every item source record

If any blocking validation fails:

- `can_generate = false`
- relevant `blocking_errors` populated
- no commit action allowed downstream

---

## 8. Source Resolution Rules

Source resolution must be read-only and source-type specific.

### 8.1 `STANDARD_TASK`

Resolves from:

- `task_templates`

Must read only the fields needed for preview display and later-safe mapping.

Expected preview extraction:

- source reference
- title
- description

### 8.2 `COMPLIANCE_ITEM`

Resolves from:

- `compliance_items`

Expected preview extraction:

- compliance reference
- title
- description

### 8.3 `SID`

Resolves from:

- `supplemental_inspection_documents`

Expected preview extraction:

- SID reference
- title
- description

If a source record cannot be resolved:

- mark item `BLOCKED`
- add item validation error
- set `can_generate = false`

---

## 9. Ordering Rules

Preview items must preserve template ordering exactly.

Rules:

- order by template item sort order or equivalent sequence field
- expose the same order in `items`
- group counts in `summary` must reflect the ordered item set

The preview service must not reorder items by source type for storage purposes.

Any UI grouping is presentation-level only.

---

## 10. Blocking Error Rules

Blocking errors operate at two levels:

- result-level `blocking_errors`
- item-level `validation_errors`

Use result-level blocking errors for:

- template not found
- inactive template
- aircraft not found
- model mismatch
- empty template

Use item-level validation errors for:

- missing source record
- unreadable required source fields
- unsupported source mapping condition

If one or more items are blocked:

- `can_generate = false`
- generation must not be allowed

---

## 11. Read-Only Boundaries

The preview service must remain strictly read-only.

It must not:

- insert records
- update records
- delete records
- call `generateWorkpackFromTemplate`
- create `workpacks`
- create `task_cards`
- create `workpack_tasks`
- create `workpack_executions`
- modify compliance state

The service is a pre-commit inspection step only.

---

## 12. Commit Boundary

This service prepares data for preview only.

It does not perform generation.

Strict boundary:

- preview service decides whether generation is allowed
- preview service does not execute generation
- later phase may call generation only after successful preview confirmation

---

## 13. Service Design Summary

The workpack preview service is a read-only orchestration layer that:

- validates template and aircraft compatibility
- resolves source records for preview
- returns grouped counts and ordered item details
- identifies blocking issues before any generation attempt

It must not create or modify any record and must not call `generateWorkpackFromTemplate`.

---

**END OF PHASE 9.6 WORKPACK PREVIEW SERVICE DESIGN**
