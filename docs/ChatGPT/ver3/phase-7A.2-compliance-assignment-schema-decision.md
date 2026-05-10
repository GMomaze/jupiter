# PHASE 7A.2 - Compliance Assignment Schema Decision

**Status:** Completed (READ-ONLY Decision Phase)  
**Date:** 2026-05-01  
**Purpose:** Decide how Jupiter should store compliance assignment targeting for models and aircraft after AD/SB source records have been projected into `compliance_items`.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/phase-7.1-compliance-assignment-design.md`
- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `compliance_items`
- `aircraft`
- `component_models`
- existing related tables:
  - `aircraft_compliance`
  - `aircraft_sb_compliance`
  - `service_bulletin_models`
  - `workpack_compliance`

---

## 2. Existing Support Assessment

### Does current schema support assignment to models?

**No.**

The current schema contains:

- `component_models`
- `service_bulletin_models`

But it does not contain a generic assignment structure that links:

- `compliance_items -> component_models`

`service_bulletin_models` is SB-source-specific applicability, not generic projected compliance assignment.

### Does current schema support assignment to aircraft?

**Partially, but not in the required sense.**

The current schema contains:

- `aircraft_compliance`

However:

- `aircraft_compliance` is aircraft compliance status/state tracking
- it is not a generic assignment layer
- it assumes aircraft-specific state such as due/compliant timing and status
- it is not suitable as the first assignment structure for model inheritance design

### Is a new assignment table required?

**Yes.**

The current schema does not provide a neutral assignment layer between:

- projected operational compliance items
- applicable models
- aircraft-specific overrides

### Should assignment use one table or separate tables?

**One table.**

The single-table approach is preferred because:

- model and aircraft assignment represent the same business concept
- `assignment_type` cleanly distinguishes target scope
- duplicate rules can be centralized
- future query logic can reason over one consistent assignment layer
- separate tables would duplicate structure and increase drift risk early

---

## 3. Decision

## **CREATE SINGLE COMPLIANCE_ASSIGNMENTS TABLE**

This is the approved decision for the assignment layer.

Rationale:

- existing schema does not safely support generic model assignment
- existing schema does not safely support aircraft override assignment without overloading aircraft state tables
- one table is sufficient to hold both model-level and aircraft-level assignment intent
- inheritance remains conceptual and query-driven rather than physically duplicating aircraft records at this stage

---

## 4. Required Table Shape

If implemented later, the single assignment table must include:

- `id`
- `compliance_item_id`
- `assignment_type`
  - `MODEL`
  - `AIRCRAFT`
- `model_id`
- `aircraft_id`
- `assignment_source`
  - `AUTO`
  - `MANUAL`
- `is_active`
- `created_at`
- `updated_at`

---

## 5. Field Meaning

### Identity

- `id`
  - unique assignment row identifier

### Compliance Target

- `compliance_item_id`
  - the projected compliance item being assigned

### Assignment Scope

- `assignment_type`
  - distinguishes whether the assignment targets:
    - a model
    - an aircraft

### Model Target

- `model_id`
  - required for model-level assignment rows
  - points to `component_models.id`

### Aircraft Target

- `aircraft_id`
  - required for aircraft-level assignment rows
  - points to `aircraft.id`

### Assignment Origin

- `assignment_source`
  - indicates how the assignment was created
  - allowed values:
    - `AUTO`
    - `MANUAL`

### Record State

- `is_active`
  - allows assignment deactivation without destructive deletion

- `created_at`
- `updated_at`
  - audit timestamps

---

## 6. Assignment-Type Rules

### MODEL assignment rule

If:

- `assignment_type = 'MODEL'`

Then:

- `model_id` is required
- `aircraft_id` must be null

Interpretation:

- this row represents a model-level inherited applicability anchor

### AIRCRAFT assignment rule

If:

- `assignment_type = 'AIRCRAFT'`

Then:

- `aircraft_id` is required
- `model_id` may remain null

Interpretation:

- this row represents a direct aircraft-level override or addition

Note:

- no requirement is imposed here to also store `model_id` on aircraft rows
- the aircraft already links to a model through `aircraft.model_id`

---

## 7. Duplicate-Prevention Rules

Required duplicate-prevention rules:

- no duplicate active assignment for same compliance item and target

Required uniqueness targets:

- `compliance_item_id + model_id`
- `compliance_item_id + aircraft_id`

Interpretation:

- one compliance item may be assigned once to a given model
- one compliance item may be assigned once to a given aircraft

Recommended conditional interpretation:

- model uniqueness applies to `MODEL` rows
- aircraft uniqueness applies to `AIRCRAFT` rows

Why this matters:

- prevents repeated automatic assignment runs from multiplying assignment rows
- preserves a stable inheritance layer

---

## 8. Inheritance Rule

Approved inheritance rule:

- aircraft inherit compliance through their model
- aircraft-level assignments are explicit overrides or additions
- inherited records are not physically duplicated per aircraft at this stage

### Model inheritance meaning

If:

- a `MODEL` assignment exists for `compliance_item_id + model_id`

Then:

- aircraft whose `aircraft.model_id = model_id` inherit that applicability conceptually

### Aircraft override meaning

If:

- an `AIRCRAFT` assignment exists

Then:

- it represents a direct aircraft-level exception, addition, or special-case applicability

### Important limitation

This phase does not require:

- materializing inherited aircraft rows into a second assignment table
- duplicating model assignments per aircraft

Inheritance remains query-driven or logic-driven in later implementation phases.

---

## 9. Why Existing Tables Are Not Enough

### Why not use `compliance_items` directly?

Because `compliance_items` represents:

- projected operational compliance identity

It does not represent:

- assignment target scope
- one-to-many applicability to models
- aircraft-specific override rows

### Why not use `aircraft_compliance`?

Because `aircraft_compliance` represents:

- per-aircraft state tracking

It is too downstream for first-stage assignment because it includes:

- compliance status
- due dates
- compliance method
- workpack linkage

That is not the same thing as a neutral assignment layer.

### Why not use `service_bulletin_models`?

Because it is:

- SB-source-specific
- not generic for AD and SB together
- not tied to projected `compliance_items`

---

## 10. Actual-System Conclusion

### What exists today

- `compliance_items` as projected operational compliance rows
- `component_models` as the central model catalog
- `aircraft` as the aircraft master table
- `aircraft_compliance` as aircraft state tracking
- `service_bulletin_models` as an SB-specific applicability bridge

### What does not exist today

- a generic compliance assignment layer for:
  - `compliance_items -> component_models`
  - `compliance_items -> aircraft`

### Final decision

## **CREATE SINGLE COMPLIANCE_ASSIGNMENTS TABLE**

Use one assignment table with explicit target typing so model-level inheritance and aircraft-level overrides can coexist without overloading source projection tables or aircraft state tables.

---

## 11. Boundaries

This phase was read-only and did not perform implementation work.

- No schema changes
- No migrations
- No model edits
- No controller/service edits
- No UI changes
- No assignment implementation
- No workpack/task logic

---

**END OF DECISION DOCUMENT**
