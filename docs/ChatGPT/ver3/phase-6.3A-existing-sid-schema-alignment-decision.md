# PHASE 6.3A - Existing SID Schema Alignment Decision

**Status:** Completed (READ-ONLY Decision Phase)  
**Date:** 2026-05-01  
**Purpose:** Determine whether the current live SID schema and SID model layer are aligned with the final SID schema definition.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/sid_schema_definition.md`
- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `migrations/390_create_cessna_sids.ts`
- `migrations/400_create_model_sids.ts`
- `migrations/410_create_aircraft_sid_status.ts`
- live `SequelizeMeta`
- `src/models/cessnaSid.model.ts`
- `src/models/ModelSid.ts`
- `src/models/associations.ts`
- `src/models/ComponentModel.ts`

---

## 2. Required Questions

### 1. Does `supplemental_inspection_documents` exist?

**No.**

The inspected schema snapshot and live table list show:

- `cessna_sids`
- `model_sids`
- `aircraft_sid_status`

but do not show:

- `supplemental_inspection_documents`

### 2. Does `sid_model_applicability` exist?

**No.**

The inspected schema snapshot and live table list show:

- `model_sids`

but do not show:

- `sid_model_applicability`

### 3. Do both tables match `sid_schema_definition.md`?

**No.**

The final SID schema definition requires:

- `supplemental_inspection_documents`
- `sid_model_applicability`

The current live SID structure is still the legacy SID shape:

- `cessna_sids`
- `model_sids`

That means the current live schema does not match the authoritative definition by table identity, column naming, or intended source-layer structure.

### 4. Do required constraints exist?

**No.**

Required definition constraints are not present because the required target tables do not exist.

Current legacy constraints observed:

- `cessna_sids`
  - unique constraint on `sid_number`
- `model_sids`
  - unique constraint on `(model_id, sid_id)`

Required target constraints missing:

- `supplemental_inspection_documents`
  - `manufacturer` NOT NULL
  - `reference` NOT NULL
  - `title` NOT NULL
  - unique `(manufacturer, reference)`
- `sid_model_applicability`
  - `sid_id` NOT NULL
  - `model_id` NOT NULL
  - unique `(sid_id, model_id)`

### 5. Do required indexes exist?

**No.**

Current legacy indexes observed:

- `cessna_sids_sid_number_idx`
- `cessna_sids_section_idx`
- `model_sids_model_id`
- `model_sids_sid_id`

Required target indexes missing:

- `supplemental_inspection_documents`
  - `manufacturer`
  - `reference`
  - `category`
  - `is_active`
- `sid_model_applicability`
  - `sid_id`
  - `model_id`

### 6. Do SID models exist?

**Partially, yes.**

Existing SID-related active models:

- `CessnaSid` -> `src/models/cessnaSid.model.ts`
- `ModelSid` -> `src/models/ModelSid.ts`

There are also SID-related artifacts that are not the approved target models:

- `src/models/cessna_sids`
- `src/models/aircraft_sid_applicability`
- `src/models/aircraft_sid_tracking`

### 7. Do SID models match the tables?

**Partially, yes for the legacy tables only.**

Observed:

- `CessnaSid` maps to `cessna_sids`
- `ModelSid` maps to `model_sids`

They do not match the final target SID schema because they do not map to:

- `supplemental_inspection_documents`
- `sid_model_applicability`

### 8. Are relationships/FKs correct?

**Correct for the legacy SID schema, not for the final SID schema definition.**

Current legacy FK state is coherent:

- `model_sids.model_id` -> `component_models.id`
- `model_sids.sid_id` -> `cessna_sids.id`
- `aircraft_sid_status.sid_id` -> `cessna_sids.id`

Current legacy model relationships are also coherent:

- `ComponentModel.belongsToMany(CessnaSid, through: ModelSid)`
- `CessnaSid.belongsToMany(ComponentModel, through: ModelSid)`

However, these do not align to the final required SID schema, which expects:

- `sid_model_applicability.sid_id` -> `supplemental_inspection_documents.id`
- `sid_model_applicability.model_id` -> `component_models.id`

### 9. Is correction required before continuing?

**Yes.**

The live SID schema and model layer are still on the legacy SID implementation and do not align with the authoritative SID schema definition.

---

## 3. Migration State

Live `SequelizeMeta` confirms that the applied SID migrations are the older SID migrations:

- `390_create_cessna_sids.ts`
- `400_create_model_sids.ts`
- `410_create_aircraft_sid_status.ts`

No migration is present for:

- `supplemental_inspection_documents`
- `sid_model_applicability`

This confirms that the live system remains on the pre-definition SID schema.

---

## 4. Alignment Summary

### What exists today

- legacy SID source table: `cessna_sids`
- legacy SID applicability table: `model_sids`
- legacy aircraft SID state table: `aircraft_sid_status`
- legacy active models:
  - `CessnaSid`
  - `ModelSid`

### What the final definition requires

- `supplemental_inspection_documents`
- `sid_model_applicability`
- revised field naming and source-layer identity
- revised constraints and indexes
- SID source structure aligned to the new authoritative document

### Conclusion

The current SID schema is not aligned with `docs/ChatGPT/ver3/sid_schema_definition.md`.

---

## 5. Decision

## **SID SCHEMA CORRECTION REQUIRED**

Reason:

- required target tables do not exist
- required target constraints do not exist
- required target indexes do not exist
- current SID models match only the legacy SID schema
- current FK and relationship structure is correct only for the legacy SID implementation

---

## 6. Boundaries

This phase was read-only and did not perform implementation work.

- No schema changes
- No migrations
- No model edits
- No controller/service edits
- No UI edits
- No import changes
- No projection changes
- No compliance `source_type` changes

---

**END OF PHASE 6.3A DECISION DOCUMENT**
