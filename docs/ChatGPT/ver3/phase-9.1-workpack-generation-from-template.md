# PHASE 9.1 - WORKPACK GENERATION FROM TEMPLATE

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-02  
**Purpose:** Define the future Jupiter design for generating a workpack from a selected maintenance template and aircraft without implementing schema, code, routes, services, or UI in this phase.

---

## 1. Scope

This phase defines workpack generation from template only.

It does not perform:

- implementation code
- schema changes
- migrations
- model creation or updates
- controller/service work
- route work
- UI implementation
- real workpack generation
- real task creation
- compliance creation or projection

This document is the source-of-truth design for a later implementation phase.

---

## 2. Purpose

This phase defines how Jupiter should convert one selected maintenance template into one future workpack for one selected aircraft.

The design must support:

- selecting an aircraft
- selecting a compatible template
- validating the selection pair
- loading ordered template items
- transforming those items into future workpack content
- creating future workpack-task and workpack-execution concepts
- preserving compliance boundaries

This phase remains design-only and does not execute any persistence.

---

## 3. Entry Inputs

The future workpack generation flow starts with two primary inputs:

- selected aircraft
- selected maintenance template

Expected source records:

- `aircraft.id`
- `maintenance_templates.id`

Aircraft role:

- identifies the real aircraft receiving the generated workpack

Template role:

- identifies the reusable model-level planning package that will drive workpack composition

---

## 4. Template + Aircraft Selection Flow

The future workpack generation flow must be:

1. User selects an aircraft.
2. System resolves the aircraft model.
3. System loads compatible maintenance templates.
4. User selects one template.
5. System validates that the template is usable for the selected aircraft.
6. System loads the template header and ordered template items.
7. System previews the generation result before commit in a later phase.

Selection rule:

- templates must be offered based on the aircraft model first

Fallback note:

- cross-model or override-based template use is not part of the default flow in this phase

---

## 5. Validation Rules

The future workpack generation flow must validate before any persistence in a later implementation phase.

Required validation:

- selected aircraft must exist
- selected template must exist
- template must be active
- aircraft must have a resolved `model_id`
- template `model_id` must match the selected aircraft model in the default flow
- template must contain at least one item

Template item validation:

- every template item must have:
  - `item_type`
  - `item_id`
  - `sequence_no`
  - `is_required`
- `sequence_no` must remain unique within the template
- template items must be processed in stored ascending order

Source validation:

- `STANDARD_TASK` items must resolve to `task_templates.id`
- `COMPLIANCE_ITEM` items must resolve to `compliance_items.id`
- `SID` items must resolve to `supplemental_inspection_documents.id`

Failure rule:

- any missing or invalid required source record must block generation commit in a later implementation phase

---

## 6. Workpack Creation Concept

The future workpack generation process creates one workpack header as the destination execution container.

Conceptual output:

- one new `workpacks` row

The workpack header should conceptually capture:

- aircraft reference
- workpack type
- template source identity
- generated timestamp
- generation actor in a later implementation phase

Design rule:

- the generated workpack is an execution/planning artifact
- the source of truth remains the aircraft, the reusable template, and the underlying source-library items

---

## 7. Template Item Loading

The future generator must load:

- the selected `maintenance_templates` header
- all linked `maintenance_template_items`
- the referenced source records for each item

Loading behavior:

- load items in ascending `sequence_no`
- preserve the template-defined order exactly
- resolve item references according to `item_type`

Required source resolution:

- `STANDARD_TASK` -> `task_templates`
- `COMPLIANCE_ITEM` -> `compliance_items`
- `SID` -> `supplemental_inspection_documents`

---

## 8. Transformation Rules

Each template item type transforms differently into future workpack content.

### STANDARD_TASK

Source:

- `task_templates.id`

Transformation concept:

- create one generated task record derived from the reusable standard task definition
- copy the task identity and task content needed for execution
- preserve the source linkage back to the template item and source task

Expected downstream meaning:

- this becomes a normal executable work item in the generated workpack

### COMPLIANCE_ITEM

Source:

- `compliance_items.id`

Transformation concept:

- create one generated task or compliance-linked work item based on the projected compliance source
- preserve linkage to the compliance identity so later compliance handling can resolve correctly
- keep AD/SB-specific source interpretation outside this phase

Expected downstream meaning:

- this item participates in workpack planning and may later connect to compliance tracking

### SID

Source:

- `supplemental_inspection_documents.id`

Transformation concept:

- create one generated task or source-linked work item derived from the SID source record
- preserve linkage to the SID source identity
- keep any future SID-specific compliance projection outside this phase

Expected downstream meaning:

- this item becomes part of the generated workpack while still tracing back to the reusable SID source record

---

## 9. Workpack Tasks Creation Concept

The future generator must create workpack-task linkage for the generated task set.

Conceptual output:

- generated executable task rows
- linked `workpack_tasks` rows connecting those tasks to the new workpack

Required design behavior:

- one generated work item per template item by default
- one `workpack_tasks` linkage per generated work item
- no duplicate attachment of the same generated task to the same workpack

Source traceability expectation:

- each generated task should retain enough metadata in a later implementation phase to identify:
  - source template
  - source template item
  - source item type
  - source item id

---

## 10. Workpack Executions Creation Concept

The future generator must also account for execution tracking compatibility.

Conceptual output:

- one initial `workpack_executions` row per generated task if the existing execution model requires immediate execution scaffolding

Design rule:

- execution records are execution-layer artifacts, not source-of-truth planning records
- any created execution row must remain linked to the generated task and workpack only

Open implementation note:

- a later implementation phase must confirm whether `workpack_executions` are created immediately at generation time or deferred until execution begins

For this design phase:

- both options are acknowledged
- the current concept assumes compatibility with the existing execution model is required

---

## 11. Ordering Rules

The future generated workpack content must preserve template order.

Required ordering rules:

- template items are processed in ascending `sequence_no`
- generated task display order must match template order
- generation order must not depend on source type
- generation order must not depend on source lookup timing or database default ordering

If multiple item types exist in one template:

- mixed-source items still follow one single ordered list

---

## 12. Compliance Boundary

This phase must keep compliance generation boundaries explicit.

Important rule:

- workpack generation from template may consume `COMPLIANCE_ITEM` references
- this phase does not define or implement new compliance projection
- this phase does not define or implement compliance creation

Boundary meaning:

- AD/SB obligations must already exist as `compliance_items` before template generation uses them
- SID items remain direct source references in this phase
- compliance creation, update, projection, or deduplication logic belongs to later workpack/compliance phases

---

## 13. Error Handling

The future workpack generation flow must fail safely.

Required error cases:

- aircraft not found
- aircraft has no valid model
- template not found
- template inactive
- template model does not match aircraft model
- template has no items
- template item source record missing
- duplicate or invalid item ordering
- unsupported `item_type`

Expected error behavior:

- stop generation before partial commit
- report the exact blocking problem
- do not create a partial workpack
- do not create partial tasks
- do not create partial execution rows

Transactional expectation for later implementation:

- generation commit must be all-or-nothing

---

## 14. Future Extensions

Future phases may extend this design with:

- template preview before commit
- template-to-aircraft override rules
- cross-model template usage with approval
- richer source-specific task transformation for AD/SB/SID
- compliance deduplication logic at generation time
- generation audit history
- regeneration/versioning rules
- partial generation or selective template item exclusion
- due-status integration based on aircraft maintenance state

These are outside this phase.

---

## 15. Summary

The future workpack generation flow must:

- start from aircraft + template selection
- validate that the template is compatible with the aircraft
- load the ordered template item set
- transform `STANDARD_TASK`, `COMPLIANCE_ITEM`, and `SID` items into generated workpack content
- create future `workpack_tasks` linkage
- remain compatible with future `workpack_executions`
- preserve template ordering
- keep compliance creation/projection outside this phase
- fail safely without partial generation

---

**END OF PHASE 9.1 WORKPACK GENERATION FROM TEMPLATE**
