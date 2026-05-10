# PHASE 7A.1 - Compliance Assignment Design (Aircraft / Model)

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-01  
**Purpose:** Define how projected compliance items should be assigned at model and aircraft level in Jupiter, using AD/SB applicability data and existing aircraft/model relationships, without implementing schema or assignment logic in this phase.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/ad_schema_definition.md`
- `docs/ChatGPT/ver3/sb_schema_definition.md`
- `docs/ChatGPT/ver3/compliance_schema_extension_definition.md`
- `docs/ChatGPT/ver3/phase-6.5-ad-sb-compliance-projection-design.md`
- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `src/models/core/Aircraft.ts`
- `src/models/ComponentModel.ts`
- `src/models/ComplianceItem.ts`

---

## 2. Assignment Types

The approved assignment types are:

- model-level assignment
- aircraft-level assignment

### Model-level assignment

Meaning:

- a compliance item is assigned to one or more applicable `component_models`

Purpose:

- represent general applicability for aircraft that share the same model context
- create a reusable compliance assignment layer before aircraft-specific state is derived

### Aircraft-level assignment

Meaning:

- a compliance item is assigned directly to a specific aircraft

Purpose:

- support exceptions
- support overrides
- support aircraft-specific additions that should not be inferred purely from model applicability

---

## 3. Default Strategy

## **Default: model-level assignment as primary**

Approved default strategy:

- model-level assignment is primary
- aircraft-level assignment is used only for overrides or exceptions

Why this is preferred:

- the current system already anchors aircraft to `component_models` through `aircraft.model_id`
- SB applicability already has a model-bridge pattern through `service_bulletin_models`
- model-level assignment scales better than duplicating assignments immediately per aircraft
- aircraft-specific state belongs downstream in aircraft compliance workflows

---

## 4. Applicability Source

### AD applicability source

AD applicability comes from inline AD source fields:

- `make`
- `model`
- `product_type`
- `product_subtype`

These are stored on:

- `airworthiness_directives`

### SB applicability source

SB applicability comes from inline SB source fields:

- `applicability_make`
- `applicability_model`
- `applicability_product_type`
- `applicability_notes`

These are stored on:

- `service_bulletins`

### Applicability interpretation rule

Assignment must be derived from source-side applicability truth.

Current implication:

- `compliance_items` is the projected operational compliance record
- source applicability remains on AD/SB source rows
- assignment logic later resolves source applicability to internal model and aircraft records

---

## 5. Assignment Flow

Approved assignment flow:

1. AD or SB source records are projected into `compliance_items`
2. applicable models are determined from source applicability
3. assignment is created at model level
4. aircraft inherit compliance through model
5. aircraft-specific overrides may be added later

### Flow explanation

Projection first:

- AD/SB source data becomes normalized operational compliance records in `compliance_items`

Applicability resolution second:

- AD inline applicability or SB applicability fields are interpreted against internal `component_models`

Assignment third:

- the compliance item is attached to relevant models

Aircraft inheritance fourth:

- aircraft linked to those models inherit the compliance obligation conceptually

Override layer later:

- aircraft-specific exceptions or extra assignments are handled in a later aircraft-specific phase

---

## 6. Data Relationship Options

This phase documents relationship options only.

It does **not** finalize schema.

### Separate assignment table concept

Concept:

- create a dedicated compliance assignment table later

Possible intent:

- store assignment rows between `compliance_items` and `component_models`
- optionally store assignment rows between `compliance_items` and `aircraft`

Why this is attractive:

- avoids overloading `compliance_items`
- supports explicit duplicate constraints
- keeps assignment distinct from source projection and aircraft state tracking

### `compliance_items <-> component_models`

Concept:

- model-level assignment junction between projected compliance items and internal models

Recommended role:

- primary assignment layer

### `compliance_items <-> aircraft`

Concept:

- aircraft-level assignment junction between projected compliance items and aircraft records

Recommended role:

- exception or override layer only

### Current phase rule

- do not implement or finalize schema here

---

## 7. Duplicate Rules

Required duplicate rules:

- no duplicate assignment for same `compliance_item + model`
- no duplicate assignment for same `compliance_item + aircraft`

Interpretation:

- a given compliance item should not be assigned twice to the same model
- a given compliance item should not be assigned twice to the same aircraft

Future schema implication:

- assignment uniqueness should be enforced on the eventual assignment tables or assignment junction structures

This phase does not implement those constraints.

---

## 8. Inheritance Rule

Approved inheritance rule:

- aircraft inherit model-level compliance
- aircraft-specific assignment can override or extend later

### Model inheritance meaning

If:

- a compliance item is assigned to a model

Then:

- aircraft using that model inherit the compliance obligation by default

### Aircraft-specific override meaning

Later aircraft-specific assignment may:

- suppress inherited applicability where justified
- add aircraft-only applicability where justified
- extend tracking for aircraft-specific operational conditions

This override layer is not implemented in this phase.

---

## 9. Workpack Boundary

This assignment phase explicitly does **not** include:

- workpack creation
- task creation
- workpack linking
- task generation

Approved boundary:

- assignment prepares data for future workpack generation only

Interpretation:

- assignment identifies where compliance applies
- later planning phases decide how that applicability becomes executable work

---

## 10. Actual-System Conclusion

### What exists now

- AD applicability exists inline on `airworthiness_directives`
- SB applicability exists inline on `service_bulletins`
- `compliance_items` exists as the operational projection layer
- aircraft already belong to `component_models` through `aircraft.model_id`

### What the assignment layer should do

- resolve source applicability to internal models first
- treat model-level assignment as the primary compliance assignment layer
- allow aircraft to inherit those assignments
- reserve aircraft-level assignment for later exceptions or overrides

### Final assignment design summary

- assignment types:
  - model-level
  - aircraft-level
- default strategy:
  - model-level first
  - aircraft-level only for overrides/exceptions
- applicability sources:
  - AD inline applicability fields
  - SB inline applicability fields
- relationship options:
  - separate assignment table concept
  - `compliance_items <-> component_models`
  - `compliance_items <-> aircraft`
- duplicate rules:
  - one compliance item per model assignment
  - one compliance item per aircraft assignment
- inheritance:
  - aircraft inherit model-level compliance
- boundary:
  - no tasks
  - no workpacks
  - assignment only prepares downstream planning data

---

## 11. Boundaries

This phase was read-only and did not perform implementation work.

- No schema changes
- No migrations
- No model edits
- No controller/service edits
- No UI changes
- No assignment implementation
- No workpack/task generation

---

**END OF ASSIGNMENT DESIGN DOCUMENT**
