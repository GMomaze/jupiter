# PHASE 7.2 - Applicability Engine Interface

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-01  
**Purpose:** Define the read-only interface contract for the Jupiter applicability engine that resolves AD, SB, and SID applicability for a single aircraft.

---

## 1. Scope

This document defines the applicability engine interface only.

It does not implement:

- service code
- schema changes
- migrations
- models
- controllers
- routes
- UI
- workpack logic
- task logic

This is an interface contract for later implementation.

---

## 2. Primary Interface

The applicability engine must expose:

- `getApplicabilityForAircraft(aircraftId)`

Purpose:

- return a unified, read-only applicability result for one aircraft
- combine projected AD/SB applicability with SID applicability
- deduplicate by source identity

Input:

- `aircraftId`

Expected behavior:

- load the aircraft
- resolve the aircraft’s model
- gather applicable AD/SB projected compliance items
- gather applicable SIDs
- normalize them into one result set

---

## 3. Top-Level Result Shape

The interface result must return:

- `aircraft_id`
- `model_id`
- `items`

### Result meaning

- `aircraft_id`
  - the resolved aircraft identity used for the query

- `model_id`
  - the aircraft’s resolved model identity

- `items`
  - the unified applicability result list for that aircraft

---

## 4. Item Shape

Each applicability item must expose:

- `source_type`
- `source_id`
- `reference`
- `title`
- `description`
- `interval_hours`
- `interval_months`
- `applicability_reason`
- `source_table`
- `is_projected_compliance`

### Field meaning

- `source_type`
  - source category, such as `AD`, `SB`, or `SID`

- `source_id`
  - source master-record identifier

- `reference`
  - source reference or projected compliance reference

- `title`
  - human-readable title

- `description`
  - summary or narrative text where available

- `interval_hours`
  - hour interval where available

- `interval_months`
  - calendar interval where available

- `applicability_reason`
  - plain-language explanation of why the item applies
  - example:
    - `Aircraft model matches assigned compliance model`
    - `Aircraft model matches SID applicability`

- `source_table`
  - authoritative source table name

- `is_projected_compliance`
  - boolean
  - `true` for AD/SB compliance items returned through `compliance_items`
  - `false` for direct SID source records returned from SID master data

---

## 5. AD and SB Source Rules

AD and SB applicability must resolve through:

- `compliance_items`
- `compliance_assignments`

### Resolution path

1. Find active model-level assignments in `compliance_assignments`.
2. Filter assignments where:
   - `assignment_type = 'MODEL'`
   - `model_id = aircraft.model_id`
3. Join to `compliance_items` via `compliance_item_id`.
4. Return one applicability item per unique source.

### AD/SB item rules

For AD/SB rows:

- `source_type` comes from projected compliance source type
- `source_id` comes from projected compliance source linkage
- `reference` comes from projected compliance reference/code
- `title` comes from projected compliance title
- `description` comes from projected compliance description
- `interval_hours` and `interval_months` are included only if the projected compliance layer exposes them
- `source_table = 'compliance_items'`
- `is_projected_compliance = true`

---

## 6. SID Source Rules

SID applicability must resolve through:

- `supplemental_inspection_documents`
- `sid_model_applicability`

### Resolution path

1. Find active SID applicability rows in `sid_model_applicability`.
2. Filter rows where:
   - `model_id = aircraft.model_id`
3. Join to `supplemental_inspection_documents` via `sid_id`.
4. Return one applicability item per unique SID source.

### SID item rules

For SID rows:

- `source_type = 'SID'`
- `source_id = supplemental_inspection_documents.id`
- `reference = supplemental_inspection_documents.reference`
- `title = supplemental_inspection_documents.title`
- `description = supplemental_inspection_documents.description`
- `interval_hours` should come from the most relevant SID interval field available
- `interval_months` should come from the most relevant SID interval field available
- `source_table = 'supplemental_inspection_documents'`
- `is_projected_compliance = false`

---

## 7. Deduplication Rule

Applicability results must be deduplicated by:

- `source_type`
- `source_id`

### Why

This prevents:

- repeated AD/SB rows due to repeated assignment joins
- repeated SID rows due to repeated applicability joins
- multiple visible entries for the same source on the same aircraft result

### Deduplication outcome

If multiple upstream rows resolve to the same:

- `source_type`
- `source_id`

then the result must emit only one final applicability item for that source.

---

## 8. Applicability Reason Rules

Every returned item should carry an `applicability_reason`.

Approved reason patterns:

- `Model-level compliance assignment matched aircraft model`
- `SID model applicability matched aircraft model`
- future aircraft override/addition text may be added later

Purpose:

- make the engine output explainable
- support later UI or audit display
- reduce ambiguity when multiple source systems are combined

---

## 9. Read-Only Boundary

The applicability engine interface is strictly read-only.

It must not:

- insert rows
- update rows
- delete rows
- create `compliance_items`
- create `compliance_assignments`
- create `sid_model_applicability`
- extend `source_type`
- create tasks
- create workpacks

The engine resolves applicability only.

---

## 10. Failure Handling

If the aircraft does not exist:

- the interface should return a not-found failure at implementation time

If the aircraft has no `model_id`:

- the interface should return:
  - `aircraft_id`
  - `model_id = null`
  - `items = []`
  - plus an implementation-level error or warning message if desired

If AD/SB assignments are not yet live:

- the interface contract still stands
- SID resolution may continue independently
- AD/SB resolution remains pending until `compliance_assignments` exists in the live schema

---

## 11. Final Interface Summary

The applicability engine must expose:

- `getApplicabilityForAircraft(aircraftId)`

It returns:

- `aircraft_id`
- `model_id`
- `items`

Each item is a normalized read-only applicability record that identifies:

- what source applies
- why it applies
- whether it came from projected compliance or direct SID master data

ADs and SBs resolve through:

- `compliance_items`
- `compliance_assignments`

SIDs resolve through:

- `supplemental_inspection_documents`
- `sid_model_applicability`

All results are deduplicated by:

- `source_type`
- `source_id`

---

**END OF PHASE 7.2 INTERFACE DOCUMENT**
