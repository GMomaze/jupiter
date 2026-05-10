# PHASE 7.1 - Aircraft Applicability Resolution

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-01  
**Purpose:** Define how Jupiter should resolve aircraft applicability from model-based compliance assignments and SID model applicability without storing precomputed aircraft-level applicability rows.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/compliance_assignment_schema_definition.md`
- `docs/ChatGPT/ver3/sid_schema_definition.md`
- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `compliance_items`
- planned `compliance_assignments` structure
- `sid_model_applicability`
- `aircraft`
- `component_models`

---

## 2. Core Resolution Principle

Aircraft applicability is **derived, not stored**.

That means:

- model-level applicability is the primary source
- aircraft applicability is computed at query time
- no per-aircraft duplication of inherited model applicability is required in this phase

This applies to:

- AD applicability after projection into `compliance_items`
- SB applicability after projection into `compliance_items`
- SID applicability through `sid_model_applicability`

---

## 3. Resolution Types

### Model-level applicability

This is the primary applicability layer.

Sources:

- AD/SB applicability through `compliance_assignments`
- SID applicability through `sid_model_applicability`

### Aircraft-level applicability

This is a derived result.

Rule:

- if `aircraft.model_id = applicable model_id`
- then the aircraft inherits that model-level applicability

Aircraft-level applicability is not stored separately in this phase.

---

## 4. Source Structures

### AD and SB applicability

ADs and SBs are expected to resolve through projected compliance rows:

- source records project into `compliance_items`
- applicability targeting is represented by `compliance_assignments`

Relevant assignment target:

- `assignment_type = 'MODEL'`
- `model_id` identifies the applicable internal model

Aircraft-level assignments are a future override mechanism only.

### SID applicability

SIDs resolve through:

- `sid_model_applicability`

Relevant fields:

- `sid_id`
- `model_id`

This is already a model-based applicability bridge.

---

## 5. Aircraft Match Rule

The base aircraft applicability match rule is:

- get aircraft
- read `aircraft.model_id`
- compare that `model_id` to model-based applicability rows

Matching rules:

- AD/SB applicability matches where `compliance_assignments.model_id = aircraft.model_id`
- SID applicability matches where `sid_model_applicability.model_id = aircraft.model_id`

This phase does not add component-installed matching or subtype-specific resolution beyond the aircraft’s direct model.

---

## 6. Resolution Flow

Recommended aircraft applicability resolution flow:

1. Get aircraft by ID.
2. Read `aircraft.model_id`.
3. Find projected AD/SB compliance assigned to that model through `compliance_assignments`.
4. Find SID applicability rows for that model through `sid_model_applicability`.
5. Join back to source/master records where needed.
6. Combine results into one applicability result set.
7. Remove duplicates by aircraft and source identity.

---

## 7. AD and SB Resolution Path

For ADs and SBs:

1. Start from `compliance_assignments`.
2. Filter to:
   - `assignment_type = 'MODEL'`
   - `model_id = aircraft.model_id`
   - active assignments only
3. Join to `compliance_items` through `compliance_item_id`.
4. Read source identity from the projected compliance row:
   - `source_type`
   - `source_id`
5. Return the projected compliance record as aircraft-applicable.

This means AD/SB aircraft applicability is mediated through the operational compliance projection layer.

---

## 8. SID Resolution Path

For SIDs:

1. Start from `sid_model_applicability`.
2. Filter to:
   - `model_id = aircraft.model_id`
   - active applicability rows only
3. Join to `supplemental_inspection_documents` through `sid_id`.
4. Return the SID source record as aircraft-applicable.

This means SID aircraft applicability is derived directly from SID model linkage, not through `compliance_items` in this phase.

---

## 9. Result Set Shape

The unified aircraft applicability result should expose at minimum:

- `source_type`
- `source_id`
- `reference`
- `title`
- `compliance_item_id` where applicable
- `sid_id` where applicable
- interval data where available

### AD/SB result interpretation

For AD/SB rows:

- `source_type` = projected source type from `compliance_items`
- `source_id` = source master ID from `compliance_items`
- `reference` = projected compliance reference/code
- `title` = projected compliance title
- `compliance_item_id` = required
- `sid_id` = null
- interval data = included only if available in the projected compliance layer

### SID result interpretation

For SID rows:

- `source_type` = `SID`
- `source_id` = `supplemental_inspection_documents.id`
- `reference` = SID reference
- `title` = SID title
- `compliance_item_id` = null in this phase
- `sid_id` = SID source ID
- interval data = from SID interval fields where available

---

## 10. Duplicate Handling

Resolution must not return duplicate entries for the same aircraft and source.

Required rule:

- no duplicate entries per aircraft per source

Recommended duplicate key:

- `source_type + source_id`

For projected AD/SB rows, the projected compliance identity should not multiply the same source row for the same aircraft when the model assignment is singular.

For SID rows, the same SID must not appear twice for the same aircraft even if upstream joins are repeated.

---

## 11. Future Override Rules

Aircraft-specific overrides are conceptually supported later, but not stored as derived applicability now.

Future rule direction:

- aircraft-specific assignment may add applicability beyond inherited model applicability
- aircraft-specific assignment may suppress inherited applicability later if the override design explicitly allows it

This phase only defines the concept.

It does not require:

- stored aircraft applicability rows
- override persistence logic
- suppression logic implementation

---

## 12. Performance Notes

Applicability resolution should be query-based, not precomputed.

Why:

- model inheritance is straightforward to resolve on demand
- applicability changes should become visible without batch recomputation
- it avoids materializing duplicated per-aircraft records too early

Recommended index usage:

- `aircraft.model_id`
- `compliance_assignments.model_id`
- `compliance_assignments.compliance_item_id`
- `sid_model_applicability.model_id`
- source identity indexes on projected/source tables where available

Important note:

- `compliance_assignments` is currently defined in documentation as the target assignment structure
- if not yet live in the schema, aircraft applicability resolution remains a design contract until that table is implemented

---

## 13. Workpack Boundary

This phase does not create:

- tasks
- workpacks
- workpack links

Aircraft applicability resolution prepares data for future workpack generation only.

It is an applicability read/derive step, not an execution step.

---

## 14. Final Resolution Summary

Aircraft applicability should be resolved from model-level targeting.

Approved approach:

- AD/SB applicability comes from model-based `compliance_assignments`
- SID applicability comes from `sid_model_applicability`
- aircraft applicability is derived by matching `aircraft.model_id`
- unified results are returned query-time without storing duplicate aircraft rows

This preserves a clean separation between:

- source/master data
- projected compliance data
- assignment targeting
- future execution/workpack generation

---

**END OF PHASE 7.1 DESIGN DOCUMENT**
