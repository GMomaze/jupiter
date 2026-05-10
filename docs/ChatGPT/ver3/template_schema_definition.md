# TEMPLATE SCHEMA DEFINITION

**Status:** Completed (READ-ONLY Definition Phase)  
**Date:** 2026-05-02  
**Purpose:** Define the approved Jupiter template-system schema for reusable maintenance packages that combine standard tasks, projected compliance items, and SID source items without directly generating workpacks.

---

## 1. Scope

This document defines the future template-system schema only.

It does not perform:

- schema changes
- migrations
- model creation
- controller/service work
- UI work
- workpack generation

This is the source-of-truth schema definition for later implementation.

---

## 2. Tables Defined

The template system requires two new tables:

- `maintenance_templates`
- `maintenance_template_items`

---

## 3. `maintenance_templates`

### Purpose

This is the template header table.

Each row represents one reusable maintenance package such as:

- MPI
- Annual
- Custom

This table stores package-level identity, model applicability, and interval metadata.

### Fields

- `id`
- `name`
- `description`
- `template_type`
- `model_id`
- `interval_hours`
- `interval_months`
- `is_active`
- `created_at`
- `updated_at`

### Field Meaning

- `id`
  - primary key
  - UUID

- `name`
  - human-readable template name
  - required

- `description`
  - optional longer package description

- `template_type`
  - required package classification
  - allowed values:
    - `MPI`
    - `ANNUAL`
    - `CUSTOM`

- `model_id`
  - required model-level applicability anchor
  - references `component_models.id`

- `interval_hours`
  - optional hour-based package interval

- `interval_months`
  - optional calendar-based package interval

- `is_active`
  - required active/inactive flag

- `created_at`
  - required audit timestamp

- `updated_at`
  - required audit timestamp

### Relationships

- `model_id -> component_models.id`

### Constraints

- `id` primary key
- `name` NOT NULL
- `template_type` NOT NULL
- `model_id` NOT NULL
- `is_active` NOT NULL
- `template_type` check constraint:
  - `template_type IN ('MPI', 'ANNUAL', 'CUSTOM')`

### Recommended Uniqueness

Recommended unique constraint:

- `model_id + name`

Why:

- prevents duplicate active template names for the same model
- still allows the same generic name to exist across different models if needed

### Indexes

Required indexes:

- `model_id`
- `template_type`
- `is_active`
- `interval_hours`
- `interval_months`

Recommended combined index:

- `model_id + is_active`

---

## 4. `maintenance_template_items`

### Purpose

This is the template item table.

Each row represents one ordered reusable item inside one maintenance template.

Items may point to different reusable source systems:

- standard task library
- projected compliance items
- SID source records

### Fields

- `id`
- `template_id`
- `item_type`
- `item_id`
- `sequence_no`
- `is_required`
- `notes`
- `created_at`
- `updated_at`

### Field Meaning

- `id`
  - primary key
  - UUID

- `template_id`
  - required parent template reference
  - references `maintenance_templates.id`

- `item_type`
  - required source category
  - allowed values:
    - `STANDARD_TASK`
    - `COMPLIANCE_ITEM`
    - `SID`

- `item_id`
  - required polymorphic source record identifier
  - UUID

- `sequence_no`
  - required explicit item ordering within a template

- `is_required`
  - required flag for required versus optional item behavior

- `notes`
  - optional planner-facing item note

- `created_at`
  - required audit timestamp

- `updated_at`
  - required audit timestamp

### Relationships

- `template_id -> maintenance_templates.id`

### Constraints

- `id` primary key
- `template_id` NOT NULL
- `item_type` NOT NULL
- `item_id` NOT NULL
- `sequence_no` NOT NULL
- `is_required` NOT NULL
- `item_type` check constraint:
  - `item_type IN ('STANDARD_TASK', 'COMPLIANCE_ITEM', 'SID')`

### Duplicate Prevention

Required unique constraint:

- `template_id + sequence_no`

Why:

- one template must not contain two rows in the same sequence position

Recommended unique constraint:

- `template_id + item_type + item_id`

Why:

- prevents the same reusable source record from being attached twice to the same template unless a later phase intentionally permits repetition

### Indexes

Required indexes:

- `template_id`
- `item_type`
- `item_id`
- `sequence_no`
- `is_required`

Recommended combined indexes:

- `template_id + sequence_no`
- `item_type + item_id`

---

## 5. Polymorphic Item Source Rules

`maintenance_template_items` uses a polymorphic source-reference pattern.

### Source Rule: `STANDARD_TASK`

If:

- `item_type = 'STANDARD_TASK'`

then:

- `item_id` references `task_templates.id`

Meaning:

- the template item points to one reusable standard task definition

### Source Rule: `COMPLIANCE_ITEM`

If:

- `item_type = 'COMPLIANCE_ITEM'`

then:

- `item_id` references `compliance_items.id`

Meaning:

- the template item points to one projected AD/SB compliance obligation

Rule:

- AD and SB must enter the template system through projected `compliance_items`
- template items must not directly point to raw AD or SB master tables in this schema

### Source Rule: `SID`

If:

- `item_type = 'SID'`

then:

- `item_id` references `supplemental_inspection_documents.id`

Meaning:

- the template item points to one reusable SID source record

Rule:

- SID is referenced directly from source because SID is not yet projected into `compliance_items`

### Foreign Key Note

Because `item_id` is polymorphic, this schema definition does not require a direct database foreign key from `item_id` to all possible source tables.

Instead:

- `template_id` is a normal FK
- `item_type + item_id` is interpreted by application logic later

This is an approved polymorphic-reference rule for this schema definition phase.

---

## 6. Relationship Rules

### `maintenance_templates` -> `component_models`

Rule:

- templates are model-specific first
- one model may have many templates
- one template belongs to one primary model

### `maintenance_templates` -> `maintenance_template_items`

Rule:

- one template contains many template items
- template items are ordered using `sequence_no`

### `maintenance_template_items` -> source records

Rule:

- template items reference reusable source records only
- they do not store copied task/compliance/SID content as template-owned duplicates

### Aircraft Variant Note

Initial rule:

- no direct aircraft-specific template table is required in this phase

Future support may add:

- aircraft-specific template variants
- aircraft-level overrides

but that is outside this definition.

---

## 7. Workpack Boundary

This schema does not directly execute work.

The template system must not:

- create workpacks
- create task cards
- create workpack executions
- create workpack compliance rows

Templates are reusable planning definitions only.

Later phases may use template headers and items to generate workpacks, but that generation logic is outside this schema definition.

---

## 8. Summary

The approved template system schema consists of:

- `maintenance_templates`
- `maintenance_template_items`

The header table stores:

- template identity
- template type
- model applicability
- interval metadata
- active state

The item table stores:

- ordered template contents
- polymorphic source references
- required/optional behavior
- planner notes

Source rules are:

- `STANDARD_TASK -> task_templates.id`
- `COMPLIANCE_ITEM -> compliance_items.id`
- `SID -> supplemental_inspection_documents.id`

The schema remains planning-only and does not directly generate executable work artifacts.

---

**END OF TEMPLATE SCHEMA DEFINITION**
