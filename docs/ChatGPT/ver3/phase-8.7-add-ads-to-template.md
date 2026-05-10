# PHASE 8.7 - ADD ADS TO TEMPLATE

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-02  
**Purpose:** Define the future Jupiter design for attaching applicable AD-derived compliance items into existing maintenance templates through `maintenance_template_items` without implementing schema, code, routes, services, or UI in this phase.

---

## 1. Scope

This phase defines the AD-to-template attachment design only.

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

This phase defines how a planner will add AD obligations into an already existing maintenance template.

The design must support:

- selecting an existing maintenance template
- showing AD-derived template candidates from `compliance_items`
- restricting normal selection to ADs applicable to the template model
- selecting one compliance item
- adding it to the template as a `maintenance_template_items` row
- assigning order and optional planner notes
- marking whether the item is required or optional

This phase remains planning-only.

---

## 3. Source Systems Involved

The AD attachment flow uses:

- `maintenance_templates`
- `maintenance_template_items`
- `compliance_items`

Source interpretation rule:

- ADs enter the template system through projected `compliance_items`
- raw AD master records are not attached directly to templates in this phase

Expected AD source identity:

- `compliance_items.item_type = 'AD'`
- AD lineage is understood from `compliance_items.source_type + compliance_items.source_id` where supported by the approved compliance projection design

---

## 4. Template Selection Flow

The AD attachment workflow starts by selecting an existing maintenance template.

Required flow:

1. User opens an existing maintenance template.
2. User enters the template composition area.
3. User chooses to add an AD-based source item.
4. System anchors the add operation to the selected `maintenance_templates.id`.

Design rule:

- an AD-derived template item cannot be added without a valid existing parent template

Stored parent reference:

- `template_id = maintenance_templates.id`

---

## 5. AD Candidate Source

The planner must select AD obligations from `compliance_items`, not from raw AD master rows.

Required candidate filter:

- `compliance_items.item_type = 'AD'`

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

- the builder must attach only projected AD compliance items
- the builder must not attach `airworthiness_directives.id` directly

---

## 6. Applicability Rule

Normal builder behavior must show only AD compliance items that are applicable to the selected template model.

Required design rule:

- show applicable ADs for the template model

Default restriction:

- non-applicable ADs must not be shown as normal selectable candidates

Override boundary:

- adding a non-applicable AD is not part of the default flow
- any override behavior requires explicit future approval

Important note:

- this phase defines the rule only
- it does not implement the applicability resolver

---

## 7. AD Item Mapping

When an AD-derived compliance item is selected, the builder must create one `maintenance_template_items` record.

Required mapping:

- `template_id = maintenance_templates.id`
- `item_type = 'COMPLIANCE_ITEM'`
- `item_id = compliance_items.id`
- `sequence_no = assigned order value`
- `is_required = chosen required/optional state`
- `notes = optional planner note`

Meaning:

- the template item stores a reference to one projected AD compliance obligation
- the template item does not copy the full AD record into template-owned storage

---

## 8. Sequence Handling

Every attached AD-derived template item must have explicit sequence order inside the template.

Required rules:

- `sequence_no` is required
- `sequence_no` must be unique within the selected template
- lower sequence numbers appear first
- visible order must match stored order exactly

Recommended behavior:

- if the planner adds an AD item at the end, assign the next available sequence number
- if inserted between existing items, later implementation may resequence the list
- sequence values should normalize to simple ascending integers

---

## 9. Required/Optional Handling

Each attached AD-derived item must define whether it is required in that template.

Stored behavior:

- `is_required = true`
  - the AD-derived item is required in the template
- `is_required = false`
  - the AD-derived item is attached as optional

Recommended default:

- default AD-derived template items to `is_required = true`

Design rule:

- required/optional state belongs to the template item
- it must not alter the source `compliance_items` row

---

## 10. Notes Handling

The planner may attach a template-specific note to the selected AD-derived item.

Stored behavior:

- `notes`
  - optional planner-facing item note stored on `maintenance_template_items`

Purpose of notes:

- explain why the AD item is included
- capture planning-only context
- record template-specific handling instructions without editing the compliance source record

Design rule:

- notes belong to the template item only
- notes must not alter `compliance_items`

---

## 11. Validation Rules

The add-AD flow must validate before saving in a later implementation phase.

Required validation:

- selected `template_id` must exist in `maintenance_templates`
- selected `item_id` must exist in `compliance_items`
- selected `compliance_items.item_type` must equal `AD`
- `item_type` stored on the template item must equal `COMPLIANCE_ITEM`
- `sequence_no` must be present
- `sequence_no` must be a positive integer
- `is_required` must be present

Applicability validation:

- the selected AD-derived compliance item must match the template model through the approved applicability layer
- non-applicable AD selection must be blocked unless a future override phase is approved

Recommended validation:

- active compliance items should be preferred
- cancelled or inactive AD-derived compliance items should be blocked or clearly warned in a later implementation phase
- empty notes are allowed

---

## 12. Duplicate Prevention

This flow must prevent duplicate attachment of the same AD-derived compliance item within the same template.

Required duplicate prevention rule:

- `template_id + item_type + item_id`

Meaning:

- the same `compliance_items.id` must not be attached twice to the same template as `COMPLIANCE_ITEM`

Also required:

- no duplicate `sequence_no` inside the same template

Future note:

- deliberate repetition of the same AD-derived item is out of scope for this phase

---

## 13. Boundaries

This AD attachment phase is planning-only.

It must not:

- create workpacks
- create task cards
- create `workpack_tasks`
- create `workpack_executions`
- trigger workpack generation
- execute maintenance logic
- modify `compliance_items`
- modify raw AD master records

The only intended future persistence target in this phase is:

- one new `maintenance_template_items` row linked to an existing `maintenance_templates` row

---

## 14. Summary

The future add-AD flow must:

- start from an existing maintenance template
- select AD-derived candidates from `compliance_items`
- show normally selectable ADs only when applicable to the template model
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

**END OF PHASE 8.7 ADD ADS TO TEMPLATE**
