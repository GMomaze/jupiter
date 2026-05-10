# PHASE 6.5 - SID Import Commit

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-01  
**Purpose:** Define the final SID import commit workflow that persists validated SID source records and resolved model applicability without extending into compliance projection.

---

## 1. Scope

This phase defines the SID import commit stage only.

The commit stage must:

- accept validated preview rows only
- insert or reuse SID master records in `supplemental_inspection_documents`
- resolve model applicability against `component_models`
- insert or reuse SID applicability rows in `sid_model_applicability`
- return a structured import result summary

This phase does not implement:

- migrations
- models
- services
- controllers
- routes
- UI
- compliance projection
- compliance item creation
- workpack/task generation

---

## 2. Core Rule

Only rows that passed preview validation may be committed.

Rules:

- `VALID` preview rows may proceed to commit
- `INVALID` preview rows must not be inserted
- ignored empty rows must not be inserted
- adapter-failed imports must not reach commit

This keeps the preview stage as the mandatory validation gate.

---

## 3. Commit Inputs

The SID commit stage expects preview-normalized rows, not raw files.

Minimum required normalized row inputs:

- `manufacturer`
- `reference`
- `title`
- `description`
- `category`
- `interval_hours`
- `interval_months`
- `notes`
- `raw_model_applicability`
- preview validity state
- preview validation errors

Only rows with no blocking validation errors may continue.

---

## 4. SID Master Insert / Reuse Rule

Target table:

- `supplemental_inspection_documents`

### Insert rule

If no existing SID source record matches the preview row by:

- `manufacturer`
- `reference`

then create a new `supplemental_inspection_documents` record.

### Reuse rule

If an existing SID source record already exists with the same:

- `manufacturer`
- `reference`

then reuse that row instead of creating a duplicate.

### Duplicate rule

The SID source duplicate boundary is:

- unique(`manufacturer`, `reference`)

### Field mapping rule

The commit flow should map preview data into the SID source schema as follows:

- `manufacturer` -> `manufacturer`
- `reference` -> `reference`
- `title` -> `title`
- `description` -> `description`
- `category` -> `category`
- `interval_hours` -> first appropriate hour interval field
- `interval_months` -> first appropriate month interval field
- `notes` -> `notes`

### Interval storage note

The preview design uses simplified interval fields:

- `interval_hours`
- `interval_months`

The final SID source table uses:

- `initial_interval_hours`
- `initial_interval_months`
- `repeat_interval_hours`
- `repeat_interval_months`

Commit rule:

- when the preview contains only one normalized interval pair, store it in the initial interval fields
- do not guess repeat intervals if the preview source does not provide them explicitly
- leave repeat interval fields null when unknown

### Additional SID source fields

When data is available from the normalized preview/adapters:

- source-specific section/program details may map into:
  - `section_reference`
  - `ata_chapter`
  - `inspection_operation`
  - `source_document`

When not available:

- leave those fields null
- do not invent values

---

## 5. Model Applicability Resolution

Target table:

- `sid_model_applicability`

Applicability must be resolved during commit, not during preview.

### Resolution rule

The commit phase should attempt to resolve `raw_model_applicability` against internal `component_models`.

Resolution outputs:

- matched internal model IDs
- unresolved applicability text

### Required behavior

- raw applicability text captured in preview is the source truth
- commit may attempt structured matching against `component_models`
- commit must not guess a model match when confidence is not sufficient
- unresolved applicability must remain visible in the result summary

### Matching target

Resolution is against:

- `component_models`

This is a model-level applicability step only.

No aircraft-level applicability is created here.

---

## 6. SID Applicability Insert Rule

For each resolved internal model match:

- create one `sid_model_applicability` row only if missing

Required values:

- `sid_id`
- `model_id`

Optional/default values:

- `is_active = true`

### Duplicate rule

The applicability duplicate boundary is:

- unique(`sid_id`, `model_id`)

### Reuse rule

If the same SID-to-model applicability row already exists:

- reuse it
- do not insert a duplicate
- do not update it during this phase unless later explicitly designed

---

## 7. Unresolved Applicability Handling

Unresolved applicability must not block valid SID source insertion when the SID master row itself is valid.

Required behavior:

- insert/reuse the SID master row if the source row is otherwise valid
- insert only resolved `sid_model_applicability` rows
- keep unresolved applicability out of `sid_model_applicability`
- report unresolved applicability clearly in the result summary

Why:

- source SID records may still be worth preserving even when internal model resolution is incomplete
- applicability matching quality may improve in later phases

---

## 8. Transaction Handling

The SID import commit must use a database transaction.

Required transaction behavior:

1. Start a transaction.
2. Process validated preview rows.
3. Insert or reuse `supplemental_inspection_documents` rows.
4. Resolve raw model applicability against `component_models`.
5. Insert or reuse `sid_model_applicability` rows for resolved matches.
6. Commit only if the import completes safely.
7. Roll back on unexpected failure.

Safety rules:

- do not partially commit failed rows outside the transaction strategy
- do not delete legacy data
- do not overwrite existing SID source rows by assumption
- do not create guessed applicability rows

---

## 9. Summary Output

The commit result must return a structured summary.

Required summary content:

- total preview-valid rows processed
- total SID source rows inserted
- total SID source rows reused
- total SID duplicates skipped
- total applicability rows inserted
- total applicability rows reused
- total applicability duplicates skipped
- unresolved applicability count
- unresolved applicability details if available
- invalid rows skipped
- row-level failure reasons if any unexpected failures occur

Recommended row-level reporting:

- row number
- manufacturer
- reference
- SID source action:
  - inserted
  - reused
  - skipped
- applicability result:
  - resolved
  - partially resolved
  - unresolved

---

## 10. Commit Workflow

Recommended sequence:

1. Accept preview output as the only commit input.
2. Filter to validated rows only.
3. Start a transaction.
4. For each validated row:
   - find or create SID source row by `manufacturer + reference`
   - resolve raw model applicability against `component_models`
   - insert/reuse `sid_model_applicability` rows for resolved models
   - record unresolved applicability details
5. Commit transaction on clean completion.
6. Return structured summary.

---

## 11. Compliance Boundary

This phase must stop at SID source persistence and applicability persistence.

It must not:

- create `compliance_items`
- trigger compliance projection
- extend `source_type`
- modify compliance schema
- create workpacks
- create tasks

SID import commit is source-master persistence only.

---

## 12. Final Design Summary

The SID import commit workflow must accept validated preview rows only, reuse SID source rows by `manufacturer + reference`, resolve raw applicability against `component_models`, insert missing `sid_model_applicability` rows without duplication, and return a structured summary of inserts, reuses, duplicates, and unresolved applicability.

The commit phase stops strictly at:

- `supplemental_inspection_documents`
- `sid_model_applicability`

It does not cross into compliance projection or `source_type = SID` support.

---

**END OF PHASE 6.5 DESIGN DOCUMENT**
