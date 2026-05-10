# PHASE 9.4A - CORRECT WORKPACK GENERATION PERSISTENCE

**Status:** Completed (READ-ONLY Clarification Phase)  
**Date:** 2026-05-02  
**Purpose:** Clarify the intended persistence model for future workpack generation so later implementation does not introduce incorrect task-copying or duplicate source-data patterns.

---

## 1. Scope

This phase is a clarification-only document.

It does not perform:

- implementation code
- schema changes
- migrations
- model creation or updates
- service changes
- controller changes
- route changes
- UI changes
- real workpack generation

This document corrects persistence expectations only.

---

## 2. Purpose

Previous design wording may suggest that workpack generation creates a separate generated task entity.

This clarification removes that ambiguity.

The future workpack generation flow must persist generated work only through the existing workpack execution structures and source-link fields, without inventing a separate copied task domain for template generation.

---

## 3. No Separate Task Entity

Future workpack generation must not create a separate generic generated-task entity outside the existing workpack persistence structures.

Clarification rule:

- no separate task entity is created for template generation persistence

Meaning:

- the generator must not introduce a new intermediate task snapshot concept
- the generator must not depend on a copied library-task table
- the generator must not duplicate source records into a new planning table

---

## 4. Generated Work Representation

Generated work must be represented only by:

- `workpack_tasks`
- `workpack_executions`

Clarification rule:

- these two structures are the persistence boundary for generated template work

Meaning:

- `workpack_tasks` represents the planned/generated linkage inside the workpack
- `workpack_executions` represents the executable tracking row for each generated work item

No additional generated-task persistence layer is allowed in this phase definition.

---

## 5. Template Item to Workpack Mapping

Each template item becomes exactly one generated workpack linkage row.

Required rule:

- each `maintenance_template_items` row becomes one `workpack_tasks` row

Meaning:

- generation is one-to-one at the template item level by default
- duplicate expansion of the same template item during one generation run is not allowed

Ordering rule:

- template item order must still follow ascending `sequence_no`

---

## 6. Workpack Execution Mapping

Each generated workpack task linkage must also receive one execution row.

Required rule:

- each `workpack_task` gets one `workpack_executions` row

Execution rule:

- the execution row is the initial execution container for the generated work item
- initial execution state must remain the phase-defined starting state used by the execution layer

No orphan rule:

- no `workpack_executions` row may exist without its corresponding generated `workpack_tasks` row

---

## 7. Item Mapping Rules

Generated work must preserve source identity through direct source-linked fields.

Required item mapping:

- `STANDARD_TASK` -> `task_template_id`
- `COMPLIANCE_ITEM` -> `compliance_item_id`
- `SID` -> `sid_id`

Clarification meaning:

- generated work must retain direct traceability to its source item type and source id
- mapping must use source-linked identifiers rather than copied library data structures

Important note:

- this phase defines the persistence intent only
- exact field placement must follow approved implementation and existing schema realities in later implementation phases

---

## 8. Transaction Rule

All persistence for one generation run must occur inside one transaction.

Required rule:

- all inserts must be inside one transaction

Included inserts:

- workpack header insert
- all `workpack_tasks` inserts
- all `workpack_executions` inserts

Strict rule:

- no generation insert may occur outside the generation transaction

---

## 9. Rollback Rule

Generation must remain fully atomic.

Required rule:

- rollback all inserts if any insert fails

Failure cases include:

- workpack insert failure
- `workpack_tasks` insert failure
- `workpack_executions` insert failure
- source mapping failure discovered before or during insert

Outcome rule:

- no partial workpack data may remain after failure

---

## 10. Forbidden Patterns

The following persistence patterns are explicitly forbidden:

- no task snapshot table
- no copied `task_templates` table
- no duplicated compliance source data
- no duplicated SID source data

Expanded meaning:

- do not create a new generated-task copy table
- do not clone standard task library rows into a second template-generation library
- do not duplicate `compliance_items` content during generation
- do not duplicate SID source rows during generation

Source-of-truth rule:

- source records remain in their master library tables
- workpack generation references those sources instead of copying them

---

## 11. Boundaries

This clarification does not authorize any implementation change.

It does not permit:

- service implementation edits
- controller or route edits
- UI changes
- schema updates
- migration work
- model work

It also does not change prior workpack boundaries:

- no compliance projection
- no compliance creation
- no compliance state mutation

---

## 12. Summary

Phase 9.4A clarifies that future workpack generation persistence must:

- create no separate generated task entity
- represent generated work only through `workpack_tasks` and `workpack_executions`
- map each template item to one `workpack_tasks` row
- map each generated `workpack_task` to one `workpack_executions` row
- preserve source identity using:
  - `STANDARD_TASK` -> `task_template_id`
  - `COMPLIANCE_ITEM` -> `compliance_item_id`
  - `SID` -> `sid_id`
- run all inserts inside one transaction
- roll back all inserts on any failure
- avoid task snapshot tables, copied task-template tables, and duplicated compliance or SID source data

---

**END OF PHASE 9.4A CORRECT WORKPACK GENERATION PERSISTENCE**
