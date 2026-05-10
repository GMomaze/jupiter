# SID Schema Definition

**Status:** Final Definition  
**Date:** 2026-05-01  
**Purpose:** Define the authoritative Jupiter SID source schema for Supplemental Inspection Documents and their model applicability.

---

## 1. Scope

This document defines the final SID source-layer schema only.

Covered tables:

- `supplemental_inspection_documents`
- `sid_model_applicability`

This document does not implement:

- migrations
- models
- import logic
- compliance projection
- aircraft-level assignment
- workpack/task generation

---

## 2. Core Design Decision

SIDs are source/library compliance records.

They are:

- not tasks
- not workpacks
- not execution rows
- model-based compliance source data

SIDs must be stored in a dedicated SID source table and linked to internal aircraft/component models through a separate applicability table.

---

## 3. Table Definition

### 3.1 `supplemental_inspection_documents`

Purpose:

- store SID master/source records
- preserve manufacturer SID identity
- preserve interval and category metadata
- support later compliance projection

Required fields:

- `id`
- `manufacturer`
- `reference`
- `title`
- `description`
- `category`
- `section_reference`
- `ata_chapter`
- `initial_interval_hours`
- `initial_interval_months`
- `repeat_interval_hours`
- `repeat_interval_months`
- `inspection_operation`
- `notes`
- `source_document`
- `is_active`
- `created_at`
- `updated_at`

Field intent:

- `manufacturer`: SID source manufacturer, such as Cessna
- `reference`: SID identifier / SID number
- `title`: human-readable SID title
- `description`: narrative summary if available
- `category`: structural grouping or program category
- `section_reference`: source section/program reference
- `ata_chapter`: ATA/system grouping if provided
- `initial_interval_hours`: first due interval in hours
- `initial_interval_months`: first due interval in calendar months
- `repeat_interval_hours`: recurring interval in hours
- `repeat_interval_months`: recurring interval in calendar months
- `inspection_operation`: inspection action/operation text
- `notes`: free-text source notes
- `source_document`: source file or document reference
- `is_active`: active/inactive flag

### 3.2 `sid_model_applicability`

Purpose:

- normalize SID-to-model applicability
- support one SID applying to many models
- support one model having many SIDs

Required fields:

- `id`
- `sid_id`
- `model_id`
- `is_active`
- `created_at`
- `updated_at`

---

## 4. Relationships

### SID master to applicability

- `sid_model_applicability.sid_id` references `supplemental_inspection_documents.id`
- one `supplemental_inspection_documents` record may have many `sid_model_applicability` rows

### SID applicability to component models

- `sid_model_applicability.model_id` references `component_models.id`
- one `component_models` row may be linked to many SID applicability rows

### Logical relationship summary

- `supplemental_inspection_documents` -> many `sid_model_applicability`
- `component_models` -> many `sid_model_applicability`

This gives a normalized many-to-many SID applicability structure through the applicability bridge table.

---

## 5. Constraints

### `supplemental_inspection_documents`

Required constraints:

- `manufacturer` NOT NULL
- `reference` NOT NULL
- `title` NOT NULL
- unique constraint on:
  - `manufacturer`
  - `reference`

Recommended data rules:

- interval fields may be nullable when the source does not provide them
- `is_active` should default to `true`

### `sid_model_applicability`

Required constraints:

- `sid_id` NOT NULL
- `model_id` NOT NULL
- unique constraint on:
  - `sid_id`
  - `model_id`

Recommended data rules:

- `is_active` should default to `true`

---

## 6. Indexes

### `supplemental_inspection_documents`

Required indexes:

- `manufacturer`
- `reference`
- `category`
- `is_active`

Optional future indexes if needed:

- `section_reference`
- `ata_chapter`

### `sid_model_applicability`

Required indexes:

- `sid_id`
- `model_id`

---

## 7. Separation Rules

SIDs are not stored in:

- `task_templates`
- `task_cards`
- `workpacks`

SIDs remain source/library compliance data.

Tasks and workpacks may later be derived from SID-driven compliance needs, but the SID itself is not a task or workpack row.

---

## 8. Applicability Rules

Applicability is model-based at this stage.

Rules:

- one SID may apply to multiple internal component models
- one internal component model may have multiple SIDs
- applicability is represented through `sid_model_applicability`
- aircraft-level applicability or overrides are not part of this schema definition phase

---

## 9. Compliance Integration Note

Future compliance projection must treat SIDs as a separate compliance source type.

Future projection target:

- `source_type = 'SID'`
- `source_id = supplemental_inspection_documents.id`

Important limitation:

- current compliance source-type support was defined for `AD` and `SB`
- SID projection requires a future `compliance_items` source-type extension before SID compliance projection can be implemented safely

This document defines the SID source schema only and does not perform that compliance schema extension.

---

## 10. Final Definition Summary

Authoritative SID source tables:

- `supplemental_inspection_documents`
- `sid_model_applicability`

Authoritative SID linkage:

- SID master record stored in `supplemental_inspection_documents`
- model applicability stored in `sid_model_applicability`
- later compliance projection uses `source_type = 'SID'` and `source_id = supplemental_inspection_documents.id`

---

**END OF SID SCHEMA DEFINITION**
