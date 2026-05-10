# PHASE 9.5 - WORKPACK PREVIEW BEFORE COMMIT

**Status:** Completed (READ-ONLY DESIGN)  
**Date:** 2026-05-02  
**Purpose:** Define the pre-commit workpack preview flow without creating any workpack, task, execution, or compliance records.

---

## 1. Scope

This phase is design only.

It does not perform:

- implementation code
- schema changes
- migrations
- model changes
- service changes
- controller changes
- route changes
- UI changes
- database writes
- workpack generation
- task creation

This phase defines the preview contract that must run before any later commit/generation phase.

---

## 2. Preview Input

The preview requires exactly:

- `template_id`
- `aircraft_id`

No additional write-time parameters are required in this phase.

---

## 3. Validation Rules

The preview must validate all blocking conditions before building the output.

Required validations:

- template exists
- template is active
- aircraft exists
- template `model_id` matches aircraft `model_id`
- template has at least one item
- all referenced source records exist

Validation is read-only.

If any blocking validation fails:

- the preview must still return a structured error result
- blocking errors must be visible to the user
- generation must not be allowed

---

## 4. Read-Only Data Resolution

The preview resolves:

- selected maintenance template
- selected aircraft
- aircraft model
- maintenance template items
- source records behind each template item

Supported grouped item types for this phase:

- `STANDARD_TASK`
- `COMPLIANCE_ITEM`
- `SID`

No records are inserted, updated, deleted, reserved, or locked.

---

## 5. Preview Output

The preview output must include:

- template name
- aircraft registration
- aircraft model
- total items
- grouped items:
  - `STANDARD_TASK`
  - `COMPLIANCE_ITEM`
  - `SID`

The output is for inspection only.

It must represent what the later generation phase intends to create, without actually creating it.

---

## 6. Item Display Rules

Each preview item must display:

- sequence number
- item type
- source reference
- title
- description
- required flag
- notes
- validation status

Field intent:

- sequence number:
  Uses template ordering so the preview matches intended generated order.

- item type:
  Shows the normalized template source class.

- source reference:
  Shows the best human-readable source identifier available from the underlying source record.
  Examples include task card number, compliance reference, AD/SB reference, or SID reference.

- title:
  Shows the source item title that would be used during later generation.

- description:
  Shows the source description that would be mapped into generated task content later.

- required flag:
  Preserves the template required/optional intent.

- notes:
  Preserves template item notes exactly as stored.

- validation status:
  Shows whether the item is ready for later generation or blocked by a source/compatibility issue.

---

## 7. Grouping Rules

Preview items must be grouped by source type:

- `STANDARD_TASK`
- `COMPLIANCE_ITEM`
- `SID`

Within each group, display order must follow the template item order.

The preview must also preserve the global intended generation sequence so later commit logic can match the same ordering.

---

## 8. Validation Status Rules Per Item

Each item must receive a validation status.

Allowed conceptual states:

- `READY`
- `BLOCKED`

`READY` means:

- referenced source record exists
- required display fields are readable
- no model or applicability mismatch blocks preview

`BLOCKED` means one or more of the following:

- source record missing
- incompatible source data
- missing title/reference required for safe generation
- unsupported source mapping for current schema

If any item is `BLOCKED`, generation must not be allowed.

---

## 9. Failure Display

Blocking errors must be shown clearly in the preview response.

Examples of blocking errors:

- template not found
- template inactive
- aircraft not found
- template model mismatch
- template contains no items
- source record missing
- source record incompatible with later generation mapping

Failure behavior:

- blocking errors shown
- grouped preview may be omitted if the request cannot be resolved safely
- generation not allowed

This phase is not responsible for recovery or auto-fix behavior.

---

## 10. Commit Boundary

This phase is preview only.

Strict boundary:

- this phase does **NOT** call `generateWorkpackFromTemplate(...)`
- this phase does **NOT** create a workpack
- this phase does **NOT** create task cards
- this phase does **NOT** create workpack-task links
- this phase does **NOT** create executions
- generation happens in a later phase only

The preview is an inspection gate before any write operation is permitted.

---

## 11. Later-Phase Handoff

If preview validation passes:

- the selected `template_id` and `aircraft_id` remain the inputs to the later commit/generation phase
- later generation must use the same ordering and source resolution assumptions shown in the preview

If preview validation fails:

- no commit action is allowed
- user must resolve blocking issues before a later generation phase can proceed

---

## 12. Design Summary

The workpack preview before commit is a read-only validation and visibility step.

It confirms:

- the selected template and aircraft are compatible
- the template has usable items
- each source record can be resolved
- the user can inspect grouped preview content before any database write occurs

It does not generate anything and does not call `generateWorkpackFromTemplate(...)`.

---

**END OF PHASE 9.5 WORKPACK PREVIEW BEFORE COMMIT**
