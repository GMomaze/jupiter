# PHASE 8.8 - ADD SBS TO TEMPLATE

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-02  
**Purpose:** Define the future Jupiter design for attaching applicable SB-derived compliance items into existing maintenance templates through `maintenance_template_items` without implementing schema, code, routes, services, or UI in this phase.

---

## 1. Scope

This phase defines the SB-to-template attachment design only.

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

## 2. Purpose

This phase defines how a planner will add SB obligations into an already existing maintenance template.

The design must support:

- selecting an existing maintenance template
- showing SB-derived template candidates from `compliance_items`
- restricting normal selection to SBs applicable to the template model
- selecting one compliance item
- adding it to the template as a `maintenance_template_items` row
- assigning order and optional planner notes
- marking whether the item is required or optional

This phase remains planning-only.

---

## 3. Source Systems Involved

The SB attachment flow uses:

- `maintenance_templates`
- `maintenance_template_items`
- `compliance_items`

Source interpretation rule:

- SBs enter the template system through projected `compliance_items`
- raw SB master records are not attached directly to templates in this phase

Expected SB source identity:

- `compliance_items.item_type = 'SB'`
- SB lineage is understood from `compliance_items.source_type + compliance_items.source_id` where supported by the approved compliance projection design

---

## 4. Template Selection Flow

The SB attachment workflow starts by selecting an existing maintenance template.

Required flow:

1. User opens an existing maintenance template.
2. User enters the template composition area.
3. User chooses to add an SB-based source item.
4. System anchors the add operation to the selected `maintenance_templates.id`.

Design rule:

- an SB-derived template item cannot be added without a valid existing parent template

Stored parent reference:

- `template_id = maintenance_templates.id`

---

## 5. SB Candidate Source

The planner must select SB obligations from `compliance_items`, not from raw `service_bulletins` rows.

Required candidate filter:

- `compliance_items.item_type = 'SB'`

Recommended visible fields during selection:

- `code`
- `title`
- `description`
- `authority`
- `revision`
- `issued_on`
- `effective_on`
- `status`

Selection rule:

- the builder must attach only projected SB compliance items
- the builder must not attach `service_bulletins.id` directly

---

## 6. Applicability Rule

Normal builder behavior must show only SB compliance items that are applicable to the selected template model.

Required design rule:

- show applicable SBs for the template model

Default restriction:

- non-applicable SBs must not be shown as normal selectable candidates

Override boundary:

- adding a non-applicable SB is not part of the default flow
- any override behavior requires explicit future approval

Important note:

- this phase defines the rule only
- it does not implement the applicability resolver

---

## 7. SB Item Mapping

When an SB-derived compliance item is selected, the builder must create one `maintenance_template_items` record.

Required mapping:

- `template_id = maintenance_templates.id`
- `item_type = 'COMPLIANCE_ITEM'`
- `item_id = compliance_items.id`
- `sequence_no = assigned order value`
- `is_required = chosen required/optional state`
- `notes = optional planner note`

Meaning:

- the template item stores a reference to one projected SB compliance obligation
- the template item does not copy the full SB record into template-owned storage

---

## 8. Optionality / Recommendation Handling

Each attached SB-derived item must define whether it is required in that template.

Stored behavior:

- `is_required = true`
  - the SB-derived item is treated as required in the template
- `is_required = false`
  - the SB-derived item is treated as optional in the template

Design note:

- the original plan mentions optional/recommended/mandatory handling if supported
- current approved template item structure supports only `is_required`
- this phase therefore records required/optional behavior only
- richer recommendation levels require a future approved schema/design phase

Recommended default:

- default SB-derived template items to `is_required = true`

Design rule:

- required/optional state belongs to the template item
- it must not alter the source `compliance_items` row

---

## 9. Sequence Handling

Every attached SB-derived template item must have explicit sequence order inside the template.

Required rules:

- `sequence_no` is required
- `sequence_no` must be unique within the selected template
- lower sequence numbers appear first
- visible order must match stored order exactly

Recommended behavior:

- if the planner adds an SB item at the end, assign the next available sequence number
- if inserted between existing items, later implementation may resequence the list
- sequence values should normalize to simple ascending integers

---

## 10. Notes Handling

The planner may attach a template-specific note to the selected SB-derived item.

Stored behavior:

- `notes`
  - optional planner-facing item note stored on `maintenance_template_items`

Purpose of notes:

- explain why the SB item is included
- capture planning-only context
- record template-specific handling instructions without editing the compliance source record

Design rule:

- notes belong to the template item only
- notes must not alter `compliance_items`

---

## 11. Validation Rules

The add-SB flow must validate before saving in a later implementation phase.

Required validation:

- selected `template_id` must exist in `maintenance_templates`
- selected `item_id` must exist in `compliance_items`
- selected `compliance_items.item_type` must equal `SB`
- `item_type` stored on the template item must equal `COMPLIANCE_ITEM`
- `sequence_no` must be present
- `sequence_no` must be a positive integer
- `is_required` must be present

Applicability validation:

- the selected SB-derived compliance item must match the template model through the approved applicability layer
- non-applicable SB selection must be blocked unless a future override phase is approved

Recommended validation:

- active compliance items should be preferred
- cancelled, superseded, or inactive SB-derived compliance items should be blocked or clearly warned in a later implementation phase
- empty notes are allowed

---

## 12. Duplicate Prevention

This flow must prevent duplicate attachment of the same SB-derived compliance item within the same template.

Required duplicate prevention rule:

- `template_id + item_type + item_id`

Meaning:

- the same `compliance_items.id` must not be attached twice to the same template as `COMPLIANCE_ITEM`

Also required:

- no duplicate `sequence_no` inside the same template

Future note:

- deliberate repetition of the same SB-derived item is out of scope for this phase

---

## 13. Boundaries

This SB attachment phase is planning-only.

It must not:

- create workpacks
- create task cards
- create `workpack_tasks`
- create `workpack_executions`
- trigger workpack generation
- execute maintenance logic
- modify `compliance_items`
- modify raw `service_bulletins` records

The only intended future persistence target in this phase is:

- one new `maintenance_template_items` row linked to an existing `maintenance_templates` row

---

## 14. Summary

The future add-SB flow must:

- start from an existing maintenance template
- select SB-derived candidates from `compliance_items`
- show normally selectable SBs only when applicable to the template model
- add the selected item as a `maintenance_template_items` row
- store `item_type = 'COMPLIANCE_ITEM'`
- store `item_id = compliance_items.id`
- assign a valid `sequence_no`
- capture `is_required`
- capture optional `notes`
- validate template, compliance item, applicability, and sequence integrity
- prevent duplicates using `template_id + item_type + item_id`
- remain strictly outside workpack and execution behavior

---

**END OF PHASE 8.8 ADD SBS TO TEMPLATE**
