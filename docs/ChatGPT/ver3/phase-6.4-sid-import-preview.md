# PHASE 6.4 - SID Import Preview

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-01  
**Purpose:** Define the SID import preview workflow before any SID import implementation or database persistence is attempted.

---

## 1. Scope

This phase defines preview-only SID import behavior.

The preview workflow must:

- parse SID source input in memory
- normalize SID rows into a Jupiter preview shape
- validate rows before any commit phase exists
- surface row-level errors and adapter errors clearly

This phase does not implement:

- migrations
- models
- services
- controllers
- routes
- UI
- database writes
- compliance projection

---

## 2. Core Rule

SID import preview is **preview only**.

No data may be written during this phase to:

- `supplemental_inspection_documents`
- `sid_model_applicability`
- `compliance_items`

The preview stage is an inspection and validation boundary only.

---

## 3. Input Types

The SID preview flow must support the following source categories:

### Manufacturer CSV

Examples:

- structured Cessna-style exported CSV
- manufacturer-maintained rows with stable columns

### Structured spreadsheets

Examples:

- Excel workbooks
- clean tabular sheets with consistent columns

### Semi-structured extracted text

Examples:

- text extracted from PDFs
- OCR-like tabular fragments
- pasted rows with inconsistent spacing

These inputs must be normalized through adapters before preview display.

---

## 4. Adapter Strategy

### Cessna SID adapter

Purpose:

- handle known Cessna SID-oriented source layouts
- map manufacturer-specific fields into the normalized SID preview shape
- preserve any source-specific section/program details

Expected behavior:

- set `manufacturer = 'Cessna'` when the source is definitively Cessna
- parse SID reference values
- parse title
- parse category if present
- parse interval fields if present
- capture raw applicability text exactly as received

### Generic CSV adapter

Purpose:

- handle non-Cessna or mixed CSV-style sources
- support flexible headers
- avoid crashing on unknown columns

Expected behavior:

- map known columns where confidently matched
- preserve unknown fields for preview reporting
- retain raw row content for validation visibility

### Adapter selection rule

The preview flow should choose the adapter explicitly where possible.

Preferred order:

- manufacturer-specific adapter when the source type is known
- generic CSV adapter when the source is tabular but not manufacturer-specific

### Adapter failure rule

If an adapter cannot parse a file safely:

- the preview must fail visibly
- the failure must be reported to the user
- no partial persistence may occur

---

## 5. Normalized SID Preview Shape

Each preview row must normalize into the following logical shape:

- `manufacturer`
- `reference`
- `title`
- `description`
- `category`
- `interval_hours`
- `interval_months`
- `notes`
- `raw_model_applicability`

Normalization notes:

- `interval_hours` is the preview-level normalized hour interval field
- `interval_months` is the preview-level normalized month interval field
- `raw_model_applicability` is the raw applicability text captured from the source
- source-specific fields may be folded into `notes` or adapter diagnostics when they do not have a first-class preview field

This preview shape is intentionally simpler than the final SID storage schema because the preview phase is focused on parse/validate visibility first.

---

## 6. Model Applicability Handling

Model applicability must be captured but not resolved yet.

Required rule:

- capture raw applicability text from the source
- do not resolve to `model_id`
- do not create `sid_model_applicability` rows
- do not guess internal model matches during preview

Why:

- source applicability text may be ambiguous
- internal model resolution belongs to a later applicability-aware phase
- preview must preserve source truth before matching logic exists

---

## 7. Validation Rules

Required row validation:

- `manufacturer` required
- `reference` required
- `title` required
- `interval_hours` numeric if provided
- `interval_months` numeric if provided
- empty rows ignored
- invalid rows flagged clearly

Additional validation behavior:

- trim text fields before validation
- blank strings should be treated as missing values
- malformed numeric interval values should produce row errors
- missing optional fields should not invalidate otherwise usable rows

---

## 8. Preview Output

The preview result must show at minimum:

- row number
- manufacturer
- reference
- title
- category
- intervals
- raw applicability
- `VALID` / `INVALID`
- validation errors per row
- totals

Recommended totals:

- total rows parsed
- valid row count
- invalid row count
- ignored empty row count
- unknown column count if applicable

---

## 9. Error Handling

### Unknown columns

Unknown columns must not crash preview.

Rule:

- report them
- preserve them in adapter diagnostics or row metadata
- continue processing where safe

### Malformed rows

Malformed rows must be flagged, not silently dropped.

Rule:

- row remains visible in preview when possible
- row marked `INVALID`
- row error reason displayed clearly

### Adapter failures

Adapter-level failures must be visible.

Examples:

- unsupported file structure
- missing expected core columns in a manufacturer adapter
- unreadable spreadsheet sheet structure

Rule:

- surface a top-level preview failure message
- do not continue to commit

---

## 10. Preview Workflow

Recommended preview sequence:

1. Receive source file or source text input.
2. Select adapter:
   - Cessna SID adapter
   - Generic CSV adapter
3. Parse source in memory only.
4. Normalize each row into the SID preview shape.
5. Capture raw applicability text as source truth.
6. Validate required fields and interval values.
7. Ignore empty rows.
8. Flag invalid rows.
9. Render preview summary and row-level results.

---

## 11. Commit Boundary

This phase defines a hard boundary before any commit phase.

The preview stage must not:

- write to `supplemental_inspection_documents`
- write to `sid_model_applicability`
- create `compliance_items`
- resolve `model_id`
- perform compliance projection

Preview is a validation gate only.

---

## 12. Final Design Summary

The SID import preview workflow must use adapters to normalize source inputs into a stable preview shape, validate required SID identity fields, preserve raw model applicability text, and show row-level validity without writing anything to SID tables or compliance tables.

The first supported adapter concepts are:

- Cessna SID adapter
- Generic CSV adapter

Model applicability remains raw and unresolved at preview time.

---

**END OF PHASE 6.4 DESIGN DOCUMENT**
