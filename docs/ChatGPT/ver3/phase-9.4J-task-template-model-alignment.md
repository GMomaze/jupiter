# PHASE 9.4J - TASKTEMPLATE MODEL/TABLE ALIGNMENT DECISION

**Status:** Completed (READ-ONLY Decision Phase)  
**Date:** 2026-05-02  
**Purpose:** Decide whether the current `TaskTemplate` model is aligned enough with the live `task_templates` table for workpack generation use.

---

## 1. Scope

This phase performed inspection and decision only.

It did not perform:

- schema changes
- migrations
- model edits
- service code changes
- UI or controller changes

---

## 2. Files Checked

- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `src/models/core/TaskTemplate.ts`
- `src/models/core/TaskCard.ts`
- live `task_templates` table metadata
- live `task_cards` table metadata

---

## 3. Validation Summary

### `task_templates` table

- exists: yes
- primary key: `id`
- primary key valid: yes

### `TaskTemplate` model

- exists: yes
- declared table mapping: `task_templates`
- maps to correct table name: yes

### Required source fields for task-card generation

Fields needed by current workpack generation for `STANDARD_TASK` source resolution:

- `id`: present in table and model
- `task_card_number`: present in table and model
- `title`: present in table and model
- `description`: present in table and model
- `aircraft_model_id`: present in table and model
- `aircraft_id`: present in table and model
- `is_active`: present in table and model

### `task_cards` target compatibility

Target fields used by current generation shape:

- `task_card_number`: present, `NOT NULL`
- `title`: present, `NOT NULL`
- `description`: present, `NOT NULL`
- `status`: present, `NOT NULL`, default `OPEN`
- `aircraft_id`: present, `NOT NULL`, FK to `aircraft.id`
- `template_source_id`: present, nullable
- `compliance_item_id`: present, nullable, FK to `compliance_items.id`
- `service_bulletin_id`: present, nullable
- `component_id`: present, nullable
- `version`: present, `NOT NULL`, default `0`

Result:

- `task_cards` is compatible as a destination for generated task-card persistence

---

## 4. Misalignment Findings

The `TaskTemplate` model is not cleanly aligned to the live `task_templates` table.

Model fields that do **not** exist in the live table:

- `code`
- `task_order_number`
- `applies_to_fabric`
- `applies_to_metal`
- `applies_to_wood_prop`
- `applies_to_fixed_gear`
- `applies_to_retractable_gear`
- `is_required`
- `interval_type`

Live table fields that **do** exist and are represented in the model:

- `source_type`
- `interval_hours`
- `interval_months`
- `model_applicability`
- `aircraft_applicability`

Observed runtime consequence:

- a live `TaskTemplate.findAll(...)` / `findOne(...)` read can fail with `column "code" does not exist`

This was already reproduced during Phase 9.4H fixture verification on the `STANDARD_TASK` source path.

---

## 5. Constraints / Defaults / FK Check

### `task_templates`

- `id`: `NOT NULL`, default `gen_random_uuid()`
- `task_card_number`: `NOT NULL`
- `sort_order`: `NOT NULL`, default `0`
- `scope`: `NOT NULL`
- `title`: `NOT NULL`
- `description`: `NOT NULL`
- `is_active`: `NOT NULL`, default `true`
- `aircraft_model_id`: nullable FK to `component_models.id`
- `aircraft_id`: nullable FK to `aircraft.id`

### `task_cards`

- `description` is `NOT NULL` in DB
- `status` default is `OPEN`
- `aircraft_id` has an enforced FK
- `template_source_id` is nullable and usable for source linkage

Risk note:

- `TaskCard` model declares `description` as nullable even though the DB requires it, but current workpack-generation logic supplies a description string, so this is not the blocking issue in the current `STANDARD_TASK` path

---

## 6. Naming Consistency Check

Positive:

- model table name matches live table name
- primary key naming is consistent
- core source fields for generation use the same names between model and table

Negative:

- the model still carries legacy or drifted field names that are no longer present in the live table
- this creates runtime read failures even though the base table mapping is correct

---

## 7. Alignment Decision

`PARTIAL — REQUIRES ADAPTATION IN SERVICE`

---

## 8. Justification

The decision is `PARTIAL` instead of `ALIGNED` because:

- the `TaskTemplate` model can fail at runtime against the live `task_templates` table
- the mismatch is already proven by the `column "code" does not exist` error
- the model contains multiple non-existent fields

The decision is **not** `MISALIGNED — BLOCK IMPLEMENTATION` because:

- the table exists
- the model points to the correct table
- the primary key is valid
- the required generation source fields (`id`, `task_card_number`, `title`, `description`, `aircraft_model_id`, `aircraft_id`, `is_active`) do exist in the live table
- the target `task_cards` table is structurally compatible

Therefore:

- the underlying data structure is usable
- but the current service cannot safely rely on unrestricted `TaskTemplate` model reads
- the `STANDARD_TASK` source path requires service-side adaptation to query only live columns or otherwise avoid drifted model fields

---

## 9. Conclusion

`TaskTemplate` is not fully aligned to the live `task_templates` table.

The table itself is usable for workpack generation, and `task_cards` is a compatible destination. The blocker is the current model drift, which causes runtime query failure on the `STANDARD_TASK` source path.

Decision:

- `PARTIAL — REQUIRES ADAPTATION IN SERVICE`

---

**END OF PHASE 9.4J TASKTEMPLATE MODEL/TABLE ALIGNMENT DECISION**
