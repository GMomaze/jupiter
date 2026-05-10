# PHASE 9.4K - ADAPT GENERATION SERVICE TASKTEMPLATE QUERY

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-02  
**Purpose:** Define how future workpack-generation implementation must query `task_templates` safely after Phase 9.4J determined the current `TaskTemplate` model/table alignment is partial.

---

## 1. Dependency Check

Phase 9.4J decision:

- `PARTIAL — REQUIRES ADAPTATION IN SERVICE`

This phase proceeds on that basis.

---

## 2. Scope

This phase is design-only.

It does not perform:

- schema changes
- migrations
- model edits
- service code changes
- UI or controller changes

---

## 3. Query Strategy

### Decision

For the `STANDARD_TASK` source path, the generation service should **not** rely on unrestricted `TaskTemplate` Sequelize model reads.

Preferred strategy:

- use a targeted raw SQL query, or
- use a Sequelize query that explicitly selects only confirmed live columns

### Why

Phase 9.4J and Phase 9.4H established that:

- the live `task_templates` table is usable
- the current `TaskTemplate` model includes drifted fields such as `code`
- unrestricted model reads can fail at runtime with:
  - `column "code" does not exist`

Therefore the safe approach is to query only known-good live columns.

---

## 4. Whether To Use `TaskTemplate` Model Or Raw Query

### Recommended

- use a raw query for `STANDARD_TASK` source resolution

### Reason

A raw query gives explicit control over selected columns and avoids accidental selection of model-only fields that do not exist in the live table.

### Acceptable fallback

- a constrained Sequelize query may be acceptable **only if** it explicitly selects live columns and does not depend on default model attribute expansion

### Not recommended

- `TaskTemplate.findByPk(...)`
- `TaskTemplate.findOne(...)`
- `TaskTemplate.findAll(...)`

when those calls rely on the full model attribute list

---

## 5. Safe Fields To Read From `task_templates`

The service should limit reads to live fields required for workpack task-card generation:

- `id`
- `task_card_number`
- `title`
- `description`
- `scope`
- `sort_order`
- `aircraft_model_id`
- `aircraft_id`
- `is_active`
- `source_type`
- `interval_hours`
- `interval_months`
- `model_applicability`
- `aircraft_applicability`
- `created_at`
- `updated_at`

These fields are present in the live table and are safe to read.

The service should not depend on the following drifted model fields unless they are proven to exist in live schema:

- `code`
- `task_order_number`
- `applies_to_fabric`
- `applies_to_metal`
- `applies_to_wood_prop`
- `applies_to_fixed_gear`
- `applies_to_retractable_gear`
- `is_required`
- `interval_type`

---

## 6. `task_templates` -> `task_cards` Field Mapping

For `STANDARD_TASK` generation under the current schema:

- `task_templates.id` -> `task_cards.template_source_id`
- `task_templates.task_card_number` -> source reference only; not required to be copied directly into destination number
- `task_templates.title` -> `task_cards.title`
- `task_templates.description` -> base content for `task_cards.description`
- generated workpack/task numbering logic -> `task_cards.task_card_number`
- generated workpack aircraft context -> `task_cards.aircraft_id`
- generated execution status default -> `task_cards.status = OPEN`
- generated workpack context -> linked later through `workpack_tasks`

Notes:

- `task_cards.description` is `NOT NULL`, so the generation service must stop if source description is null or empty after normalization
- template metadata such as sequence and required flag may be appended into generated description or retained through template-side records as already defined in current-schema adaptation

---

## 7. Required Adaptations From Phase 9.4J

Because alignment is partial, the service implementation must adapt in the following ways:

1. Do not use unrestricted `TaskTemplate` model reads for source resolution.
2. Query only confirmed live columns.
3. Treat `task_templates` as the source of truth for standard-task content, not the drifted model shape.
4. Build the task-card payload from live source columns only.
5. Keep `template_source_id` as the source-identity anchor for generated standard tasks.

---

## 8. Failure Conditions That Must Stop Generation

Generation must stop immediately if any of the following occur during `STANDARD_TASK` source resolution:

- `task_templates` source row does not exist
- `task_templates.is_active` is false when active-only enforcement is required
- selected query references a non-existent column
- source `title` is null or empty
- source `description` is null or empty and no safe fallback is available
- `aircraft_id` or model compatibility checks fail at the generation level
- `task_cards` required destination fields cannot be populated
- the source query returns more than one row for the same expected source record

These failures must return a controlled generation failure and leave no partial workpack data behind.

---

## 9. Conclusion

The `STANDARD_TASK` source path should adapt away from unrestricted `TaskTemplate` model reads.

Recommended design:

- query `task_templates` using raw SQL or an explicitly column-limited query
- read only confirmed live columns
- map `task_templates.id` into `task_cards.template_source_id`
- map title and description into the generated `task_cards` payload
- stop generation on any source-query drift or required-field failure

This is the safest path consistent with Phase 9.4J.

---

**END OF PHASE 9.4K ADAPT GENERATION SERVICE TASKTEMPLATE QUERY**
