# PHASE 9.3 - WORKPACK GENERATION SERVICE DESIGN

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-02  
**Purpose:** Define the future service-layer design for generating a workpack from a maintenance template and aircraft, without implementing schema, code, routes, controllers, or UI in this phase.

---

## 1. Scope

This phase defines the service contract and orchestration design for future workpack generation.

It does not perform:

- implementation code
- schema changes
- migrations
- model creation or updates
- controller work
- route work
- UI implementation
- real workpack generation
- real task creation
- compliance creation or projection

This document is design-only and builds on Phase 9.1 and Phase 9.2.

---

## 2. Service Location

The future generator should live in the workpacks service layer.

Preferred service location:

- `src/modules/workpacks/services/workpack-generation.service.ts`

Reason:

- generation is workpack orchestration logic
- the service must remain separate from controllers and UI concerns
- the service must coordinate validation, transaction control, source loading, transformation, and result assembly

Boundary note:

- this phase defines the intended service location only
- it does not create the file

---

## 3. Service Entry Point

The future public service method should be:

- `generateWorkpackFromTemplate(params)`

Expected intent:

- accept a template selection and aircraft selection
- validate inputs
- load the generation snapshot
- create the workpack and related execution records
- return a structured generation result

The method is the primary orchestration entry point for later implementation.

---

## 4. Input Params

The future method input should contain:

- `templateId`
- `aircraftId`
- `createdBy`

Expected meaning:

- `templateId`: selected `maintenance_templates.id`
- `aircraftId`: selected `aircraft.id`
- `createdBy`: user identity responsible for generation

Minimum input rules:

- all three values must be present
- `templateId` must resolve to an existing template
- `aircraftId` must resolve to an existing aircraft
- `createdBy` must resolve to a valid internal actor identity in the later implementation phase

Boundary note:

- this phase defines the contract only
- it does not define a controller DTO, route schema, or UI form

---

## 5. WorkpackGenerationResult Shape

The future service result should return the following shape:

- `workpack_id`
- `aircraft_id`
- `template_id`
- `tasks_created`
- `executions_created`
- `status`
- `errors`

Expected result meaning:

- `workpack_id`: created workpack identifier on success, otherwise null or absent by implementation choice
- `aircraft_id`: selected aircraft identifier
- `template_id`: selected template identifier
- `tasks_created`: count of generated work items/tasks
- `executions_created`: count of created execution records
- `status`: service outcome state
- `errors`: collection of blocking or reported error messages

Suggested outcome states:

- `SUCCESS`
- `FAILED`

Design rule:

- failure results must never imply partial success

---

## 6. Orchestration Steps

The future `generateWorkpackFromTemplate(params)` method should orchestrate work in a fixed order.

Required steps:

1. Accept and normalize input params.
2. Validate required fields are present.
3. Load aircraft.
4. Load template header.
5. Validate aircraft-template compatibility.
6. Load ordered template items.
7. Validate item set integrity.
8. Resolve referenced source records for each item.
9. Build an in-memory generation snapshot.
10. Start one transaction.
11. Create the workpack header with initial status `OPEN`.
12. Transform each template item into one generated work item in ascending `sequence_no`.
13. Create `workpack_tasks` linkage for each generated work item.
14. Create execution records if immediate execution scaffolding is required by the existing execution model.
15. Assemble the final service result.
16. Commit the transaction.
17. Return success result.

Failure path:

1. Stop on first blocking validation or persistence failure.
2. Roll back the full transaction if it has started.
3. Return a failed `WorkpackGenerationResult`.

---

## 7. Transaction Rules

The service must own and enforce transaction safety.

Required rules:

- the full generation flow must run inside one transaction
- the transaction must begin before any workpack persistence
- all generated work items, `workpack_tasks`, and execution rows must be part of the same transaction
- commit only after every generation step succeeds

Strict rule:

- no out-of-transaction creation of related generation rows is allowed

Service ownership rule:

- transaction control belongs in the service layer, not in controllers or UI

---

## 8. Validation Rules

The future service must enforce validation before and during generation.

Required validation:

- `templateId` must exist
- `aircraftId` must exist
- `createdBy` must be present
- aircraft must have valid `model_id`
- template must be active
- template must have valid `model_id`
- `template.model_id` must equal `aircraft.model_id`
- template must contain at least one item
- template item order must be valid and unique by `sequence_no`
- each template item must have valid:
  - `item_type`
  - `item_id`
  - `sequence_no`
  - `is_required`

Allowed source types:

- `STANDARD_TASK`
- `COMPLIANCE_ITEM`
- `SID`

Source resolution rules:

- `STANDARD_TASK` must resolve to `task_templates.id`
- `COMPLIANCE_ITEM` must resolve to `compliance_items.id`
- `SID` must resolve to `supplemental_inspection_documents.id`

Blocking rule:

- any failed validation must prevent generation

---

## 9. Transformation Rules

The service must transform source items consistently by `item_type`.

### STANDARD_TASK

Required behavior:

- load one `task_templates` record
- generate one work item from that source record
- preserve linkage to the source template and source item

### COMPLIANCE_ITEM

Required behavior:

- load one `compliance_items` record
- generate one work item from that source record
- preserve linkage to the compliance source identity

### SID

Required behavior:

- load one `supplemental_inspection_documents` record
- generate one work item from that source record
- preserve linkage to the SID source identity

Shared transformation rules:

- preserve template order
- preserve `is_required`
- do not mutate source library records

---

## 10. Failure and Rollback Rules

The future service must fail safely.

Required failure cases include:

- missing aircraft
- missing template
- inactive template
- model mismatch
- empty template
- invalid sequence ordering
- unsupported `item_type`
- missing source record
- workpack creation failure
- generated task creation failure
- `workpack_tasks` creation failure
- execution creation failure

Required failure behavior:

- stop immediately on blocking failure
- roll back the entire transaction
- return `status = FAILED`
- return error details in `errors`

Strict rule:

- no partial workpack
- no partial tasks
- no partial execution rows

---

## 11. Boundaries

The future service is generation orchestration only.

It must not perform:

- `compliance_items` creation
- compliance projection
- compliance state changes
- certification
- workpack close
- UI logic
- controller logic

Additional boundary rules:

- the service consumes existing compliance-linked items only
- the service must not mark compliance as satisfied, due, or completed
- the service must not advance workpack status beyond `OPEN`
- the service must not decide presentation behavior

---

## 12. Summary

Phase 9.3 defines a future workpack generation service located at:

- `src/modules/workpacks/services/workpack-generation.service.ts`

The service contract centers on:

- `generateWorkpackFromTemplate(params)`

with input params:

- `templateId`
- `aircraftId`
- `createdBy`

and a `WorkpackGenerationResult` containing:

- `workpack_id`
- `aircraft_id`
- `template_id`
- `tasks_created`
- `executions_created`
- `status`
- `errors`

The design requires strict validation, strict model matching, one transaction, full rollback on failure, ordered transformation of `STANDARD_TASK`, `COMPLIANCE_ITEM`, and `SID`, and clear boundaries that exclude compliance creation, projection, certification, workpack closure, and UI/controller logic.

---

**END OF PHASE 9.3 WORKPACK GENERATION SERVICE DESIGN**
