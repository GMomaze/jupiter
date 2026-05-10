# PHASE 8.6 - ADD STANDARD TASKS TO TEMPLATE

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-02  
**Purpose:** Define the future Jupiter design for attaching reusable standard tasks from `task_templates` into existing maintenance templates through `maintenance_template_items` without implementing schema, code, or UI in this phase.

---

## 1. Scope

This phase defines the standard-task-to-template attachment design only.

It does not perform:

- implementation code
- schema changes
- migrations
- model creation or updates
- service/controller work
- route work
- UI implementation
- workpack generation
- task execution

This document is the source-of-truth design for a later implementation phase.

---

## 2. Purpose

This phase defines how a planner will add reusable standard tasks into an already existing maintenance template.

The design must support:

- selecting an existing maintenance template
- searching or browsing reusable standard tasks
- selecting a standard task
- adding that task to the template as a `maintenance_template_items` row
- assigning order and optional planner notes
- marking whether the task is required or optional

This phase must remain planning-only.

---

## 3. Source Systems Involved

The standard-task attachment flow uses:

- `maintenance_templates`
- `maintenance_template_items`
- `task_templates`

Meaning:

- `maintenance_templates`
  - the existing parent reusable maintenance package
- `maintenance_template_items`
  - the child composition rows attached to the template
- `task_templates`
  - the reusable standard task source library

---

## 4. Template Selection Flow

The standard-task attachment workflow starts by selecting an existing maintenance template.

Required flow:

1. User opens an existing maintenance template.
2. User enters the template composition area.
3. User chooses to add a standard task source item.
4. System anchors the add operation to the selected `maintenance_templates.id`.

Design rule:

- a standard task cannot be added without a valid existing parent template

Stored parent reference:

- `template_id = maintenance_templates.id`

---

## 5. Standard Task Search and Browse

The planner must be able to find reusable standard tasks from `task_templates`.

The design must support:

- search by task title
- search by task card number if available
- search by code if available
- browse active reusable standard tasks
- view enough task summary data to make a safe selection

Recommended visible fields during selection:

- task title
- task card number
- code
- description summary
- interval hours
- interval months
- model applicability if available
- active/inactive state

Selection rule:

- only reusable source tasks from `task_templates` may be added in this phase

---

## 6. Standard Task Item Mapping

When a standard task is selected, the builder must create one `maintenance_template_items` record.

Required mapping:

- `template_id = maintenance_templates.id`
- `item_type = 'STANDARD_TASK'`
- `item_id = task_templates.id`
- `sequence_no = assigned order value`
- `is_required = chosen required/optional state`
- `notes = optional planner note`

Meaning:

- the template item stores a reference to the selected reusable standard task
- the template item does not copy the full task definition into template-owned storage

---

## 7. Sequence Handling

Every attached standard task item must have explicit sequence order inside the template.

Required rules:

- `sequence_no` is required
- `sequence_no` must be unique within the selected template
- lower sequence numbers appear first
- visible order must match stored order exactly

Recommended behavior:

- if the planner adds a task at the end, assign the next available sequence number
- if the planner inserts between existing items, later implementation may resequence the list
- sequence numbering should normalize to simple ascending integers

Design note:

- ordering belongs to the template composition layer, not to `task_templates.sort_order`

---

## 8. Required/Optional Handling

Each attached standard task must define whether it is required in that template.

Stored behavior:

- `is_required = true`
  - the task is part of the template as a required item
- `is_required = false`
  - the task is attached as an optional item

Design rule:

- required/optional state belongs to the template item
- it must not modify the source `task_templates` record

Recommended default:

- default new standard-task template items to `is_required = true`

---

## 9. Notes Handling

The planner may attach a template-specific note to the selected standard task item.

Stored behavior:

- `notes`
  - optional planner-facing item note stored on `maintenance_template_items`

Purpose of notes:

- clarify why the task is included
- capture planning-only context
- record template-specific instructions without editing the source task

Design rule:

- notes belong to the template item only
- notes must not alter `task_templates`

---

## 10. Validation Rules

The add-standard-task flow must validate before saving in a later implementation phase.

Required validation:

- selected `template_id` must exist in `maintenance_templates`
- selected source task must exist in `task_templates`
- `item_type` must equal `STANDARD_TASK`
- `item_id` must equal the selected `task_templates.id`
- `sequence_no` must be present
- `sequence_no` must be a positive integer
- `is_required` must be present

Recommended validation:

- the selected source task should be active unless a future override rule is approved
- empty notes are allowed
- whitespace-only notes should normalize to blank

Failure rule:

- invalid template reference, invalid task reference, or invalid sequence data must block save

---

## 11. Duplicate Prevention

This flow must prevent duplicate attachment of the same standard task within the same template.

Required duplicate prevention rule:

- `template_id + item_type + item_id`

Meaning:

- the same `task_templates.id` must not be attached twice to the same template as `STANDARD_TASK`

Also required:

- no duplicate `sequence_no` inside the same template

Future note:

- deliberate repetition of the same standard task is out of scope for this phase
- if repetition is ever needed, it must be designed explicitly later

---

## 12. Model Compatibility Note

The selected maintenance template has a primary `model_id`.

Future enforcement note:

- the selected standard task should later be checked for compatibility with the template model
- this is especially relevant where `task_templates` contains:
  - model-scoped tasks
  - aircraft-scoped tasks
  - applicability flags that limit valid use

Important boundary:

- this phase records the requirement only
- it does not implement compatibility enforcement

Conservative design expectation:

- future implementation should avoid attaching obviously incompatible standard tasks to a template model without an explicit override design

---

## 13. Boundaries

This standard-task attachment phase is planning-only.

It must not:

- create workpacks
- create task cards
- create `workpack_tasks`
- create `workpack_executions`
- trigger workpack generation
- execute maintenance logic
- modify `task_templates`

The only intended future persistence target in this phase is:

- one new `maintenance_template_items` row linked to an existing `maintenance_templates` row

---

## 14. Summary

The future add-standard-task flow must:

- start from an existing maintenance template
- search or browse reusable standard tasks from `task_templates`
- add the chosen task as a `maintenance_template_items` row
- store `item_type = 'STANDARD_TASK'`
- store `item_id = task_templates.id`
- assign a valid `sequence_no`
- capture `is_required`
- capture optional `notes`
- validate template, task, and sequence integrity
- prevent duplicates using `template_id + item_type + item_id`
- note future model compatibility enforcement
- remain strictly outside workpack and execution behavior

---

**END OF PHASE 8.6 ADD STANDARD TASKS TO TEMPLATE**
