# PHASE 8.1 - TEMPLATE SYSTEM SCHEMA DECISION

**Status:** Completed (READ-ONLY Decision Phase)  
**Date:** 2026-05-02  
**Purpose:** Decide how Jupiter should represent reusable maintenance templates that can combine standard tasks, projected compliance items, and SID-driven source content before later workpack generation phases.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `task_templates`
- `compliance_items`
- `component_models`
- `aircraft`
- existing workpack/task/template tables:
  - `task_cards`
  - `workpacks`
  - `workpack_tasks`
  - `workpack_compliance`
- existing template-related code:
  - `src/models/core/TaskTemplate.ts`
  - `src/modules/library/standard-task-import.controller.ts`
  - `src/modules/workpacks/workpack.routes.ts`

---

## 2. Existing Support

### Does current schema already support reusable maintenance templates?

**Partially, but not completely.**

The live schema already includes:

- `task_templates`

and the current application already uses template-like task records in workpack planning flows.

However, the live structure only supports reusable task rows. It does not support a full maintenance-template package that contains:

- one template header
- many ordered template items
- mixed item source types
- direct inclusion of projected compliance items
- direct inclusion of SID source items

### Does `task_templates` represent individual reusable tasks or full maintenance packages?

**Individual reusable tasks.**

Current evidence:

- one row contains one title/description task definition
- rows can be imported in bulk through the Standard Task import flow
- workpack planner routes support adding template tasks into workpacks one at a time

This is a task-library shape, not a maintenance-package shape.

### Is a separate template header table required?

**Yes.**

Reason:

- a full maintenance template needs its own identity
- a single template needs metadata like name, type, model, interval, and active status
- that metadata should not be repeated across many `task_templates` rows

### Is a separate template item table required?

**Yes.**

Reason:

- one template must contain many ordered items
- those items may point to different reusable source types
- sequence, required/optional behavior, and item notes belong on the template-item row

---

## 3. Decision

## **CREATE NEW TEMPLATE SYSTEM SCHEMA**

### Why this decision was chosen

The current `task_templates` table is useful, but it solves a narrower problem:

- reusable task definitions

It does not provide the structural layer needed for:

- reusable maintenance packages such as MPI, Annual, or Custom template bundles
- mixed-source template composition
- stable header/item grouping
- ordered package assembly
- later model-specific or aircraft-specific template inheritance

Trying to force package behavior into `task_templates` would overload a task row with responsibilities that belong to:

- a template header
- a template item junction layer

The correct path is to keep `task_templates` as a reusable task library and add a separate template-system schema for package composition.

---

## 4. Required Answers

### 1. Does current schema already support reusable maintenance templates?

**Partial support only.**

- reusable individual task templates: yes
- reusable full maintenance packages: no

### 2. Does `task_templates` represent individual reusable tasks or full maintenance packages?

**Individual reusable tasks.**

### 3. Is a separate template header table required?

**Yes.**

### 4. Is a separate template item table required?

**Yes.**

### 5. How should templates be assigned to models?

Primary rule:

- templates should be model-specific first

Recommended relationship:

- template header carries `model_id`

Why:

- most applicability begins at the airframe/model level
- it matches the current Jupiter pattern used for aircraft applicability and SID/model linkage
- aircraft-specific variants can be added later without changing the primary model-based design

### 6. How should template items reference standard tasks, AD/SB compliance items, and SID items?

Template items should reference reusable source records only.

Expected source mapping:

- `STANDARD_TASK` -> `task_templates.id`
- `COMPLIANCE_ITEM` -> `compliance_items.id`
- `SID` -> `supplemental_inspection_documents.id`

Why:

- standard tasks already live as reusable task definitions
- AD/SB should enter templates through projected `compliance_items`, not raw source masters
- SIDs do not yet project into compliance, so SID template inclusion should reference SID source records directly

### 7. Should templates create workpack tasks immediately?

**No.**

Templates are planning definitions only.

They must not:

- create workpacks immediately
- create task cards immediately
- create workpack executions immediately

Workpack generation belongs to a later phase.

### 8. Is schema extension required before template implementation?

**Yes.**

The existing task-template table does not provide:

- template package header identity
- many-item composition
- mixed-source item typing
- stable ordered package assembly

---

## 5. Conceptual New Schema Shape

### Template Header

Minimum conceptual shape:

- `id`
- `name`
- `description`
- `template_type`
  - `MPI`
  - `ANNUAL`
  - `CUSTOM`
- `model_id`
- `interval_hours`
- `interval_months`
- `is_active`
- `created_at`
- `updated_at`

Purpose:

- identify one reusable maintenance package
- attach package-level scheduling and model applicability
- separate package identity from package contents

### Template Items

Minimum conceptual shape:

- `id`
- `template_id`
- `item_type`
  - `STANDARD_TASK`
  - `COMPLIANCE_ITEM`
  - `SID`
- `item_id`
- `sequence_no`
- `is_required`
- `notes`
- `created_at`
- `updated_at`

Purpose:

- define ordered contents of one template
- support mixed reusable source types
- allow future optional/required behavior per item

---

## 6. Relationship Rules

### Templates -> `component_models`

Relationship type:

- direct model assignment through template header

Rule:

- templates should be model-specific first
- one model may have many templates
- one template belongs to one primary model in the initial design

### Templates -> `aircraft`

Relationship type:

- no direct aircraft binding in the primary design

Rule:

- aircraft-specific variants may be supported later
- the base template system should not require direct aircraft storage now

### Template Header -> Template Items

Relationship type:

- one-to-many

Rule:

- one template contains many ordered items
- item ordering must be explicit through `sequence_no`

### Template Items -> `task_templates`

Relationship type:

- reusable task-library reference

Rule:

- standard task items should reference existing reusable task-template rows
- package templates should not duplicate the task definition itself

### Template Items -> `compliance_items`

Relationship type:

- reusable compliance reference

Rule:

- AD/SB entries should be referenced through projected `compliance_items`
- template items should not reference raw AD/SB master tables directly in the initial template system

### Template Items -> `supplemental_inspection_documents`

Relationship type:

- reusable SID source reference

Rule:

- SID items should reference SID source rows directly until SID compliance projection exists later

---

## 7. Workpack Boundary

Templates do not directly execute work.

This phase confirms:

- no workpacks created
- no task cards created
- no workpack executions created
- no workpack compliance created

Template rows are reusable planning definitions only. Later phases may use them to generate workpack content.

---

## 8. Gap Analysis

### Structural gaps in current schema

Current schema does not include:

- template package header table
- template package item table
- mixed item typing for package contents
- ordered package composition layer

### Limits of current `task_templates`

Current `task_templates` supports:

- one reusable task per row
- some scope/applicability metadata
- import into the task library

Current `task_templates` does not safely support:

- one named template bundle with many child items
- mixed task/compliance/SID composition
- package-level interval identity
- reusable maintenance package grouping

### Compliance reference limitation

`compliance_items` currently supports:

- AD
- SB

It does not yet support:

- SID as a projected compliance source type

Therefore SID template items should reference SID source records directly for now.

### Implementation risk if no new schema is added

If Jupiter tries to reuse only `task_templates`:

- package identity will be duplicated across many rows
- ordering will be brittle
- mixed-source items will not fit cleanly
- later workpack generation logic will become harder to reason about

---

## 9. Final Decision

## **CREATE NEW TEMPLATE SYSTEM SCHEMA**

Keep:

- `task_templates` as the reusable standard-task library

Add later:

- a template header table
- a template item table

Use the new template system for:

- MPI templates
- Annual templates
- Custom maintenance packages

without collapsing those package concepts into the single-row `task_templates` table.

---

## 10. Boundaries

This phase was read-only and did not perform implementation work.

- No schema changes
- No migrations
- No model edits
- No controller/service edits
- No UI edits
- No workpack/task generation

---

**END OF PHASE 8.1 DECISION DOCUMENT**
