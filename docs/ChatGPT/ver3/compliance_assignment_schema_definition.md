# Compliance Assignment Schema Definition

**Status:** Final Definition  
**Date:** 2026-05-01  
**Purpose:** Define the approved schema shape for compliance assignment targeting in Jupiter after `compliance_items` projection, using a single assignment table for model-level applicability and aircraft-level overrides.

---

## 1. Dependency

This definition proceeds only because Phase 7.2 explicitly selected:

## **CREATE SINGLE COMPLIANCE_ASSIGNMENTS TABLE**

This document is the authoritative schema-definition source for that decision.

---

## 2. Scope

This definition applies to:

- `compliance_assignments`

Referenced source tables:

- `compliance_items`
- `component_models`
- `aircraft`

This is a definition phase only.

Not included:

- schema changes
- migrations
- model creation
- controller/service changes
- UI changes
- assignment implementation

---

## 3. Table Definition

Approved table:

- `compliance_assignments`

Purpose:

- store compliance applicability assignments after AD/SB projection
- support model-level assignment as the primary mechanism
- support aircraft-level overrides or additions without duplicating inherited model applicability per aircraft

---

## 4. Required Fields

Required fields:

- `id`
- `compliance_item_id`
- `assignment_type`
- `model_id`
- `aircraft_id`
- `assignment_source`
- `is_active`
- `created_at`
- `updated_at`

---

## 5. Field Definitions

### Identity

- `id`
  - primary key
  - unique assignment row identifier

### Assignment Target

- `compliance_item_id`
  - required
  - references `compliance_items.id`
  - identifies the projected compliance item being assigned

### Assignment Scope

- `assignment_type`
  - required
  - allowed values:
    - `MODEL`
    - `AIRCRAFT`

### Model Target

- `model_id`
  - nullable in the general table shape
  - references `component_models.id`
  - required when `assignment_type = 'MODEL'`

### Aircraft Target

- `aircraft_id`
  - nullable in the general table shape
  - references `aircraft.id`
  - required when `assignment_type = 'AIRCRAFT'`

### Assignment Origin

- `assignment_source`
  - required
  - allowed values:
    - `AUTO`
    - `MANUAL`
  - indicates whether the assignment was created by automated applicability resolution or explicit operator action

### Record State

- `is_active`
  - required
  - active/inactive assignment flag

- `created_at`
  - required timestamp

- `updated_at`
  - required timestamp

---

## 6. Relationship Rules

Approved relationships:

- `compliance_item_id` references `compliance_items.id`
- `model_id` references `component_models.id`
- `aircraft_id` references `aircraft.id`

Interpretation:

- every assignment belongs to one projected compliance item
- model-level assignments target internal models
- aircraft-level assignments target specific aircraft

---

## 7. Assignment Rules

### MODEL assignment rule

If:

- `assignment_type = 'MODEL'`

Then:

- `model_id` is required
- `aircraft_id` must be null

Interpretation:

- the row defines generic model-level applicability
- aircraft inheritance is handled later through aircraft-to-model relationship logic

### AIRCRAFT assignment rule

If:

- `assignment_type = 'AIRCRAFT'`

Then:

- `aircraft_id` is required
- `model_id` is nullable

Interpretation:

- the row defines a direct aircraft-specific applicability override or addition
- `model_id` does not need to be duplicated because the aircraft already resolves to a model through `aircraft.model_id`

---

## 8. Constraints

Required constraints:

- `assignment_type IN ('MODEL', 'AIRCRAFT')`
- `assignment_source IN ('AUTO', 'MANUAL')`

Required valid-target constraint:

- `MODEL` requires `model_id`
- `AIRCRAFT` requires `aircraft_id`

Recommended interpretation of valid-target enforcement:

- `assignment_type = 'MODEL'` requires:
  - `model_id IS NOT NULL`
  - `aircraft_id IS NULL`
- `assignment_type = 'AIRCRAFT'` requires:
  - `aircraft_id IS NOT NULL`
  - `model_id` may remain null

Required duplicate-prevention rule:

- no duplicate active assignment for:
  - `compliance_item_id + model_id`
  - `compliance_item_id + aircraft_id`

Why:

- prevent repeated assignment runs from multiplying rows
- preserve a stable inheritance layer
- keep manual overrides deterministic

---

## 9. Duplicate-Prevention Shape

Approved duplicate-prevention targets:

- `compliance_item_id + model_id`
- `compliance_item_id + aircraft_id`

Interpretation:

- a compliance item may be assigned once to a model
- a compliance item may be assigned once to an aircraft

Active-record note:

- duplicate prevention applies to active assignments
- inactive assignments should not permit two simultaneous active duplicates for the same target

This definition does not prescribe the exact implementation method for active-only uniqueness, but the business rule is mandatory.

---

## 10. Indexes

Required indexes:

- `compliance_item_id`
- `assignment_type`
- `model_id`
- `aircraft_id`
- `assignment_source`
- `is_active`

Purpose:

- support compliance-item lookups
- support assignment-scope filtering
- support model-target assignment queries
- support aircraft-target assignment queries
- support filtering by origin and active state

---

## 11. Inheritance Rule

Approved inheritance rule:

- aircraft inherit compliance through their model
- aircraft-level assignments are explicit overrides/additions
- inherited model compliance is not physically duplicated per aircraft at this stage

### Meaning

If:

- a `MODEL` assignment exists for a compliance item and a model

Then:

- aircraft with `aircraft.model_id = model_id` inherit that compliance conceptually

If:

- an `AIRCRAFT` assignment exists

Then:

- it represents explicit aircraft-specific applicability that supplements or overrides inherited model applicability

### Important boundary

This definition does **not** require:

- creating per-aircraft copies of inherited model assignments
- materializing inheritance into duplicate rows

Inheritance remains a later query/logic concern.

---

## 12. Separation Rules

- `compliance_items` remains the projected operational compliance identity layer
- `compliance_assignments` defines where projected compliance applies
- `aircraft_compliance` remains downstream aircraft-specific status tracking
- no workpack logic is defined here
- no task generation is defined here

Interpretation:

- assignment is a targeting layer
- status and execution remain downstream concerns

---

## 13. Authority

This document is the final schema-definition authority for the `compliance_assignments` table shape in this phase.

If later implementation needs to differ from this document, the definition must be explicitly revised before schema work proceeds.

---

**END OF DEFINITION DOCUMENT**
