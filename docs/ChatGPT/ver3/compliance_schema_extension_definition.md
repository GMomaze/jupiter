# Compliance Schema Extension Definition

**Status:** Final Definition  
**Date:** 2026-05-01  
**Purpose:** Define the approved compliance schema extension required before AD/SB source-to-`compliance_items` linking implementation can proceed.

---

## 1. Dependency

This definition proceeds only because Phase 6.2 explicitly concluded:

## **BLOCK LINKING — COMPLIANCE SCHEMA EXTENSION REQUIRED**

This document is the authoritative definition for the required compliance-linking extension shape.

---

## 2. Scope

This definition applies to:

- `compliance_items`

Source systems referenced by this definition:

- `airworthiness_directives`
- `service_bulletins`

This is a definition phase only.

Not included in this phase:

- schema changes
- migrations
- model edits
- controller/service edits
- UI changes
- linking implementation

---

## 3. Extension Decision

The required extension is to define source-record linkage on `compliance_items` using:

- `source_type`
- `source_id`

Purpose:

- identify the originating source domain
- identify the originating source row
- support AD and SB projection into operational compliance tracking

---

## 4. Required Fields

### `compliance_items.source_type`

Required characteristics:

- string/text field
- NOT NULL
- allowed values:
  - `AD`
  - `SB`

Purpose:

- identify whether the compliance row originated from:
  - `airworthiness_directives`
  - `service_bulletins`

### `compliance_items.source_id`

Required characteristics:

- UUID field
- NOT NULL

Purpose:

- identify the exact source row that produced the compliance item

---

## 5. Source Link Rules

### AD rule

If:

- `source_type = 'AD'`

Then:

- `source_id` references `airworthiness_directives.id`

### SB rule

If:

- `source_type = 'SB'`

Then:

- `source_id` references `service_bulletins.id`

### Polymorphic linkage rule

This definition uses a polymorphic source link.

Therefore:

- `source_type` determines the source table
- `source_id` identifies the row within that source table
- no direct database foreign key association is required in this definition phase

Important note:

- this definition intentionally avoids direct FK enforcement because one field pair must support multiple source tables
- stronger DB-level enforcement may be considered in a later dedicated schema design phase

---

## 6. Constraints

Required constraints:

- `source_type` NOT NULL
- `source_id` NOT NULL
- `source_type` check constraint limited to:
  - `AD`
  - `SB`

Required duplicate-prevention constraint:

- unique constraint on:
  - `source_type`
  - `source_id`

Interpretation:

- one source record should project to one operational compliance item under this extension definition
- duplicate `compliance_items` rows for the same AD or SB source row are not allowed

Applicability/context note:

- if aircraft/model applicability context is later added directly to `compliance_items`, uniqueness may need later revision
- in that future case, applicability context may need to participate in duplicate-prevention rules
- that is not part of this definition phase

---

## 7. Indexes

Required indexes:

- `source_type`
- `source_id`
- combined `source_type + source_id`

Purpose:

- support source-type filtering
- support source-row lookup
- support efficient polymorphic source resolution

---

## 8. Model Alignment

A future `ComplianceItem` model must include:

- `source_type`
- `source_id`

Model-alignment intent:

- the runtime model must expose both fields directly
- linking logic must read and write through these fields

This document does not create or edit that model in this phase.

---

## 9. Separation Rules

- ADs remain in `airworthiness_directives`
- SBs remain in `service_bulletins`
- `compliance_items` tracks operational compliance
- no workpack generation is defined here
- no `workpack_compliance` changes are defined here

Interpretation:

- source tables remain the source-of-truth master records
- `compliance_items` remains the normalized operational compliance layer
- workpack planning and execution stay downstream

---

## 10. Applicability Context Note

Current Phase 6.2 findings showed that explicit applicability/context support is still insufficient.

This definition does **not** introduce:

- aircraft context fields
- model context fields
- make/model/product fields

Required future note:

- if aircraft/model applicability context is later added to `compliance_items`, it should be evaluated for:
  - duplicate-prevention rules
  - indexing
  - source-linking resolution

That is a later extension topic and not part of this definition.

---

## 11. Relationship Summary

Approved source-link shape:

- `compliance_items.source_type = 'AD'`
- `compliance_items.source_id = airworthiness_directives.id`

or

- `compliance_items.source_type = 'SB'`
- `compliance_items.source_id = service_bulletins.id`

This is the approved compliance-linking identity rule for later implementation work.

---

## 12. Implementation Boundary

This document defines the required extension only.

Not included:

- migrations
- live schema changes
- model creation or edits
- controller/service changes
- source-linking implementation
- workpack logic changes

---

**END OF DEFINITION DOCUMENT**
