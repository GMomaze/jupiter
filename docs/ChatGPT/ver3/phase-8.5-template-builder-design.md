# PHASE 8.5 - TEMPLATE BUILDER DESIGN

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-02  
**Purpose:** Define the future Jupiter template-builder behavior for creating reusable maintenance templates and ordered template items without implementing schema, routes, services, or UI logic in this phase.

---

## 1. Scope

This phase defines the builder design only.

It does not perform:

- schema changes
- migrations
- model creation or updates
- controller/service work
- route work
- UI implementation
- workpack generation
- task execution

This document is the source-of-truth design for a later implementation phase.

---

## 2. Builder Purpose

The template builder is the future admin workflow used to create one reusable maintenance template header and then attach ordered reusable source items to it.

The builder must support:

- creating a template header first
- adding ordered template items second
- editing the item list before save/commit in a later implementation phase
- preserving read-only planning boundaries

The builder must not:

- generate workpacks
- generate executable task cards
- execute compliance
- mark maintenance as complete

---

## 3. Template Header Design

The template builder starts with the template header.

Required header data:

- `name`
- `template_type`
- `model_id`

Optional header data:

- `description`
- `interval_hours`
- `interval_months`
- `is_active`

Header meaning:

- `name`
  - human-readable reusable template name
- `template_type`
  - standardized maintenance package category
- `model_id`
  - primary model applicability anchor
- `description`
  - planner-facing notes about the template as a whole
- `interval_hours`
  - optional operating-hour recurrence value
- `interval_months`
  - optional calendar recurrence value
- `is_active`
  - active/inactive planning state

---

## 4. Supported Template Types

The builder must support these template types:

- `MPI`
- `50_HOUR`
- `100_HOUR`
- `ANNUAL`
- `CUSTOM`

Meaning:

- `MPI`
  - generic manufacturer or operator periodic inspection package
- `50_HOUR`
  - recurring 50-hour package
- `100_HOUR`
  - recurring 100-hour package
- `ANNUAL`
  - annual inspection package
- `CUSTOM`
  - operator-defined reusable package

Design rule:

- the builder must present these as controlled values, not free text

Compatibility note:

- earlier schema definition documents listed a narrower type set
- this builder design expands the approved future builder choices
- enforcement and schema alignment for these values must happen only in a later schema/model phase

---

## 5. Item Source Design

Template items must be selectable from reusable source systems only.

Approved item sources:

- `task_templates`
- `compliance_items`
- `supplemental_inspection_documents`

### Source: `task_templates`

Use when:

- the template item is a reusable standard maintenance task

Stored as:

- `item_type = 'STANDARD_TASK'`
- `item_id = task_templates.id`

### Source: `compliance_items`

Use when:

- the template item is a projected AD or SB compliance obligation

Stored as:

- `item_type = 'COMPLIANCE_ITEM'`
- `item_id = compliance_items.id`

Source interpretation rule:

- AD and SB enter the builder only through `compliance_items`
- AD/SB identity is understood from `compliance_items.source_type + compliance_items.source_id`
- the builder must not link directly to raw AD or SB master tables

### Source: `supplemental_inspection_documents`

Use when:

- the template item is a reusable SID source record

Stored as:

- `item_type = 'SID'`
- `item_id = supplemental_inspection_documents.id`

---

## 6. Item Structure

Each template item in the builder must define:

- `item_type`
- `item_id`
- `sequence_no`
- `is_required`
- `notes`

Meaning:

- `item_type`
  - identifies which approved source system the item comes from
- `item_id`
  - identifies the selected reusable source record
- `sequence_no`
  - explicit display and execution-order reference within the template definition
- `is_required`
  - marks the item as required or optional inside the package definition
- `notes`
  - planner-facing instructions or context for that template item

Design rule:

- the builder must store source references only
- it must not duplicate full task/compliance/SID content into the template row

---

## 7. Builder Flow

The template creation flow must be:

1. Create or enter the template header.
2. Select the `template_type`.
3. Select the primary `model_id`.
4. Enter optional description and interval metadata.
5. Save or stage the header in a later implementation phase.
6. Add template items from approved source systems.
7. Assign `sequence_no` for each item.
8. Mark each item as required or optional.
9. Add optional item notes.
10. Review the ordered template composition before final save.

Behavioral design:

- header data must exist before items are committed
- items belong to one template only
- items must remain reorderable before final persistence in a later implementation phase
- item selection and ordering are part of one builder experience, even if implementation later splits screens or steps

---

## 8. Ordering Rules

The builder must treat ordering as explicit, not inferred.

Required ordering rules:

- every item must have a `sequence_no`
- `sequence_no` must be unique within one template
- lower sequence numbers appear first
- the builder must preserve visible ordering exactly as stored
- ordering must not depend on source type or creation timestamp

Recommended builder behavior:

- assign the next available sequence number automatically when adding a new item
- allow later manual resequencing before final save in a future implementation phase
- resequencing should normalize to a simple ascending integer order

---

## 9. Duplicate Prevention Rules

The builder must prevent duplicate template content within the same template unless a future phase explicitly relaxes that rule.

Required duplicate prevention:

- no duplicate `sequence_no` inside the same template
- no duplicate source item inside the same template for the same `item_type + item_id`

Meaning:

- a template cannot contain two items at the same sequence position
- a template cannot attach the same reusable source record twice by default

Future note:

- deliberate repetition of the same source item is out of scope for this phase
- if repetition is ever needed, it must be explicitly designed and approved later

---

## 10. Validation Rules

The builder must validate both header data and item data.

### Header validation

Required:

- `name` must be present
- `template_type` must be one approved value
- `model_id` must be present

Optional but validated when present:

- `interval_hours` must be a non-negative whole number
- `interval_months` must be a non-negative whole number
- `description` may be blank

Recommended validation:

- at least one of `interval_hours` or `interval_months` should be present for recurring types such as `50_HOUR`, `100_HOUR`, and `ANNUAL`
- `CUSTOM` may allow both intervals to remain blank

### Item validation

Required:

- `item_type` must be present
- `item_type` must be one approved value
- `item_id` must be present
- `sequence_no` must be present
- `sequence_no` must be a positive integer
- `is_required` must be present

Conditional validation:

- if `item_type = 'STANDARD_TASK'`, `item_id` must resolve to `task_templates.id`
- if `item_type = 'COMPLIANCE_ITEM'`, `item_id` must resolve to `compliance_items.id`
- if `item_type = 'SID'`, `item_id` must resolve to `supplemental_inspection_documents.id`

Builder validation rule:

- invalid source combinations must be blocked before save in a later implementation phase

---

## 11. Model Applicability Constraints

Initial builder behavior:

- every template belongs to one primary `component_models.id`

Future enforcement rule:

- item sources should later be checked for compatibility with the selected `model_id`
- this is especially important for:
  - model-scoped standard tasks
  - compliance items derived from model-applicable AD/SB logic
  - SID records linked through model applicability

Important boundary:

- this phase only records the requirement
- it does not implement enforcement logic

---

## 12. Boundary Rules

The template builder is planning-only.

It must not:

- create workpacks
- create workpack tasks
- create task cards
- create workpack execution rows
- execute compliance
- certify maintenance
- alter source library records as part of template composition

The builder only creates reusable template definitions composed of source references.

---

## 13. Summary

The future template builder must:

- create a template header first
- support `MPI`, `50_HOUR`, `100_HOUR`, `ANNUAL`, and `CUSTOM`
- attach ordered items from approved reusable sources
- store `item_type`, `item_id`, `sequence_no`, `is_required`, and `notes`
- enforce ordering and duplicate-prevention rules
- validate header and item integrity
- note future model-applicability enforcement
- remain strictly outside workpack and task execution behavior

---

**END OF PHASE 8.5 TEMPLATE BUILDER DESIGN**
