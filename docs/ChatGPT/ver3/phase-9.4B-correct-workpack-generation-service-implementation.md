# PHASE 9.4B - CORRECT WORKPACK GENERATION SERVICE IMPLEMENTATION

**Status:** Completed (READ-ONLY Clarification Phase)  
**Date:** 2026-05-02  
**Purpose:** Define the correct future implementation behavior for the workpack generation service so it follows the approved persistence model without creating copied task entities or altering compliance state.

---

## 1. Scope

This phase is implementation guidance only.

It does not perform:

- implementation code
- schema changes
- migrations
- model creation or updates
- service edits
- controller changes
- route changes
- UI changes

This document clarifies how the future service implementation must behave.

---

## 2. Purpose

The workpack generation service must follow the corrected persistence model from Phase 9.4A.

This means:

- no separate generated task entity
- no copied source-data patterns
- no compliance-side mutation during generation

The service implementation must create only the approved workpack-level persistence records and stop there.

---

## 3. No Separate Task Table or Entity Creation

The future workpack generation service must not create a separate generated task table or entity.

Required rule:

- no separate task table/entity creation

Meaning:

- the service must not invent a new generated-task persistence layer
- the service must not create a snapshot-style task copy table
- the service must not clone standard library task rows into a second execution-preparation table

---

## 4. Workpack Insert

The future generation service must create one workpack header row first.

Required rule:

- workpack insert into `workpacks`

Meaning:

- the generated workpack remains the parent execution container
- all downstream generation rows must belong to the inserted workpack

Boundary:

- this phase does not redefine the full workpack column list
- it only confirms that generation begins with a `workpacks` insert

---

## 5. Workpack Task Row Creation

After the workpack header is created, the service must create planned/generated linkage rows.

Required rule:

- one `workpack_tasks` row per template item

Meaning:

- each `maintenance_template_items` row generates exactly one `workpack_tasks` row
- one template item must not expand into multiple `workpack_tasks` rows in the same generation run
- ordering still follows template `sequence_no`

---

## 6. Workpack Execution Row Creation

Each generated workpack task linkage must receive one execution row.

Required rule:

- one `workpack_executions` row per `workpack_task`

Meaning:

- every generated work item has one initial execution tracking row
- no execution row may exist without its corresponding generated `workpack_tasks` row

Execution boundary:

- this phase does not authorize certification, closure, or completion logic

---

## 7. Item Mapping

The service implementation must preserve source identity through direct source-linked mapping.

Required item mapping:

- `STANDARD_TASK` -> `task_template_id`
- `COMPLIANCE_ITEM` -> `compliance_item_id`
- `SID` -> `sid_id`

Meaning:

- the generated work must remain traceable to the exact source item
- mapping must rely on source identifiers instead of copied source payload tables

Implementation note:

- field placement must follow approved schema reality in the implementation phase
- this document defines the required source-link intent

---

## 8. Validation Before Transaction

The service must validate all blocking conditions before generation inserts begin.

Required rule:

- validation before transaction

Minimum validation:

- selected aircraft exists
- selected template exists
- template is active
- template model matches aircraft model
- template contains at least one item
- every template item has valid source mapping
- every mapped source record exists

Failure rule:

- if validation fails, generation must not begin inserts

---

## 9. Transaction Rule

All generation inserts must run as one atomic unit.

Required rule:

- all inserts inside one transaction

Included inserts:

- `workpacks`
- all `workpack_tasks`
- all `workpack_executions`

Strict rule:

- the generation service must not split these inserts across separate transactions

---

## 10. Rollback Rule

The service must remain fully atomic under failure.

Required rule:

- rollback all inserts on failure

Failure examples:

- workpack insert fails
- `workpack_tasks` insert fails
- `workpack_executions` insert fails
- source-link mapping fails during generation

Outcome:

- no partial workpack generation data may remain

---

## 11. Compliance Boundaries

The generation service must remain outside compliance creation and compliance state management.

Required boundaries:

- no `compliance_items` creation
- no projection trigger
- no compliance state modification

Meaning:

- generation may consume existing compliance-linked source references only
- generation must not project new compliance
- generation must not mark compliance due, satisfied, completed, or linked through state mutation side effects

---

## 12. Workpack Lifecycle Boundaries

The generation service must stop at initial creation and execution-row scaffolding.

Required boundaries:

- no workpack certification
- no workpack closure

Meaning:

- generation only creates the workpack and its immediate child execution records
- lifecycle advancement belongs to later workpack execution phases

---

## 13. Summary

Phase 9.4B clarifies that the future workpack generation service implementation must:

- create no separate generated task table or entity
- insert one parent row into `workpacks`
- create one `workpack_tasks` row per template item
- create one `workpack_executions` row per generated `workpack_task`
- preserve source mapping through:
  - `STANDARD_TASK` -> `task_template_id`
  - `COMPLIANCE_ITEM` -> `compliance_item_id`
  - `SID` -> `sid_id`
- complete all validation before inserts begin
- run all inserts inside one transaction
- roll back all inserts on failure
- avoid `compliance_items` creation, projection triggers, compliance state changes, certification, and closure logic

---

**END OF PHASE 9.4B CORRECT WORKPACK GENERATION SERVICE IMPLEMENTATION**
