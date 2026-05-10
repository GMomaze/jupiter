# PHASE 9.2 - WORKPACK GENERATION RULES HARDENING

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-02  
**Purpose:** Harden the future Jupiter workpack generation rules so template-driven workpack creation is validated, atomic, traceable, and safe before any implementation phase begins.

---

## 1. Scope

This phase defines stricter design rules for future workpack generation.

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

This document hardens the Phase 9.1 design only.

---

## 2. Purpose

Phase 9.1 defined the basic generation flow from aircraft + template selection into future workpack content.

Phase 9.2 adds stricter control rules for:

- input validation
- model compatibility
- transactional behavior
- source transformation consistency
- ordering and required-flag preservation
- duplicate prevention
- execution record consistency
- failure handling
- logging expectations

The goal is to ensure later implementation is deterministic and all-or-nothing.

---

## 3. Input Validation Rules

Before any generation commit in a later implementation phase, the system must validate all required inputs.

Required validation:

- selected `aircraft.id` must exist
- selected `maintenance_templates.id` must exist
- selected template must be active
- selected aircraft must have a valid resolved `model_id`
- selected template must have a valid `model_id`
- selected template must contain at least one item

Template item validation:

- every `maintenance_template_items` row must contain:
  - `item_type`
  - `item_id`
  - `sequence_no`
  - `is_required`
- `sequence_no` must be present and unique within the template
- `item_type` must be one of:
  - `STANDARD_TASK`
  - `COMPLIANCE_ITEM`
  - `SID`
- every referenced source record must resolve successfully

Blocking rule:

- if any required validation fails, generation must not start

---

## 4. Model Compatibility Rule

Default compatibility is strict.

Required rule:

- `maintenance_templates.model_id` must equal `aircraft.model_id`

Meaning:

- a template belongs to one aircraft model in the default flow
- a workpack may only be generated from a template assigned to the same model as the selected aircraft

Failure behavior:

- if `template.model_id` does not match `aircraft.model_id`, generation must fail before any database write

Future note:

- override-based cross-model generation is outside this phase and must not be assumed by implementation

---

## 5. Transaction Rule

Future workpack generation must run inside one database transaction.

Required rule:

- generation is all-or-nothing

Transactional expectations:

- create workpack header inside the transaction
- create generated task records inside the transaction
- create `workpack_tasks` linkage inside the transaction
- create required execution scaffolding inside the transaction if that option is used

Rollback rule:

- any failure at any step requires full rollback of all generation changes

Partial commit rule:

- partial workpack creation is forbidden

---

## 6. Workpack Creation Constraints

The generated workpack must start in a controlled initial state.

Required rule:

- newly generated workpack status must be `OPEN` only

Not allowed at generation time:

- `IN_PROGRESS`
- `COMPLETED`
- `CERTIFIED`
- any equivalent closed or advanced status

Reason:

- generation creates a new planning and execution container
- execution progression happens later, after generation succeeds

---

## 7. Template Snapshot Rule

Generation must use a stable snapshot of the selected template at generation time.

Required behavior:

- load the template header once
- load the ordered template items once
- use that exact item set for the full generation transaction

Snapshot meaning:

- the generated workpack reflects the template as it existed at the start of generation
- in-flight template edits must not alter the already-running generation payload

Traceability expectation for later implementation:

- generated records should retain enough metadata to identify:
  - source template id
  - source template item id
  - source item type
  - source item id

---

## 8. Transformation Rules

Transformation must be type-specific and consistent.

### STANDARD_TASK

Source:

- `task_templates.id`

Required transformation rule:

- create one generated work item from one standard task source record
- carry forward the source linkage
- copy the task content needed for future execution

Not allowed:

- modifying the source `task_templates` record
- reusing source rows as execution rows directly

### COMPLIANCE_ITEM

Source:

- `compliance_items.id`

Required transformation rule:

- create one generated work item from one compliance source record
- preserve linkage back to the compliance source identity
- treat the source as already-established compliance input, not as a new compliance projection request

Not allowed:

- creating new compliance projection inside this phase
- recalculating AD/SB applicability inside this phase

### SID

Source:

- `supplemental_inspection_documents.id`

Required transformation rule:

- create one generated work item from one SID source record
- preserve linkage back to the SID source identity
- keep SID source semantics separate from compliance projection semantics

Not allowed:

- converting SIDs into new compliance records during generation in this phase design

---

## 9. Required Flag Preservation

Template item requirement state must be preserved exactly.

Required rule:

- generated work items must inherit `maintenance_template_items.is_required` without reinterpretation

Meaning:

- required template items remain required in the generated workpack
- optional template items remain optional in the generated workpack

Not allowed:

- silently promoting optional items to required
- silently downgrading required items to optional

---

## 10. Ordering Preservation

Generated workpack content must preserve template order exactly.

Required rules:

- process items in ascending `sequence_no`
- generated display order must match ascending `sequence_no`
- mixed source types must remain in one unified ordered list

Not allowed:

- regrouping by source type
- database-default ordering
- unstable ordering based on lookup timing

Failure rule:

- duplicate or invalid sequence values must block generation

---

## 11. Duplicate Handling

Generation must avoid duplicate output within one workpack run.

Template-level expectation:

- input template design should already prevent duplicate `template_id + item_type + item_id` rows

Generation-level rule:

- one template item produces one generated work item by default
- one generated work item produces one `workpack_tasks` linkage by default

Blocking duplicate cases:

- duplicate template item rows with the same semantic source inside one generation snapshot
- duplicate `sequence_no` values
- repeated attachment of the same generated task to the same workpack

Boundary note:

- cross-workpack deduplication is outside this phase

---

## 12. Execution Record Creation Rules

Execution scaffolding must be consistent with the current execution model.

Required design rule:

- if the system requires immediate execution scaffolding, create one execution record per generated work item

Record creation rules:

- execution rows must be created only after the generated work item exists
- execution rows must remain linked to the generated work item and generated workpack
- execution rows must be created within the same transaction as the workpack generation

Not allowed:

- orphan execution rows
- execution rows without a matching generated work item
- delayed partial execution-row creation after generation failure

Open implementation note:

- a later implementation phase must confirm whether execution scaffolding is immediate or deferred
- whichever option is chosen, the rule must remain internally consistent and transactional

---

## 13. Strict Error Handling

Generation must fail safely and completely.

Required blocking errors:

- aircraft not found
- aircraft missing `model_id`
- template not found
- template inactive
- template missing `model_id`
- template model mismatch
- template has no items
- unsupported `item_type`
- missing source record
- duplicate `sequence_no`
- duplicate semantic item input
- generated task creation failure
- `workpack_tasks` creation failure
- execution record creation failure

Required failure behavior:

- stop immediately
- return a clear blocking error
- roll back the full transaction
- leave no partial workpack data behind

Strict rule:

- no partial workpack
- no partial tasks
- no partial execution rows

---

## 14. Logging Requirement

Later implementation must include generation logging for traceability.

Minimum design expectation:

- log generation start
- log selected aircraft id
- log selected template id
- log item count in the template snapshot
- log success or failure outcome
- log blocking failure reason

Boundary:

- this phase defines the logging requirement only
- it does not define a specific table, logger, event bus, or UI

---

## 15. Compliance Boundary

Workpack generation may consume compliance-linked template items, but it must not become a compliance engine.

Required boundary:

- generation may transform `COMPLIANCE_ITEM` references into generated work items
- generation must not create new compliance projections
- generation must not recalculate applicability
- generation must not close, satisfy, or mutate compliance state as part of this phase design

Meaning:

- compliance source truth remains outside workpack generation
- workpack generation is a consumer of prepared source items, not the creator of compliance logic

---

## 16. Summary

Phase 9.2 hardens the future workpack generation design by requiring:

- strict input validation
- exact `template.model_id` to `aircraft.model_id` matching
- one full transaction with rollback on any failure
- generated workpacks to start in `OPEN`
- stable template snapshot usage
- controlled type-specific transformation for `STANDARD_TASK`, `COMPLIANCE_ITEM`, and `SID`
- exact preservation of `is_required`
- exact preservation of `sequence_no` ordering
- duplicate blocking and duplicate-safe output rules
- execution-row consistency
- strict no-partial-creation behavior
- logging requirements for traceability
- a firm compliance boundary

---

**END OF PHASE 9.2 WORKPACK GENERATION RULES HARDENING**
