# PHASE 3.1A - Reopen Standard Task Schema Decision

**Status:** Completed (READ-ONLY Decision Phase)  
**Date:** 2026-05-01  
**Purpose:** Reopen the Standard Task storage decision so Phase 3.4 can proceed only if the live schema truly supports the import commit requirements.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/phase-3.1-standard-task-schema-decision.md`
- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `docs/ChatGPT/ver3/migration_inventory.md`
- `migrations/210_create_task_templates.ts`
- `migrations/220_add_task_template_applicability_flags.ts`
- `migrations/461_add_mpi_checklist_applicability_fields.ts`
- `src/models/core/TaskTemplate.ts`

---

## 2. Storage Target Decision

### Is `task_templates` the correct storage target for reusable standard tasks?

**Yes.**

Based on the existing Phase 3.1 decision, the live schema snapshot, the table inventory, the migration history, and the `TaskTemplate` model intent, `task_templates` is the system's reusable template-level task table. It is the closest and only defensible existing storage target for reusable standard tasks.

This decision is supported by:

- `docs/ChatGPT/ver3/schema.sql`, which shows `public.task_templates` as a live table
- `docs/ChatGPT/ver3/table_inventory.md`, which classifies `task_templates` as a `CORE` table with live rows
- `migrations/210_create_task_templates.ts`, which creates `task_templates` as the template task table
- `src/models/core/TaskTemplate.ts`, which maps to `task_templates`

---

## 3. Live Column Reality

### Current live `task_templates` columns

The live table currently supports these columns:

- `id`
- `task_card_number`
- `sort_order`
- `scope`
- `title`
- `description`
- `aircraft_model_id`
- `aircraft_id`
- `is_active`
- `is_required_for_wood`
- `is_required_for_fabric`
- `is_required_for_bungees`
- `is_required_for_woodprop`
- `is_required_for_retractable`
- `created_at`
- `updated_at`

### Required Phase 3.4 import fields

Phase 3.4 import commit expects support for:

- `title`
- `description`
- `source_type`
- `interval_hours`
- `interval_months`
- `model_applicability`
- `aircraft_applicability`
- `is_active`
- timestamps

---

## 4. Field Comparison

### Does `task_templates` currently support all required import fields?

**No.**

### Fields that are supported directly

- `title`
- `description`
- `is_active`
- `created_at`
- `updated_at`

### Fields that are missing or not safely supported

- `source_type`
  - No `source_type` column exists on `task_templates`
  - `scope` exists, but there is no approved evidence that `scope` is a safe one-to-one storage substitute for the import field `source_type`

- `interval_hours`
  - No column exists on `task_templates`

- `interval_months`
  - No column exists on `task_templates`

- `model_applicability`
  - No plain-text `model_applicability` column exists
  - The table instead has `aircraft_model_id` as a foreign key
  - Phase 3.4 import input is not defined as a UUID/FK resolution workflow

- `aircraft_applicability`
  - No plain-text `aircraft_applicability` column exists
  - The table instead has `aircraft_id` as a foreign key
  - Phase 3.4 import input is not defined as a UUID/FK resolution workflow

---

## 5. Model And Migration Findings

### Model drift

`src/models/core/TaskTemplate.ts` declares several fields that are not present in the live database table, including:

- `code`
- `task_order_number`
- `applies_to_fabric`
- `applies_to_metal`
- `applies_to_wood_prop`
- `applies_to_fixed_gear`
- `applies_to_retractable_gear`
- `is_required`
- `interval_type`

This means the model cannot be treated as proof that the live database supports those fields.

### Migration findings

- `migrations/210_create_task_templates.ts` creates only the currently live `task_templates` shape listed above
- `migrations/220_add_task_template_applicability_flags.ts` performs no live column additions
- `migrations/461_add_mpi_checklist_applicability_fields.ts` also performs no live column additions

No active migration inspected adds:

- `source_type`
- `interval_hours`
- `interval_months`
- `model_applicability`
- `aircraft_applicability`

---

## 6. Decision Answers

### 1. Is `task_templates` the correct storage target for reusable standard tasks?

**Yes.**

### 2. Does `task_templates` currently support all required import fields?

**No.**

### 3. If not, which fields are missing?

Missing or not safely supported for Phase 3.4:

- `source_type`
- `interval_hours`
- `interval_months`
- `model_applicability`
- `aircraft_applicability`

### 4. Is schema extension required before Phase 3.4 can proceed?

**Yes.**

### 5. Must Phase 3.4 be blocked until schema is extended?

**Yes.**

---

## 7. Final Decision

## **BLOCK PHASE 3.4 - SCHEMA EXTENSION REQUIRED**

Phase 3.4 cannot safely proceed with database commit logic under the current live schema because the approved target table does not support the full import field set required by the phase definition.

Proceeding without schema work would require one or more unsafe assumptions, including:

- treating `scope` as `source_type` without explicit approval
- ignoring interval fields that the phase expects to store if supported
- converting applicability text into foreign keys without a defined lookup contract
- relying on model-only fields that do not exist in the live database

That would violate the project rule to avoid guessing storage behavior.

---

## 8. Phase 3.4 Status

**Blocked pending schema extension decision and implementation.**

Before Phase 3.4 commit logic can be implemented safely, the system needs an explicit schema decision covering at least:

- where `source_type` is stored
- whether interval values must be stored and in which columns
- whether applicability input is stored as text, foreign keys, or a separate structure
- how duplicate detection should operate against the final persisted shape

---

## 9. Boundaries

This phase was read-only and did not perform any implementation work.

- No schema changes
- No migrations
- No model edits
- No controller edits
- No UI edits
- No import commit logic

---

**END OF DECISION DOCUMENT**
