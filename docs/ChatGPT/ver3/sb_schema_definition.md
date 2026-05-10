# SB Schema Definition

**Status:** Final Definition  
**Date:** 2026-05-01  
**Purpose:** Define the final authoritative Service Bulletin schema shape for Jupiter based on Phase 5.1.

---

## 1. Core Table

The authoritative SB master table is:

- `service_bulletins`

This table represents source/library Service Bulletin records.

It is the canonical SB storage shape for future schema extension, preview, import, compliance projection, and downstream work generation.

---

## 2. Required Table Shape

### `service_bulletins`

Required fields:

- `id`
- `manufacturer`
- `reference`
- `title`
- `issue_date`
- `revision`
- `status`
- `category`
- `applicability_make`
- `applicability_model`
- `applicability_product_type`
- `applicability_notes`
- `summary`
- `compliance_requirement`
- `source_file`
- `source_format`
- `raw_source_text`
- `is_active`
- `created_at`
- `updated_at`

---

## 3. Field Definitions

### Identity And Source

- `id`
  - primary key
  - unique record identifier

- `manufacturer`
  - manufacturer/source owner context for the bulletin
  - required

- `reference`
  - bulletin number or reference number
  - required

- `title`
  - bulletin heading/title
  - required

### Document Metadata

- `issue_date`
  - original issue/publish date when available

- `revision`
  - revision or amendment indicator when available

- `status`
  - current bulletin lifecycle state such as active, superseded, cancelled, withdrawn, or equivalent normalized status

- `category`
  - bulletin category/type classification

### Applicability

- `applicability_make`
  - external applicability make text

- `applicability_model`
  - external applicability model text

- `applicability_product_type`
  - external applicability product type text

- `applicability_notes`
  - free-text applicability notes, exceptions, or continuation details

### Content

- `summary`
  - normalized bulletin summary/description

- `compliance_requirement`
  - normalized compliance recommendation/requirement value

### Source Traceability

- `source_file`
  - original file path, file name, or source document identifier

- `source_format`
  - source format label such as Piper PDF, CSV, pasted text, Cessna import, manual import, or other adapter-defined source

- `raw_source_text`
  - preserved raw source row/text block used for preview, audit, and troubleshooting

### Record State

- `is_active`
  - active/inactive library flag

- `created_at`
  - record creation timestamp

- `updated_at`
  - record update timestamp

---

## 4. Constraints

Required constraints:

- `manufacturer` NOT NULL
- `reference` NOT NULL
- `title` NOT NULL

Recommended uniqueness rule:

- unique constraint on:
  - `manufacturer`
  - `reference`
  - `revision`

Interpretation:

- this uniqueness rule is intended to prevent duplicate bulletin records for the same manufacturer/reference/revision combination
- if `revision` is null, implementation must still apply a deterministic duplicate policy during import

---

## 5. Indexes

Required indexes:

- `manufacturer`
- `reference`
- `issue_date`
- `status`
- `applicability_make`
- `applicability_model`

These indexes support:

- manufacturer filtering
- bulletin lookup
- date sorting/filtering
- status filtering
- applicability-driven search

---

## 6. Design Rules

- SBs are NOT `task_templates`
- SBs are NOT `task_cards`
- SBs are NOT stored directly in `workpacks`
- SBs are source/library compliance data

Interpretation:

- Service Bulletins are manufacturer source records
- they may drive compliance, aircraft status, and task/workpack generation later
- but they are not execution rows themselves

---

## 7. Adapter Rules

Manufacturer-specific adapters are required.

Required adapter strategy:

- Piper adapter supported conceptually
- future Cessna adapter supported conceptually
- generic/manual fallback adapter supported conceptually
- core importer must not assume one fixed CSV header format
- adapters normalize source files into the `service_bulletins` shape

### Adapter Behavior Rules

- each adapter must convert its source structure into the normalized `service_bulletins` field set
- unknown or extra source columns must be preserved when practical or clearly reported during preview
- irregular rows must be previewed before commit
- raw source text must remain traceable
- model/applicability resolution must not silently discard ambiguous source data

---

## 8. Future Integration Notes

Future integration points expected after schema definition:

- SB -> `compliance_items`
- SB -> aircraft applicability resolution
- SB -> workpack generation
- SB -> model resolution flow
- SB -> preview/commit import workflow

These are downstream implementation concerns and do not change the core definition in this document.

---

## 9. Authority

This document is the final schema-definition authority for the SB master shape in Jupiter Phase 5.2.

If future implementation differs from this document, the document must be explicitly revised before schema or import work proceeds.

---

**END OF DEFINITION DOCUMENT**
